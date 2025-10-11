"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingService = void 0;
const events_1 = require("events");
const mediasoupService_1 = __importDefault(require("./mediasoupService"));
const ffmpegService_1 = __importDefault(require("./ffmpegService"));
const s3Service_1 = __importDefault(require("./s3Service"));
const uploadQueueService_1 = __importDefault(require("./uploadQueueService"));
const Recording_1 = __importDefault(require("../models/Recording"));
class RecordingService extends events_1.EventEmitter {
    constructor() {
        super();
        this.recordings = new Map();
        this.setupEventHandlers();
        this.setupUploadQueueHandlers();
    }
    setupUploadQueueHandlers() {
        // Listen to upload queue events
        uploadQueueService_1.default.on("uploadQueued", ({ recordingId }) => {
            this.emit("uploadQueued", { recordingId });
        });
        uploadQueueService_1.default.on("uploadStarted", ({ recordingId, attempt }) => {
            const recording = this.recordings.get(this.getRoomIdByRecordingId(recordingId));
            if (recording) {
                recording.uploadStatus = "uploading";
                this.emit("uploadStarted", { recordingId, attempt });
            }
        });
        uploadQueueService_1.default.on("uploadCompleted", ({ recordingId, s3Url, fileSize }) => {
            const recording = this.recordings.get(this.getRoomIdByRecordingId(recordingId));
            if (recording) {
                recording.s3Url = s3Url;
                recording.uploadStatus = "uploaded";
                recording.status = "uploaded";
                this.emit("uploadCompleted", { recordingId, s3Url, fileSize });
            }
        });
        uploadQueueService_1.default.on("uploadFailed", ({ recordingId, error }) => {
            const recording = this.recordings.get(this.getRoomIdByRecordingId(recordingId));
            if (recording) {
                recording.uploadStatus = "failed";
                this.emit("uploadFailed", { recordingId, error });
            }
        });
    }
    getRoomIdByRecordingId(recordingId) {
        // Find room ID by recording ID from the in-memory map
        for (const [roomId, recording] of this.recordings.entries()) {
            if (recording.id === recordingId) {
                return roomId;
            }
        }
        return "";
    }
    setupEventHandlers() {
        // Listen to FFmpeg events
        ffmpegService_1.default.on("recordingStarted", ({ roomId, outputPath }) => {
            const recording = this.recordings.get(roomId);
            if (recording) {
                recording.localPath = outputPath;
                recording.status = "recording";
                this.emit("recordingStarted", recording);
            }
        });
        ffmpegService_1.default.on("recordingCompleted", async ({ roomId, outputPath, fileSize }) => {
            const recording = this.recordings.get(roomId);
            if (recording) {
                recording.endTime = new Date();
                recording.duration =
                    recording.endTime.getTime() - recording.startTime.getTime();
                recording.localPath = outputPath;
                recording.fileSize = fileSize;
                recording.status = "completed"; // Mark as completed (no S3 upload)
                recording.uploadStatus = "uploaded"; // Skip upload queue
                // Update in database
                try {
                    const dbRecording = await Recording_1.default.findOneAndUpdate({ id: recording.id }, {
                        endTime: recording.endTime,
                        duration: recording.duration,
                        localPath: recording.localPath,
                        fileSize: recording.fileSize,
                        status: recording.status,
                        uploadStatus: recording.uploadStatus,
                    }, { new: true });
                    console.log(`Recording ${recording.id} saved locally: ${outputPath}`);
                    console.log(`File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
                    console.log(`Database updated successfully`);
                    // No S3 upload for now
                }
                catch (error) {
                    console.error("Error updating recording in database:", error);
                }
                this.emit("recordingCompleted", recording);
            }
        });
        ffmpegService_1.default.on("recordingError", ({ roomId, error }) => {
            const recording = this.recordings.get(roomId);
            if (recording) {
                recording.status = "failed";
                this.emit("recordingError", { recording, error });
            }
        });
        ffmpegService_1.default.on("recordingStopped", ({ roomId }) => {
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
    async startRecording(roomId, participants = [], createdBy) {
        if (this.recordings.has(roomId)) {
            throw new Error(`Recording already active for room ${roomId}`);
        }
        const recording = {
            id: `${roomId}_${Date.now()}`,
            roomId,
            startTime: new Date(),
            status: "recording",
            uploadStatus: "pending",
            participants,
        };
        this.recordings.set(roomId, recording);
        try {
            // Ensure room exists before starting recording
            try {
                await mediasoupService_1.default.createRoom(roomId);
                console.log(`✅ Room ${roomId} created for recording`);
            }
            catch (error) {
                if (error.message && error.message.includes("already exists")) {
                    console.log(`✅ Room ${roomId} already exists`);
                }
                else {
                    throw error;
                }
            }
            // Start mediasoup recording FIRST (this is the critical part)
            await mediasoupService_1.default.startRecording(roomId);
            // Save to database in background (non-blocking)
            const dbRecording = new Recording_1.default({
                id: recording.id,
                roomId: recording.roomId,
                startTime: recording.startTime,
                status: recording.status,
                uploadStatus: recording.uploadStatus,
                participants: recording.participants,
                createdBy: createdBy,
            });
            // Save to database without blocking (fire and forget)
            dbRecording
                .save()
                .then(() => {
                console.log(`✅ Recording ${recording.id} saved to database`);
            })
                .catch((dbError) => {
                console.error(`❌ Failed to save recording ${recording.id} to database:`, dbError.message);
                // Don't fail the recording just because database failed
            });
            console.log(`Started recording for room ${roomId}`);
            return recording;
        }
        catch (error) {
            this.recordings.delete(roomId);
            // Don't try to clean up database if we couldn't save to it in the first place
            console.error(`Failed to start recording for room ${roomId}:`, error);
            throw error;
        }
    }
    /**
     * Stop recording a room
     */
    async stopRecording(roomId) {
        const recording = this.recordings.get(roomId);
        if (!recording) {
            throw new Error(`No active recording found for room ${roomId}`);
        }
        try {
            // Stop mediasoup recording
            await mediasoupService_1.default.stopRecording(roomId);
            console.log(`Stopped recording for room ${roomId}`);
            return recording;
        }
        catch (error) {
            console.error(`Error stopping recording for room ${roomId}:`, error);
            throw error;
        }
    }
    /**
     * Get recording by room ID
     */
    getRecording(roomId) {
        return this.recordings.get(roomId) || null;
    }
    /**
     * Get all recordings
     */
    getAllRecordings() {
        return Array.from(this.recordings.values());
    }
    /**
     * Get completed recordings
     */
    getCompletedRecordings() {
        return Array.from(this.recordings.values()).filter((recording) => recording.status === "completed");
    }
    /**
     * Get active recordings
     */
    getActiveRecordings() {
        return Array.from(this.recordings.values()).filter((recording) => recording.status === "recording");
    }
    /**
     * Delete recording (from S3 and local storage)
     */
    async deleteRecording(roomId) {
        const recording = this.recordings.get(roomId);
        if (!recording) {
            throw new Error(`Recording not found for room ${roomId}`);
        }
        try {
            // Delete from S3 if exists
            if (recording.s3Key) {
                await s3Service_1.default.deleteFile(recording.s3Key);
            }
            // Remove from local storage
            this.recordings.delete(roomId);
            console.log(`Deleted recording for room ${roomId}`);
            this.emit("recordingDeleted", recording);
        }
        catch (error) {
            console.error(`Error deleting recording for room ${roomId}:`, error);
            throw error;
        }
    }
    /**
     * Get signed URL for downloading recording
     */
    async getRecordingDownloadUrl(roomId, expiresIn = 3600) {
        const recording = this.recordings.get(roomId);
        if (!recording || !recording.s3Key) {
            throw new Error(`Recording not found or not uploaded for room ${roomId}`);
        }
        return await s3Service_1.default.getSignedUrl(recording.s3Key, expiresIn);
    }
    /**
     * Clean up old recordings
     */
    async cleanupOldRecordings(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const recordingsToDelete = Array.from(this.recordings.entries()).filter(([, recording]) => recording.endTime && recording.endTime < cutoffDate);
        for (const [roomId, recording] of recordingsToDelete) {
            try {
                await this.deleteRecording(roomId);
                console.log(`Cleaned up old recording: ${recording.id}`);
            }
            catch (error) {
                console.error(`Error cleaning up recording ${recording.id}:`, error);
            }
        }
        // Also clean up FFmpeg local files
        await ffmpegService_1.default.cleanupOldRecordings(daysOld);
    }
    /**
     * Update recording participants
     */
    updateRecordingParticipants(roomId, participants) {
        const recording = this.recordings.get(roomId);
        if (recording) {
            recording.participants = participants;
            this.emit("recordingUpdated", recording);
        }
    }
    /**
     * Manually trigger upload for a recording
     */
    async uploadRecording(recordingId, priority = 5) {
        try {
            const recording = await Recording_1.default.findOne({ id: recordingId });
            if (!recording) {
                throw new Error(`Recording not found: ${recordingId}`);
            }
            if (!recording.localPath) {
                throw new Error(`No local path found for recording: ${recordingId}`);
            }
            if (recording.uploadStatus === "uploaded") {
                throw new Error(`Recording already uploaded: ${recordingId}`);
            }
            await uploadQueueService_1.default.enqueueUpload(recording, priority);
            console.log(`Manually queued recording ${recordingId} for upload`);
        }
        catch (error) {
            console.error(`Error queuing recording ${recordingId} for upload:`, error);
            throw error;
        }
    }
    /**
     * Get upload queue status
     */
    getUploadQueueStatus() {
        return uploadQueueService_1.default.getQueueStatus();
    }
    /**
     * Retry failed uploads
     */
    async retryFailedUploads() {
        await uploadQueueService_1.default.retryFailedUploads();
    }
    /**
     * Get recordings by upload status
     */
    async getRecordingsByUploadStatus(uploadStatus) {
        return await Recording_1.default.find({ uploadStatus }).sort({ createdAt: -1 });
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
            local: recordings.filter((r) => r.status === "local").length,
            uploaded: recordings.filter((r) => r.status === "uploaded").length,
            failed: recordings.filter((r) => r.status === "failed").length,
            processing: recordings.filter((r) => r.status === "processing").length,
            uploading: recordings.filter((r) => r.status === "uploading").length,
        };
    }
}
exports.RecordingService = RecordingService;
exports.default = new RecordingService();
