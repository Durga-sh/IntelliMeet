"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recordingService_1 = __importDefault(require("../services/recordingService"));
const s3Service_1 = __importDefault(require("../services/s3Service"));
const router = (0, express_1.Router)();
// Test endpoint - no auth required
router.get("/test", async (req, res) => {
    res.json({
        success: true,
        message: "Recording API is working!",
        timestamp: new Date().toISOString(),
    });
});
// Mock data for testing - no auth required
router.get("/mock-status/:roomId", async (req, res) => {
    const { roomId } = req.params;
    // Return mock recording status for testing
    const mockStatus = {
        recording: {
            id: `rec_${roomId}`,
            roomId: roomId,
            status: "recording", // Can be: recording, processing, completed, failed
            startTime: new Date(Date.now() - 30000).toISOString(), // Started 30 seconds ago
            endTime: null,
            duration: null,
            participants: ["user1", "user2"],
        },
        storage: {
            isStored: false,
            s3Url: null,
            s3Key: null,
            fileSize: 0,
        },
        progress: {
            isRecording: true,
            isProcessing: false,
            isCompleted: false,
            isFailed: false,
            canDownload: false,
        },
    };
    res.json({
        success: true,
        data: mockStatus,
    });
});
// Get all recordings (temporarily disabled auth for testing)
router.get("/", async (req, res) => {
    try {
        const recordings = recordingService_1.default.getAllRecordings();
        res.json({
            success: true,
            data: recordings,
        });
    }
    catch (error) {
        console.error("Error fetching recordings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch recordings",
        });
    }
});
// Get recording by room ID
router.get("/room/:roomId", async (req, res) => {
    try {
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
    }
    catch (error) {
        console.error("Error fetching recording:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch recording",
        });
    }
});
// Get completed recordings
router.get("/completed", async (req, res) => {
    try {
        const recordings = recordingService_1.default.getCompletedRecordings();
        res.json({
            success: true,
            data: recordings,
        });
    }
    catch (error) {
        console.error("Error fetching completed recordings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch completed recordings",
        });
    }
});
// Get active recordings
router.get("/active", async (req, res) => {
    try {
        const recordings = recordingService_1.default.getActiveRecordings();
        res.json({
            success: true,
            data: recordings,
        });
    }
    catch (error) {
        console.error("Error fetching active recordings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch active recordings",
        });
    }
});
// Start recording
router.post("/start/:roomId", async (req, res) => {
    try {
        console.log("Recording start request received for room:", req.params.roomId);
        const { roomId } = req.params;
        const { participants = [] } = req.body;
        const recording = await recordingService_1.default.startRecording(roomId, participants);
        res.json({
            success: true,
            data: recording,
            message: "Recording started successfully",
        });
    }
    catch (error) {
        console.error("Error starting recording:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to start recording",
        });
    }
});
// Stop recording
router.post("/stop/:roomId", async (req, res) => {
    try {
        console.log("Recording stop request received for room:", req.params.roomId);
        const { roomId } = req.params;
        const recording = await recordingService_1.default.stopRecording(roomId);
        res.json({
            success: true,
            data: recording,
            message: "Recording stopped successfully",
        });
    }
    catch (error) {
        console.error("Error stopping recording:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to stop recording",
        });
    }
}); // Get download URL for recording
router.get("/download/:roomId", async (req, res) => {
    try {
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
    }
    catch (error) {
        console.error("Error getting download URL:", error);
        res.status(404).json({
            success: false,
            message: error.message || "Failed to get download URL",
        });
    }
});
// Delete recording
router.delete("/:roomId", async (req, res) => {
    try {
        const { roomId } = req.params;
        await recordingService_1.default.deleteRecording(roomId);
        res.json({
            success: true,
            message: "Recording deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting recording:", error);
        res.status(404).json({
            success: false,
            message: error.message || "Failed to delete recording",
        });
    }
});
// Get recording status with detailed information
router.get("/status/:roomId", async (req, res) => {
    try {
        const { roomId } = req.params;
        const recording = recordingService_1.default.getRecording(roomId);
        if (!recording) {
            return res.status(404).json({
                success: false,
                message: "Recording not found",
            });
        }
        // Check if file exists in S3
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
    }
    catch (error) {
        console.error("Error fetching recording status:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch recording status",
        });
    }
});
// Check if recording is stored in cloud
router.get("/storage/:roomId", async (req, res) => {
    try {
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
    }
    catch (error) {
        console.error("Error checking storage status:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to check storage status",
        });
    }
});
// Get recording progress
router.get("/progress/:roomId", async (req, res) => {
    try {
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
                progressPercentage = 25;
                currentStep = "Recording in progress";
                break;
            case "processing":
                progressPercentage = 75;
                currentStep = "Processing video";
                break;
            case "completed":
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
            progressPercentage,
            currentStep,
            startTime: recording.startTime,
            endTime: recording.endTime,
            duration: recording.duration,
            participants: recording.participants.length,
            isRecording: recording.status === "recording",
            isProcessing: recording.status === "processing",
            isCompleted: recording.status === "completed",
            isFailed: recording.status === "failed",
        };
        res.json({
            success: true,
            data: progressData,
        });
    }
    catch (error) {
        console.error("Error fetching recording progress:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch recording progress",
        });
    }
});
// Get recording statistics
router.get("/stats", async (req, res) => {
    try {
        const stats = recordingService_1.default.getStatistics();
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        console.error("Error fetching recording statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch recording statistics",
        });
    }
});
// List S3 recordings
router.get("/s3/list", async (req, res) => {
    try {
        const { prefix = "recordings/" } = req.query;
        const files = await s3Service_1.default.listFiles(prefix);
        res.json({
            success: true,
            data: files,
        });
    }
    catch (error) {
        console.error("Error listing S3 recordings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to list S3 recordings",
        });
    }
});
// Cleanup old recordings
router.post("/cleanup", async (req, res) => {
    try {
        const { daysOld = 30 } = req.body;
        await recordingService_1.default.cleanupOldRecordings(daysOld);
        res.json({
            success: true,
            message: `Cleaned up recordings older than ${daysOld} days`,
        });
    }
    catch (error) {
        console.error("Error cleaning up recordings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cleanup recordings",
        });
    }
});
exports.default = router;
