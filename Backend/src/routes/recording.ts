import { Router, Request, Response } from "express";
import recordingService from "../services/recordingService";
import s3Service from "../services/s3Service";
import { isAuthenticated } from "../middleware/auth";

// Interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    role: string;
    name?: string;
  };
}

const router = Router();

// Test endpoint - no auth required
router.get("/test", async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Recording API is working!",
    timestamp: new Date().toISOString(),
  });
});

// Temporary endpoint to create rooms for testing - no auth required
router.post("/create-room/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const mediasoupService = require("../services/mediasoupService").default;

    await mediasoupService.createRoom(roomId);

    res.json({
      success: true,
      message: `Room ${roomId} created successfully`,
      roomId: roomId,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("already exists")) {
      res.json({
        success: true,
        message: `Room ${req.params.roomId} already exists`,
        roomId: req.params.roomId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create room",
      });
    }
  }
});

// Mock data for testing - no auth required
router.get("/mock-status/:roomId", async (req: Request, res: Response) => {
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
router.get("/", async (req: Request, res: Response) => {
  try {
    const recordings = recordingService.getAllRecordings();
    res.json({
      success: true,
      data: recordings,
    });
  } catch (error) {
    console.error("Error fetching recordings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recordings",
    });
  }
});

// Get recording by room ID
router.get("/room/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const recording = recordingService.getRecording(roomId);

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
  } catch (error) {
    console.error("Error fetching recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recording",
    });
  }
});

// Get completed recordings
router.get("/completed", async (req: Request, res: Response) => {
  try {
    const recordings = recordingService.getCompletedRecordings();
    res.json({
      success: true,
      data: recordings,
    });
  } catch (error) {
    console.error("Error fetching completed recordings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch completed recordings",
    });
  }
});

// Get active recordings
router.get("/active", async (req: Request, res: Response) => {
  try {
    const recordings = recordingService.getActiveRecordings();
    res.json({
      success: true,
      data: recordings,
    });
  } catch (error) {
    console.error("Error fetching active recordings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active recordings",
    });
  }
});

// Start recording
router.post("/start/:roomId", async (req: Request, res: Response) => {
  try {
    console.log(
      "Recording start request received for room:",
      req.params.roomId
    );
    const { roomId } = req.params;
    const { participants = [] } = req.body;

    const recording = await recordingService.startRecording(
      roomId,
      participants
    );

    res.json({
      success: true,
      data: recording,
      message: "Recording started successfully",
    });
  } catch (error: any) {
    console.error("Error starting recording:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to start recording",
    });
  }
});

// Stop recording
router.post("/stop/:roomId", async (req: Request, res: Response) => {
  try {
    console.log("Recording stop request received for room:", req.params.roomId);
    const { roomId } = req.params;

    const recording = await recordingService.stopRecording(roomId);

    res.json({
      success: true,
      data: recording,
      message: "Recording stopped successfully",
    });
  } catch (error: any) {
    console.error("Error stopping recording:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to stop recording",
    });
  }
}); // Get download URL for recording
router.get("/download/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { expiresIn = 3600 } = req.query;

    const downloadUrl = await recordingService.getRecordingDownloadUrl(
      roomId,
      parseInt(expiresIn as string)
    );

    res.json({
      success: true,
      data: {
        downloadUrl,
        expiresIn: parseInt(expiresIn as string),
      },
    });
  } catch (error: any) {
    console.error("Error getting download URL:", error);
    res.status(404).json({
      success: false,
      message: error.message || "Failed to get download URL",
    });
  }
});

// Delete recording
router.delete("/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    await recordingService.deleteRecording(roomId);

    res.json({
      success: true,
      message: "Recording deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting recording:", error);
    res.status(404).json({
      success: false,
      message: error.message || "Failed to delete recording",
    });
  }
});

// Get recording status with detailed information
router.get("/status/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const recording = recordingService.getRecording(roomId);

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
        const s3Stats = await s3Service.getFileStats(recording.s3Key);
        isStored = true;
        fileSize = s3Stats.size;
      } catch (error) {
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
  } catch (error: any) {
    console.error("Error fetching recording status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch recording status",
    });
  }
});

// Check if recording is stored in cloud
router.get("/storage/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const recording = recordingService.getRecording(roomId);

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
      const fileStats = await s3Service.getFileStats(recording.s3Key);
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
    } catch (error) {
      res.json({
        success: true,
        data: {
          isStored: false,
          message: "File not found in cloud storage",
        },
      });
    }
  } catch (error: any) {
    console.error("Error checking storage status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check storage status",
    });
  }
});

// Get recording progress
router.get("/progress/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const recording = recordingService.getRecording(roomId);

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
      isCompleted:
        recording.status === "completed" || recording.status === "uploaded",
      isFailed: recording.status === "failed",
      localPath: recording.localPath,
      s3Url: recording.s3Url,
      fileSize: recording.fileSize,
    };

    res.json({
      success: true,
      data: progressData,
    });
  } catch (error: any) {
    console.error("Error fetching recording progress:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch recording progress",
    });
  }
});

// Get recording statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = recordingService.getStatistics();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching recording statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recording statistics",
    });
  }
});

// List S3 recordings
router.get("/s3/list", async (req: Request, res: Response) => {
  try {
    const { prefix = "recordings/" } = req.query;
    const files = await s3Service.listFiles(prefix as string);

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error("Error listing S3 recordings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list S3 recordings",
    });
  }
});

// Cleanup old recordings
router.post("/cleanup", async (req: Request, res: Response) => {
  try {
    const { daysOld = 30 } = req.body;

    await recordingService.cleanupOldRecordings(daysOld);

    res.json({
      success: true,
      message: `Cleaned up recordings older than ${daysOld} days`,
    });
  } catch (error) {
    console.error("Error cleaning up recordings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup recordings",
    });
  }
});

// Get upload queue status
router.get("/upload-queue/status", async (req: Request, res: Response) => {
  try {
    const status = recordingService.getUploadQueueStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting upload queue status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get upload queue status",
    });
  }
});

// Manually trigger upload for a recording
router.post("/upload/:recordingId", async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const { priority = 5 } = req.body;

    await recordingService.uploadRecording(recordingId, priority);

    res.json({
      success: true,
      message: `Recording ${recordingId} queued for upload`,
    });
  } catch (error: any) {
    console.error("Error queuing recording for upload:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to queue recording for upload",
    });
  }
});

// Retry failed uploads
router.post("/upload/retry-failed", async (req: Request, res: Response) => {
  try {
    await recordingService.retryFailedUploads();

    res.json({
      success: true,
      message: "Failed uploads have been re-queued",
    });
  } catch (error) {
    console.error("Error retrying failed uploads:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retry failed uploads",
    });
  }
});

// Get recordings by upload status
router.get("/upload-status/:status", async (req: Request, res: Response) => {
  try {
    const { status } = req.params;

    if (
      !["pending", "queued", "uploading", "uploaded", "failed"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid upload status",
      });
    }

    const recordings = await recordingService.getRecordingsByUploadStatus(
      status as any
    );

    res.json({
      success: true,
      data: recordings,
    });
  } catch (error) {
    console.error("Error getting recordings by upload status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recordings by upload status",
    });
  }
});

export default router;
