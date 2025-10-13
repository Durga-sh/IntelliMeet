"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recordingService_1 = __importDefault(require("../services/recordingService"));
const s3Service_1 = __importDefault(require("../services/s3Service"));
const router = (0, express_1.Router)();
// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// Test endpoint
router.get("/test", asyncHandler(async (req, res) => {
    res.json({
        success: true,
        message: "Recording API is working!",
        timestamp: new Date().toISOString(),
    });
}));
// Create room endpoint
router.post("/create-room/:roomId", asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const mediasoupService = require("../services/mediasoupService").default;
    try {
        await mediasoupService.createRoom(roomId);
        res.json({
            success: true,
            message: `Room ${roomId} created successfully`,
            roomId: roomId,
        });
    }
    catch (error) {
        if (error.message && error.message.includes("already exists")) {
            res.json({
                success: true,
                message: `Room ${roomId} already exists`,
                roomId: roomId,
            });
        }
        else {
            throw error;
        }
    }
}));
// Get all recordings
router.get("/", asyncHandler(async (req, res) => {
    const recordings = recordingService_1.default.getAllRecordings();
    res.json({
        success: true,
        data: recordings,
    });
}));
// Get recording by room ID
router.get("/room/:roomId", asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const recording = recordingService_1.default.getRecording(roomId);
    if (!recording) {
        return res.status(404).json({
            success: false,
            message: "Recording not found",
        });
    }
    res.json({
        success: true,
        data: recording,
    });
}));
// Get completed recordings
router.get("/completed", asyncHandler(async (req, res) => {
    const recordings = recordingService_1.default.getCompletedRecordings();
    res.json({
        success: true,
        data: recordings,
    });
}));
// Get active recordings
router.get("/active", asyncHandler(async (req, res) => {
    const recordings = recordingService_1.default.getActiveRecordings();
    res.json({
        success: true,
        data: recordings,
    });
}));
// Start recording
router.post("/start/:roomId", asyncHandler(async (req, res) => {
    console.log("Recording start request received for room:", req.params.roomId);
    const { roomId } = req.params;
    const { participants = [] } = req.body;
    const recording = await recordingService_1.default.startRecording(roomId, participants);
    res.json({
        success: true,
        data: recording,
        message: "Recording started successfully",
    });
}));
// Stop recording
router.post("/stop/:roomId", asyncHandler(async (req, res) => {
    console.log("Recording stop request received for room:", req.params.roomId);
    const { roomId } = req.params;
    const recording = await recordingService_1.default.stopRecording(roomId);
    res.json({
        success: true,
        data: recording,
        message: "Recording stopped successfully",
    });
}));
// Get download URL for recording
router.get("/download/:roomId", asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const { expiresIn = 3600 } = req.query;
    const downloadUrl = await recordingService_1.default.getRecordingDownloadUrl(roomId, parseInt(expiresIn));
    res.json({
        success: true,
        data: {
            downloadUrl,
            expiresIn: parseInt(expiresIn),
        },
    });
}));
// Delete recording
router.delete("/:roomId", asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    await recordingService_1.default.deleteRecording(roomId);
    res.json({
        success: true,
        message: "Recording deleted successfully",
    });
}));
// Get recording status with detailed information
router.get("/status/:roomId", asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const recording = recordingService_1.default.getRecording(roomId);
    if (!recording) {
        return res.status(404).json({
            success: false,
            message: "Recording not found",
        });
    }
    let isStored = false;
    let fileSize = 0;
    if (recording.s3Key) {
        try {
            const s3Stats = await s3Service_1.default.getFileStats(recording.s3Key);
            isStored = true;
            fileSize = s3Stats.size;
        }
        catch (error) {
            console.log(`File not found in S3: ${recording.s3Key}`);
        }
    }
    const statusResponse = {
        recording: {
            id: recording.id,
            roomId: recording.roomId,
            status: recording.status,
            startTime: recording.startTime,
            endTime: recording.endTime,
            duration: recording.duration,
            participants: recording.participants,
        },
        storage: {
            isStored,
            s3Url: recording.s3Url,
            s3Key: recording.s3Key,
            fileSize,
        },
        progress: {
            isRecording: recording.status === "recording",
            isProcessing: recording.status === "processing",
            isCompleted: recording.status === "completed",
            isFailed: recording.status === "failed",
            canDownload: recording.status === "completed" && isStored,
        },
    };
    res.json({
        success: true,
        data: statusResponse,
    });
}));
// Check if recording is stored in cloud
router.get("/storage/:roomId", asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const recording = recordingService_1.default.getRecording(roomId);
    if (!recording) {
        return res.status(404).json({
            success: false,
            message: "Recording not found",
        });
    }
    if (!recording.s3Key) {
        return res.json({
            success: true,
            data: {
                isStored: false,
                message: "Recording not yet uploaded to cloud storage",
            },
        });
    }
    try {
        const fileStats = await s3Service_1.default.getFileStats(recording.s3Key);
        res.json({
            success: true,
            data: {
                isStored: true,
                s3Key: recording.s3Key,
                s3Url: recording.s3Url,
                fileSize: fileStats.size,
                lastModified: fileStats.lastModified,
            },
        });
    }
    catch (error) {
        res.json({
            success: true,
            data: {
                isStored: false,
                message: "File not found in cloud storage",
            },
        });
    }
}));
// Get recording progress
router.get("/progress/:roomId", asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    const recording = recordingService_1.default.getRecording(roomId);
    if (!recording) {
        return res.status(404).json({
            success: false,
            message: "Recording not found",
        });
    }
    let progressPercentage = 0;
    let currentStep = "Not Started";
    switch (recording.status) {
        case "recording":
            progressPercentage = 50;
            currentStep = "Recording in progress";
            break;
        case "processing":
            progressPercentage = 75;
            currentStep = "Processing video";
            break;
        case "completed":
            progressPercentage = 100;
            currentStep = "Recording completed and saved locally";
            break;
        case "local":
            progressPercentage = 100;
            currentStep = "Recording saved locally";
            break;
        case "uploaded":
            progressPercentage = 100;
            currentStep = "Recording completed";
            break;
        case "failed":
            progressPercentage = 0;
            currentStep = "Recording failed";
            break;
    }
    const progressData = {
        roomId,
        status: recording.status,
        uploadStatus: recording.uploadStatus,
        progressPercentage,
        currentStep,
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.duration,
        participants: recording.participants.length,
        isRecording: recording.status === "recording",
        isProcessing: recording.status === "processing",
        isLocal: recording.status === "local",
        isUploading: recording.status === "uploading",
        isCompleted: recording.status === "completed" || recording.status === "uploaded",
        isFailed: recording.status === "failed",
        localPath: recording.localPath,
        s3Url: recording.s3Url,
        fileSize: recording.fileSize,
    };
    res.json({
        success: true,
        data: progressData,
    });
}));
// Get recording statistics
router.get("/stats", asyncHandler(async (req, res) => {
    const stats = recordingService_1.default.getStatistics();
    res.json({
        success: true,
        data: stats,
    });
}));
// List S3 recordings
router.get("/s3/list", asyncHandler(async (req, res) => {
    const { prefix = "recordings/" } = req.query;
    const files = await s3Service_1.default.listFiles(prefix);
    res.json({
        success: true,
        data: files,
    });
}));
// Cleanup old recordings
router.post("/cleanup", asyncHandler(async (req, res) => {
    const { daysOld = 30 } = req.body;
    await recordingService_1.default.cleanupOldRecordings(daysOld);
    res.json({
        success: true,
        message: `Cleaned up recordings older than ${daysOld} days`,
    });
}));
// Get upload queue status
router.get("/upload-queue/status", asyncHandler(async (req, res) => {
    const status = recordingService_1.default.getUploadQueueStatus();
    res.json({
        success: true,
        data: status,
    });
}));
// Manually trigger upload for a recording
router.post("/upload/:recordingId", asyncHandler(async (req, res) => {
    const { recordingId } = req.params;
    const { priority = 5 } = req.body;
    await recordingService_1.default.uploadRecording(recordingId, priority);
    res.json({
        success: true,
        message: `Recording ${recordingId} queued for upload`,
    });
}));
// Retry failed uploads
router.post("/upload/retry-failed", asyncHandler(async (req, res) => {
    await recordingService_1.default.retryFailedUploads();
    res.json({
        success: true,
        message: "Failed uploads have been re-queued",
    });
}));
// Get recordings by upload status
router.get("/upload-status/:status", asyncHandler(async (req, res) => {
    const { status } = req.params;
    if (!["pending", "queued", "uploading", "uploaded", "failed"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid upload status",
        });
    }
    const recordings = await recordingService_1.default.getRecordingsByUploadStatus(status);
    res.json({
        success: true,
        data: recordings,
    });
}));
// Global error handler for this router
router.use((error, req, res, next) => {
    console.error("Recording API Error:", error);
    res.status(error.status || 500).json({
        success: false,
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
});
exports.default = router;
