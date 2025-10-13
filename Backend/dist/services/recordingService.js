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
        for (const [roomId, recording] of this.recordings.entries()) {
            if (recording.id === recordingId) {
                return roomId;
            }
        }
        return "";
    }
    setupEventHandlers() {
        ffmpegService_1.default.on("recordingStarted", ({ roomId, outputPath }) => {
            const recording = this.recordings.get(roomId);
            if (recording) {
                recording.localPath = outputPath;
                recording.status = "recording";
                // Update database
                Recording_1.default.findOneAndUpdate({ id: recording.id }, { localPath: outputPath, status: "recording" }, { new: true }).catch((err) => console.error("Error updating recording in DB:", err));
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
                recording.status = "completed";
                recording.uploadStatus = "uploaded"; // Mark as uploaded (local only for now)
                try {
                    const dbRecording = await Recording_1.default.findOneAndUpdate({ id: recording.id }, {
                        endTime: recording.endTime,
                        duration: recording.duration,
                        localPath: recording.localPath,
                        fileSize: recording.fileSize,
                        status: recording.status,
                        uploadStatus: recording.uploadStatus,
                    }, { new: true, upsert: false });
                    if (dbRecording) {
                        console.log(`✅ Recording ${recording.id} updated in database`);
                        console.log(`📁 File saved: ${outputPath}`);
                        console.log(`📊 File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
                    }
                    else {
                        console.warn(`⚠️ Recording ${recording.id} not found in database for update`);
                    }
                }
                catch (error) {
                    console.error("❌ Error updating recording in database:", error);
                }
                this.emit("recordingCompleted", recording);
            }
        });
        ffmpegService_1.default.on("recordingError", ({ roomId, error }) => {
            const recording = this.recordings.get(roomId);
            if (recording) {
                recording.status = "failed";
                // Update database
                Recording_1.default.findOneAndUpdate({ id: recording.id }, { status: "failed" }, { new: true }).catch((err) => console.error("Error updating failed recording in DB:", err));
                this.emit("recordingError", { recording, error });
            }
        });
        ffmpegService_1.default.on("recordingStopped", ({ roomId }) => {
            const recording = this.recordings.get(roomId);
            if (recording && recording.status === "recording") {
                recording.status = "processing";
                // Update database
                Recording_1.default.findOneAndUpdate({ id: recording.id }, { status: "processing" }, { new: true }).catch((err) => console.error("Error updating processing status in DB:", err));
                this.emit("recordingStopped", recording);
            }
        });
    }
    async startRecording(roomId, participants = [], createdBy) {
        if (this.recordings.has(roomId)) {
            throw new Error(`Recording already active for room ${roomId}`);
        }
        const recordingId = `rec_${roomId}_${Date.now()}`;
        const recording = {
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
                await mediasoupService_1.default.createRoom(roomId);
                console.log(`✅ Room ${roomId} ready for recording`);
            }
            catch (error) {
                if (!error.message || !error.message.includes("already exists")) {
                    throw error;
                }
                console.log(`✅ Room ${roomId} already exists`);
            }
            // Save to database BEFORE starting mediasoup recording
            const dbRecording = new Recording_1.default({
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
            await mediasoupService_1.default.startRecording(roomId);
            console.log(`✅ Mediasoup recording started for room ${roomId}`);
            return recording;
        }
        catch (error) {
            this.recordings.delete(roomId);
            // Clean up database entry if mediasoup recording failed
            try {
                await Recording_1.default.deleteOne({ id: recordingId });
            }
            catch (dbError) {
                console.error("Error cleaning up database entry:", dbError);
            }
            console.error(`❌ Failed to start recording for room ${roomId}:`, error);
            throw error;
        }
    }
    async stopRecording(roomId) {
        const recording = this.recordings.get(roomId);
        if (!recording) {
            throw new Error(`No active recording found for room ${roomId}`);
        }
        try {
            // Stop mediasoup recording
            await mediasoupService_1.default.stopRecording(roomId);
            console.log(`✅ Recording stopped for room ${roomId}`);
            return recording;
        }
        catch (error) {
            console.error(`❌ Error stopping recording for room ${roomId}:`, error);
            throw error;
        }
    }
    getRecording(roomId) {
        return this.recordings.get(roomId) || null;
    }
    getAllRecordings() {
        return Array.from(this.recordings.values());
    }
    getCompletedRecordings() {
        return Array.from(this.recordings.values()).filter((recording) => recording.status === "completed" || recording.status === "uploaded");
    }
    getActiveRecordings() {
        return Array.from(this.recordings.values()).filter((recording) => recording.status === "recording");
    }
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
            // Delete from database
            await Recording_1.default.deleteOne({ id: recording.id });
            // Remove from memory
            this.recordings.delete(roomId);
            console.log(`✅ Deleted recording for room ${roomId}`);
            this.emit("recordingDeleted", recording);
        }
        catch (error) {
            console.error(`❌ Error deleting recording for room ${roomId}:`, error);
            throw error;
        }
    }
    async getRecordingDownloadUrl(roomId, expiresIn = 3600) {
        const recording = this.recordings.get(roomId);
        if (!recording || !recording.s3Key) {
            throw new Error(`Recording not found or not uploaded for room ${roomId}`);
        }
        return await s3Service_1.default.getSignedUrl(recording.s3Key, expiresIn);
    }
    async cleanupOldRecordings(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const recordingsToDelete = Array.from(this.recordings.entries()).filter(([, recording]) => recording.endTime && recording.endTime < cutoffDate);
        for (const [roomId, recording] of recordingsToDelete) {
            try {
                await this.deleteRecording(roomId);
                console.log(`✅ Cleaned up old recording: ${recording.id}`);
            }
            catch (error) {
                console.error(`❌ Error cleaning up recording ${recording.id}:`, error);
            }
        }
        await ffmpegService_1.default.cleanupOldRecordings(daysOld);
    }
    updateRecordingParticipants(roomId, participants) {
        const recording = this.recordings.get(roomId);
        if (recording) {
            recording.participants = participants;
            // Update in database
            Recording_1.default.findOneAndUpdate({ id: recording.id }, { participants }, { new: true }).catch((err) => console.error("Error updating participants in DB:", err));
            this.emit("recordingUpdated", recording);
        }
    }
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
    getUploadQueueStatus() {
        return uploadQueueService_1.default.getQueueStatus();
    }
    async retryFailedUploads() {
        await uploadQueueService_1.default.retryFailedUploads();
    }
    async getRecordingsByUploadStatus(uploadStatus) {
        return await Recording_1.default.find({ uploadStatus }).sort({ createdAt: -1 });
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
exports.RecordingService = RecordingService;
exports.default = new RecordingService();
