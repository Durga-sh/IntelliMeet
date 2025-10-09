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
const Recording_1 = __importDefault(require("../models/Recording"));
class RecordingService extends events_1.EventEmitter {
    constructor() {
        super();
        this.recordings = new Map();
        this.setupEventHandlers();
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
        ffmpegService_1.default.on("recordingCompleted", async ({ roomId, outputPath, s3Url, s3Key }) => {
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
                    await Recording_1.default.findOneAndUpdate({ id: recording.id }, {
                        endTime: recording.endTime,
                        duration: recording.duration,
                        s3Url: recording.s3Url,
                        s3Key: recording.s3Key,
                        status: recording.status,
                    });
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
            participants,
        };
        this.recordings.set(roomId, recording);
        try {
            // Save to database
            const dbRecording = new Recording_1.default({
                id: recording.id,
                roomId: recording.roomId,
                startTime: recording.startTime,
                status: recording.status,
                participants: recording.participants,
                createdBy: createdBy,
            });
            await dbRecording.save();
            // Start mediasoup recording
            await mediasoupService_1.default.startRecording(roomId);
            console.log(`Started recording for room ${roomId}`);
            return recording;
        }
        catch (error) {
            this.recordings.delete(roomId);
            // Clean up database record if it was created
            await Recording_1.default.deleteOne({ id: recording.id }).catch(console.error);
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
exports.RecordingService = RecordingService;
exports.default = new RecordingService();
