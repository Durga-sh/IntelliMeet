import { EventEmitter } from "events";
import mediasoupService from "./mediasoupService";
import ffmpegService from "./ffmpegService";
import s3Service from "./s3Service";
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
  status: "recording" | "processing" | "completed" | "failed";
  participants: string[];
}

export class RecordingService extends EventEmitter {
  private recordings: Map<string, RecordingMetadata> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to FFmpeg events
    ffmpegService.on("recordingStarted", ({ roomId, outputPath }) => {
      const recording = this.recordings.get(roomId);
      if (recording) {
        recording.localPath = outputPath;
        recording.status = "recording";
        this.emit("recordingStarted", recording);
      }
    });

    ffmpegService.on(
      "recordingCompleted",
      async ({ roomId, outputPath, s3Url, s3Key }) => {
        const recording = this.recordings.get(roomId);
        if (recording) {
          recording.endTime = new Date();
          recording.duration =
            recording.endTime.getTime() - recording.startTime.getTime();
          recording.s3Url = s3Url;
          recording.s3Key = s3Key;
          recording.status = "completed";

          // Update in database
          try {
            await Recording.findOneAndUpdate(
              { id: recording.id },
              {
                endTime: recording.endTime,
                duration: recording.duration,
                s3Url: recording.s3Url,
                s3Key: recording.s3Key,
                status: recording.status,
              }
            );
          } catch (error) {
            console.error("Error updating recording in database:", error);
          }

          this.emit("recordingCompleted", recording);
        }
      }
    );

    ffmpegService.on("recordingError", ({ roomId, error }) => {
      const recording = this.recordings.get(roomId);
      if (recording) {
        recording.status = "failed";
        this.emit("recordingError", { recording, error });
      }
    });

    ffmpegService.on("recordingStopped", ({ roomId }) => {
      const recording = this.recordings.get(roomId);
      if (recording && recording.status === "recording") {
        recording.status = "processing";
        this.emit("recordingStopped", recording);
      }
    });
  }

  /**
   * Start recording a room
   */
  async startRecording(
    roomId: string,
    participants: string[] = [],
    createdBy?: string
  ): Promise<RecordingMetadata> {
    if (this.recordings.has(roomId)) {
      throw new Error(`Recording already active for room ${roomId}`);
    }

    const recording: RecordingMetadata = {
      id: `${roomId}_${Date.now()}`,
      roomId,
      startTime: new Date(),
      status: "recording",
      participants,
    };

    this.recordings.set(roomId, recording);

    try {
      // Save to database
      const dbRecording = new Recording({
        id: recording.id,
        roomId: recording.roomId,
        startTime: recording.startTime,
        status: recording.status,
        participants: recording.participants,
        createdBy: createdBy,
      });
      await dbRecording.save();

      // Start mediasoup recording
      await mediasoupService.startRecording(roomId);

      console.log(`Started recording for room ${roomId}`);
      return recording;
    } catch (error) {
      this.recordings.delete(roomId);
      // Clean up database record if it was created
      await Recording.deleteOne({ id: recording.id }).catch(console.error);
      throw error;
    }
  }

  /**
   * Stop recording a room
   */
  async stopRecording(roomId: string): Promise<RecordingMetadata | null> {
    const recording = this.recordings.get(roomId);
    if (!recording) {
      throw new Error(`No active recording found for room ${roomId}`);
    }

    try {
      // Stop mediasoup recording
      await mediasoupService.stopRecording(roomId);

      console.log(`Stopped recording for room ${roomId}`);
      return recording;
    } catch (error) {
      console.error(`Error stopping recording for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Get recording by room ID
   */
  getRecording(roomId: string): RecordingMetadata | null {
    return this.recordings.get(roomId) || null;
  }

  /**
   * Get all recordings
   */
  getAllRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values());
  }

  /**
   * Get completed recordings
   */
  getCompletedRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values()).filter(
      (recording) => recording.status === "completed"
    );
  }

  /**
   * Get active recordings
   */
  getActiveRecordings(): RecordingMetadata[] {
    return Array.from(this.recordings.values()).filter(
      (recording) => recording.status === "recording"
    );
  }

  /**
   * Delete recording (from S3 and local storage)
   */
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

      // Remove from local storage
      this.recordings.delete(roomId);

      console.log(`Deleted recording for room ${roomId}`);
      this.emit("recordingDeleted", recording);
    } catch (error) {
      console.error(`Error deleting recording for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Get signed URL for downloading recording
   */
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

  /**
   * Clean up old recordings
   */
  async cleanupOldRecordings(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const recordingsToDelete = Array.from(this.recordings.entries()).filter(
      ([, recording]) => recording.endTime && recording.endTime < cutoffDate
    );

    for (const [roomId, recording] of recordingsToDelete) {
      try {
        await this.deleteRecording(roomId);
        console.log(`Cleaned up old recording: ${recording.id}`);
      } catch (error) {
        console.error(`Error cleaning up recording ${recording.id}:`, error);
      }
    }

    // Also clean up FFmpeg local files
    await ffmpegService.cleanupOldRecordings(daysOld);
  }

  /**
   * Update recording participants
   */
  updateRecordingParticipants(roomId: string, participants: string[]): void {
    const recording = this.recordings.get(roomId);
    if (recording) {
      recording.participants = participants;
      this.emit("recordingUpdated", recording);
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const recordings = Array.from(this.recordings.values());
    return {
      total: recordings.length,
      active: recordings.filter((r) => r.status === "recording").length,
      completed: recordings.filter((r) => r.status === "completed").length,
      failed: recordings.filter((r) => r.status === "failed").length,
      processing: recordings.filter((r) => r.status === "processing").length,
    };
  }
}

export default new RecordingService();
