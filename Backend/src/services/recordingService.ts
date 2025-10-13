import { EventEmitter } from "events";
import mediasoupService from "./mediasoupService";
import ffmpegService from "./ffmpegService";
import s3Service from "./s3Service";
import uploadQueueService from "./uploadQueueService";
import Recording, { IRecording } from "../models/Recording";

export interface RecordingMetadata {
  id: string;
  roomId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  localPath?: string;
  s3Url?: string;
  s3Key?: string;
  status:
    | "recording"
    | "processing"
    | "completed"
    | "failed"
    | "local"
    | "uploading"
    | "uploaded";
  uploadStatus: "pending" | "queued" | "uploading" | "uploaded" | "failed";
  participants: string[];
  fileSize?: number;
}

export class RecordingService extends EventEmitter {
  private recordings: Map<string, RecordingMetadata> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
    this.setupUploadQueueHandlers();
  }

  private setupUploadQueueHandlers(): void {
    uploadQueueService.on("uploadQueued", ({ recordingId }) => {
      this.emit("uploadQueued", { recordingId });
    });

    uploadQueueService.on("uploadStarted", ({ recordingId, attempt }) => {
      const recording = this.recordings.get(
        this.getRoomIdByRecordingId(recordingId)
      );
      if (recording) {
        recording.uploadStatus = "uploading";
        this.emit("uploadStarted", { recordingId, attempt });
      }
    });

    uploadQueueService.on(
      "uploadCompleted",
      ({ recordingId, s3Url, fileSize }) => {
        const recording = this.recordings.get(
          this.getRoomIdByRecordingId(recordingId)
        );
        if (recording) {
          recording.s3Url = s3Url;
          recording.uploadStatus = "uploaded";
          recording.status = "uploaded";
          this.emit("uploadCompleted", { recordingId, s3Url, fileSize });
        }
      }
    );

    uploadQueueService.on("uploadFailed", ({ recordingId, error }) => {
      const recording = this.recordings.get(
        this.getRoomIdByRecordingId(recordingId)
      );
      if (recording) {
        recording.uploadStatus = "failed";
        this.emit("uploadFailed", { recordingId, error });
      }
    });
  }

  private getRoomIdByRecordingId(recordingId: string): string {
    for (const [roomId, recording] of this.recordings.entries()) {
      if (recording.id === recordingId) {
        return roomId;
      }
    }
    return "";
  }

  private setupEventHandlers(): void {
    ffmpegService.on("recordingStarted", ({ roomId, outputPath }) => {
      const recording = this.recordings.get(roomId);
      if (recording) {
        recording.localPath = outputPath;
        recording.status = "recording";

        // Update database
        Recording.findOneAndUpdate(
          { id: recording.id },
          { localPath: outputPath, status: "recording" },
          { new: true }
        ).catch((err) => console.error("Error updating recording in DB:", err));

        this.emit("recordingStarted", recording);
      }
    });

    ffmpegService.on(
      "recordingCompleted",
      async ({ roomId, outputPath, fileSize }) => {
        const recording = this.recordings.get(roomId);
        if (recording) {
          recording.endTime = new Date();
          recording.duration =
            recording.endTime.getTime() - recording.startTime.getTime();
          recording.localPath = outputPath;
          recording.fileSize = fileSize;
          recording.status = "completed";
          recording.uploadStatus = "uploaded"; // Mark as uploaded (local only for now)

          try {
            const dbRecording = await Recording.findOneAndUpdate(
              { id: recording.id },
              {
                endTime: recording.endTime,
                duration: recording.duration,
                localPath: recording.localPath,
                fileSize: recording.fileSize,
                status: recording.status,
                uploadStatus: recording.uploadStatus,
              },
              { new: true, upsert: false }
            );

            if (dbRecording) {
              console.log(`✅ Recording ${recording.id} updated in database`);
              console.log(`📁 File saved: ${outputPath}`);
              console.log(
                `📊 File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`
              );
            } else {
              console.warn(
                `⚠️ Recording ${recording.id} not found in database for update`
              );
            }
          } catch (error) {
            console.error("❌ Error updating recording in database:", error);
          }

          this.emit("recordingCompleted", recording);
        }
      }
    );

    ffmpegService.on("recordingError", ({ roomId, error }) => {
      const recording = this.recordings.get(roomId);
      if (recording) {
        recording.status = "failed";

        // Update database
        Recording.findOneAndUpdate(
          { id: recording.id },
          { status: "failed" },
          { new: true }
        ).catch((err) =>
          console.error("Error updating failed recording in DB:", err)
        );

        this.emit("recordingError", { recording, error });
      }
    });

    ffmpegService.on("recordingStopped", ({ roomId }) => {
      const recording = this.recordings.get(roomId);
      if (recording && recording.status === "recording") {
        recording.status = "processing";

        // Update database
        Recording.findOneAndUpdate(
          { id: recording.id },
          { status: "processing" },
          { new: true }
        ).catch((err) =>
          console.error("Error updating processing status in DB:", err)
        );

        this.emit("recordingStopped", recording);
      }
    });
  }

  async startRecording(
    roomId: string,
    participants: string[] = [],
    createdBy?: string
  ): Promise<RecordingMetadata> {
    if (this.recordings.has(roomId)) {
      throw new Error(`Recording already active for room ${roomId}`);
    }

    const recordingId = `rec_${roomId}_${Date.now()}`;
    const recording: RecordingMetadata = {
      id: recordingId,
      roomId,
      startTime: new Date(),
      status: "recording",
      uploadStatus: "pending",
      participants,
    };

    this.recordings.set(roomId, recording);

    try {
      // Ensure room exists
      try {
        await mediasoupService.createRoom(roomId);
        console.log(`✅ Room ${roomId} ready for recording`);
      } catch (error: any) {
        if (!error.message || !error.message.includes("already exists")) {
          throw error;
        }
        console.log(`✅ Room ${roomId} already exists`);
      }

      // Save to database BEFORE starting mediasoup recording
      const dbRecording = new Recording({
        id: recording.id,
        roomId: recording.roomId,
        startTime: recording.startTime,
        status: "recording",
        uploadStatus: recording.uploadStatus,
        participants: recording.participants,
        createdBy: createdBy,
      });

      await dbRecording.save();
      console.log(`✅ Recording ${recording.id} saved to database`);

      // Now start mediasoup recording
      await mediasoupService.startRecording(roomId);
      console.log(`✅ Mediasoup recording started for room ${roomId}`);

      return recording;
    } catch (error: any) {
      this.recordings.delete(roomId);

      // Clean up database entry if mediasoup recording failed
      try {
        await Recording.deleteOne({ id: recordingId });
      } catch (dbError) {
        console.error("Error cleaning up database entry:", dbError);
      }

      console.error(`❌ Failed to start recording for room ${roomId}:`, error);
      throw error;
    }
  }

  async stopRecording(roomId: string): Promise<RecordingMetadata | null> {
    const recording = this.recordings.get(roomId);
    if (!recording) {
      throw new Error(`No active recording found for room ${roomId}`);
    }

    try {
      // Stop mediasoup recording
      await mediasoupService.stopRecording(roomId);

      console.log(`✅ Recording stopped for room ${roomId}`);
      return recording;
    } catch (error) {
      console.error(`❌ Error stopping recording for room ${roomId}:`, error);
      throw error;
    }
  }

  getRecording(roomId: string): RecordingMetadata | null {
    return this.recordings.get(roomId) || null;
  }

  getAllRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values());
  }

  getCompletedRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values()).filter(
      (recording) =>
        recording.status === "completed" || recording.status === "uploaded"
    );
  }

  getActiveRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values()).filter(
      (recording) => recording.status === "recording"
    );
  }

  async deleteRecording(roomId: string): Promise<void> {
    const recording = this.recordings.get(roomId);
    if (!recording) {
      throw new Error(`Recording not found for room ${roomId}`);
    }

    try {
      // Delete from S3 if exists
      if (recording.s3Key) {
        await s3Service.deleteFile(recording.s3Key);
      }

      // Delete from database
      await Recording.deleteOne({ id: recording.id });

      // Remove from memory
      this.recordings.delete(roomId);

      console.log(`✅ Deleted recording for room ${roomId}`);
      this.emit("recordingDeleted", recording);
    } catch (error) {
      console.error(`❌ Error deleting recording for room ${roomId}:`, error);
      throw error;
    }
  }

  async getRecordingDownloadUrl(
    roomId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const recording = this.recordings.get(roomId);
    if (!recording || !recording.s3Key) {
      throw new Error(`Recording not found or not uploaded for room ${roomId}`);
    }

    return await s3Service.getSignedUrl(recording.s3Key, expiresIn);
  }

  async cleanupOldRecordings(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const recordingsToDelete = Array.from(this.recordings.entries()).filter(
      ([, recording]) => recording.endTime && recording.endTime < cutoffDate
    );

    for (const [roomId, recording] of recordingsToDelete) {
      try {
        await this.deleteRecording(roomId);
        console.log(`✅ Cleaned up old recording: ${recording.id}`);
      } catch (error) {
        console.error(`❌ Error cleaning up recording ${recording.id}:`, error);
      }
    }

    await ffmpegService.cleanupOldRecordings(daysOld);
  }

  updateRecordingParticipants(roomId: string, participants: string[]): void {
    const recording = this.recordings.get(roomId);
    if (recording) {
      recording.participants = participants;

      // Update in database
      Recording.findOneAndUpdate(
        { id: recording.id },
        { participants },
        { new: true }
      ).catch((err) =>
        console.error("Error updating participants in DB:", err)
      );

      this.emit("recordingUpdated", recording);
    }
  }

  async uploadRecording(
    recordingId: string,
    priority: number = 5
  ): Promise<void> {
    try {
      const recording = await Recording.findOne({ id: recordingId });
      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      if (!recording.localPath) {
        throw new Error(`No local path found for recording: ${recordingId}`);
      }

      if (recording.uploadStatus === "uploaded") {
        throw new Error(`Recording already uploaded: ${recordingId}`);
      }

      await uploadQueueService.enqueueUpload(recording, priority);
      console.log(`Manually queued recording ${recordingId} for upload`);
    } catch (error) {
      console.error(
        `Error queuing recording ${recordingId} for upload:`,
        error
      );
      throw error;
    }
  }

  getUploadQueueStatus() {
    return uploadQueueService.getQueueStatus();
  }

  async retryFailedUploads(): Promise<void> {
    await uploadQueueService.retryFailedUploads();
  }

  async getRecordingsByUploadStatus(
    uploadStatus: "pending" | "queued" | "uploading" | "uploaded" | "failed"
  ): Promise<IRecording[]> {
    return await Recording.find({ uploadStatus }).sort({ createdAt: -1 });
  }

  getStatistics() {
    const recordings = Array.from(this.recordings.values());
    return {
      total: recordings.length,
      active: recordings.filter((r) => r.status === "recording").length,
      completed: recordings.filter((r) => r.status === "completed").length,
      local: recordings.filter((r) => r.status === "local").length,
      uploaded: recordings.filter((r) => r.status === "uploaded").length,
      failed: recordings.filter((r) => r.status === "failed").length,
      processing: recordings.filter((r) => r.status === "processing").length,
      uploading: recordings.filter((r) => r.status === "uploading").length,
    };
  }
}

export default new RecordingService();
