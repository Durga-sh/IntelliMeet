"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadQueueService = void 0;
const events_1 = require("events");
const fs_1 = require("fs");
const localStorageService_1 = __importDefault(require("./localStorageService"));
const Recording_1 = __importDefault(require("../models/Recording"));
class UploadQueueService extends events_1.EventEmitter {
    constructor() {
        super();
        this.uploadQueue = [];
        this.isProcessing = false;
        this.maxConcurrentUploads = 3;
        this.activeUploads = new Set();
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
        this.processingInterval = null;
        this.startProcessing();
    }
    /**
     * Add a recording to the upload queue
     */
    async enqueueUpload(recording, priority = 10) {
        if (!recording.localPath || !recording.id) {
            throw new Error("Recording must have localPath and id to be queued for upload");
        }
        // Check if file exists locally
        try {
            await fs_1.promises.access(recording.localPath);
        }
        catch (error) {
            throw new Error(`Local recording file not found: ${recording.localPath}`);
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const s3Key = `recordings/${recording.roomId}/${recording.id}_${timestamp}.mp4`;
        const uploadTask = {
            recordingId: recording.id,
            localPath: recording.localPath,
            s3Key,
            attempts: 0,
            priority,
        };
        // Remove any existing task for this recording
        this.uploadQueue = this.uploadQueue.filter((task) => task.recordingId !== recording.id);
        // Insert task based on priority
        const insertIndex = this.uploadQueue.findIndex((task) => task.priority > priority);
        if (insertIndex === -1) {
            this.uploadQueue.push(uploadTask);
        }
        else {
            this.uploadQueue.splice(insertIndex, 0, uploadTask);
        }
        // Update recording status
        await Recording_1.default.findOneAndUpdate({ id: recording.id }, {
            uploadStatus: "queued",
            s3Key: s3Key,
        });
        console.log(`Enqueued upload for recording ${recording.id} (priority: ${priority})`);
        this.emit("uploadQueued", {
            recordingId: recording.id,
            queuePosition: this.uploadQueue.length,
        });
    }
    /**
     * Start processing the upload queue
     */
    startProcessing() {
        this.processingInterval = setInterval(async () => {
            if (!this.isProcessing &&
                this.uploadQueue.length > 0 &&
                this.activeUploads.size < this.maxConcurrentUploads) {
                await this.processQueue();
            }
        }, 1000); // Check every second
    }
    /**
     * Process the upload queue
     */
    async processQueue() {
        if (this.isProcessing ||
            this.uploadQueue.length === 0 ||
            this.activeUploads.size >= this.maxConcurrentUploads) {
            return;
        }
        this.isProcessing = true;
        try {
            // Get next task that's not already being processed
            const taskIndex = this.uploadQueue.findIndex((task) => !this.activeUploads.has(task.recordingId));
            if (taskIndex === -1) {
                this.isProcessing = false;
                return;
            }
            const task = this.uploadQueue[taskIndex];
            this.uploadQueue.splice(taskIndex, 1);
            this.activeUploads.add(task.recordingId);
            // Process the upload task (don't await here to allow concurrent uploads)
            this.processUploadTask(task).finally(() => {
                this.activeUploads.delete(task.recordingId);
            });
        }
        catch (error) {
            console.error("Error processing upload queue:", error);
        }
        this.isProcessing = false;
    }
    /**
     * Process a single upload task
     */
    async processUploadTask(task) {
        const { recordingId, localPath, s3Key } = task;
        try {
            // Update recording status to uploading
            await Recording_1.default.findOneAndUpdate({ id: recordingId }, {
                uploadStatus: "uploading",
                uploadAttempts: task.attempts + 1,
            });
            console.log(`Starting upload for recording ${recordingId} (attempt ${task.attempts + 1})`);
            this.emit("uploadStarted", { recordingId, attempt: task.attempts + 1 });
            // Check if file still exists
            try {
                await fs_1.promises.access(localPath);
            }
            catch (error) {
                throw new Error(`Local file no longer exists: ${localPath}`);
            }
            // Get file stats
            const stats = await fs_1.promises.stat(localPath);
            const fileSize = stats.size;
            // Mock upload to local storage (without deleting local file)
            const s3Url = await localStorageService_1.default.uploadFileWithoutDelete(localPath, s3Key);
            // Update recording with successful upload
            const recording = await Recording_1.default.findOneAndUpdate({ id: recordingId }, {
                s3Url,
                s3Key,
                fileSize,
                uploadStatus: "uploaded",
                status: "uploaded",
                uploadError: undefined,
            }, { new: true });
            console.log(`Successfully uploaded recording ${recordingId} to S3`);
            this.emit("uploadCompleted", { recordingId, s3Url, fileSize });
            // Schedule local file cleanup after a delay (optional)
            this.scheduleLocalFileCleanup(localPath, recordingId);
        }
        catch (error) {
            console.error(`Upload failed for recording ${recordingId}:`, error);
            task.attempts++;
            if (task.attempts < this.maxRetries) {
                // Retry after delay
                console.log(`Retrying upload for recording ${recordingId} in ${this.retryDelay}ms`);
                setTimeout(() => {
                    this.uploadQueue.unshift(task); // Add back to front of queue
                }, this.retryDelay);
                await Recording_1.default.findOneAndUpdate({ id: recordingId }, {
                    uploadStatus: "failed",
                    uploadError: error instanceof Error ? error.message : String(error),
                });
            }
            else {
                // Max retries exceeded
                console.error(`Max retries exceeded for recording ${recordingId}`);
                await Recording_1.default.findOneAndUpdate({ id: recordingId }, {
                    uploadStatus: "failed",
                    uploadError: `Max retries (${this.maxRetries}) exceeded: ${error instanceof Error ? error.message : String(error)}`,
                });
                this.emit("uploadFailed", {
                    recordingId,
                    error: error instanceof Error ? error.message : String(error),
                    maxRetriesExceeded: true,
                });
            }
        }
    }
    /**
     * Schedule cleanup of local file after successful upload
     */
    scheduleLocalFileCleanup(localPath, recordingId, delayMs = 24 * 60 * 60 * 1000) {
        setTimeout(async () => {
            try {
                // Double-check that the recording was successfully uploaded
                const recording = await Recording_1.default.findOne({ id: recordingId });
                if (recording &&
                    recording.uploadStatus === "uploaded" &&
                    recording.s3Url) {
                    await fs_1.promises.unlink(localPath);
                    console.log(`Cleaned up local file for recording ${recordingId}: ${localPath}`);
                    this.emit("localFileCleanedUp", { recordingId, localPath });
                }
            }
            catch (error) {
                console.error(`Error cleaning up local file for recording ${recordingId}:`, error);
            }
        }, delayMs);
    }
    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.uploadQueue.length,
            activeUploads: this.activeUploads.size,
            isProcessing: this.isProcessing,
        };
    }
    /**
     * Get pending uploads for a specific recording
     */
    getPendingUpload(recordingId) {
        return (this.uploadQueue.find((task) => task.recordingId === recordingId) || null);
    }
    /**
     * Remove a recording from the upload queue
     */
    removeFromQueue(recordingId) {
        const initialLength = this.uploadQueue.length;
        this.uploadQueue = this.uploadQueue.filter((task) => task.recordingId !== recordingId);
        return this.uploadQueue.length < initialLength;
    }
    /**
     * Retry failed uploads
     */
    async retryFailedUploads() {
        const failedRecordings = await Recording_1.default.findReadyForUpload();
        for (const recording of failedRecordings) {
            try {
                await this.enqueueUpload(recording, 1); // High priority for retries
            }
            catch (error) {
                console.error(`Failed to re-queue recording ${recording.id}:`, error);
            }
        }
        console.log(`Re-queued ${failedRecordings.length} failed uploads`);
    }
    /**
     * Stop processing and clean up
     */
    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.isProcessing = false;
        console.log("Upload queue service stopped");
    }
}
exports.UploadQueueService = UploadQueueService;
exports.default = new UploadQueueService();
