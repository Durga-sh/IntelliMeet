#!/usr/bin/env node

/**
 * Recording Manager Utility
 *
 * This utility provides management commands for recordings:
 * - List local recordings
 * - Monitor upload queue
 * - Retry failed uploads
 * - Clean up old files
 */

import { promises as fs } from "fs";
import { join } from "path";
import Recording from "../models/Recording";
import uploadQueueService from "../services/uploadQueueService";
import recordingService from "../services/recordingService";
import connectDB from "../config/db";

class RecordingManager {
  private recordingsDir: string;

  constructor() {
    this.recordingsDir = join(process.cwd(), "recordings");
  }

  /**
   * List all local recording files
   */
  async listLocalFiles(): Promise<void> {
    try {
      console.log("\n📁 Local Recording Files:");
      console.log("========================");

      const files = await fs.readdir(this.recordingsDir);
      const videoFiles = files.filter((file) => file.endsWith(".mp4"));

      if (videoFiles.length === 0) {
        console.log("No local recording files found.");
        return;
      }

      for (const file of videoFiles) {
        const filePath = join(this.recordingsDir, file);
        const stats = await fs.stat(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`📄 ${file}`);
        console.log(`   Size: ${sizeInMB} MB`);
        console.log(`   Created: ${stats.birthtime.toLocaleString()}`);
        console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
        console.log("");
      }
    } catch (error) {
      console.error("❌ Error listing local files:", error);
    }
  }

  /**
   * List all recordings in database with their status
   */
  async listDatabaseRecordings(): Promise<void> {
    try {
      console.log("\n💾 Database Recordings:");
      console.log("======================");

      const recordings = await Recording.find({})
        .sort({ createdAt: -1 })
        .limit(20);

      if (recordings.length === 0) {
        console.log("No recordings found in database.");
        return;
      }

      for (const recording of recordings) {
        console.log(`📹 Recording ID: ${recording.id}`);
        console.log(`   Room ID: ${recording.roomId}`);
        console.log(`   Status: ${recording.status}`);
        console.log(`   Upload Status: ${recording.uploadStatus}`);
        console.log(`   Local Path: ${recording.localPath || "N/A"}`);
        console.log(`   S3 URL: ${recording.s3Url || "N/A"}`);
        console.log(`   Created: ${recording.createdAt.toLocaleString()}`);

        if (recording.fileSize) {
          const sizeInMB = (recording.fileSize / (1024 * 1024)).toFixed(2);
          console.log(`   File Size: ${sizeInMB} MB`);
        }

        if (recording.uploadAttempts && recording.uploadAttempts > 0) {
          console.log(`   Upload Attempts: ${recording.uploadAttempts}`);
        }

        if (recording.uploadError) {
          console.log(`   Upload Error: ${recording.uploadError}`);
        }

        console.log("");
      }
    } catch (error) {
      console.error("❌ Error listing database recordings:", error);
    }
  }

  /**
   * Show upload queue status
   */
  async showUploadQueueStatus(): Promise<void> {
    try {
      console.log("\n⏫ Upload Queue Status:");
      console.log("======================");

      const status = recordingService.getUploadQueueStatus();

      console.log(`Queue Length: ${status.queueLength}`);
      console.log(`Active Uploads: ${status.activeUploads}`);
      console.log(`Is Processing: ${status.isProcessing}`);

      // Show pending uploads
      const pendingRecordings =
        await recordingService.getRecordingsByUploadStatus("pending");
      const queuedRecordings =
        await recordingService.getRecordingsByUploadStatus("queued");
      const uploadingRecordings =
        await recordingService.getRecordingsByUploadStatus("uploading");

      console.log(`\nPending: ${pendingRecordings.length} recordings`);
      console.log(`Queued: ${queuedRecordings.length} recordings`);
      console.log(`Uploading: ${uploadingRecordings.length} recordings`);

      if (queuedRecordings.length > 0) {
        console.log("\n📋 Queued Recordings:");
        queuedRecordings.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec.id} (Room: ${rec.roomId})`);
        });
      }
    } catch (error) {
      console.error("❌ Error getting upload queue status:", error);
    }
  }

  /**
   * Retry failed uploads
   */
  async retryFailedUploads(): Promise<void> {
    try {
      console.log("\n🔄 Retrying Failed Uploads...");
      console.log("==============================");

      const failedRecordings =
        await recordingService.getRecordingsByUploadStatus("failed");

      if (failedRecordings.length === 0) {
        console.log("✅ No failed uploads to retry.");
        return;
      }

      console.log(`Found ${failedRecordings.length} failed uploads`);

      for (const recording of failedRecordings) {
        console.log(`🔄 Retrying: ${recording.id}`);
        try {
          await recordingService.uploadRecording(recording.id, 1); // High priority
          console.log(`✅ Queued: ${recording.id}`);
        } catch (error: any) {
          console.log(`❌ Failed to queue: ${recording.id} - ${error.message}`);
        }
      }
    } catch (error) {
      console.error("❌ Error retrying failed uploads:", error);
    }
  }

  /**
   * Clean up old local files
   */
  async cleanupOldFiles(daysOld: number = 7): Promise<void> {
    try {
      console.log(`\n🧹 Cleaning up files older than ${daysOld} days...`);
      console.log("================================================");

      const files = await fs.readdir(this.recordingsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith(".mp4")) {
          const filePath = join(this.recordingsDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            // Check if this file is uploaded to S3
            const recording = await Recording.findOne({
              localPath: filePath,
              uploadStatus: "uploaded",
            });

            if (recording && recording.s3Url) {
              await fs.unlink(filePath);
              console.log(`🗑️  Deleted: ${file} (uploaded to S3)`);
              deletedCount++;
            } else {
              console.log(`⚠️  Skipped: ${file} (not uploaded to S3 yet)`);
            }
          }
        }
      }

      console.log(`\n✅ Cleanup completed. Deleted ${deletedCount} files.`);
    } catch (error) {
      console.error("❌ Error cleaning up old files:", error);
    }
  }

  /**
   * Show recording statistics
   */
  async showStatistics(): Promise<void> {
    try {
      console.log("\n📊 Recording Statistics:");
      console.log("========================");

      const stats = recordingService.getStatistics();

      console.log(`Total Recordings: ${stats.total}`);
      console.log(`Active: ${stats.active}`);
      console.log(`Processing: ${stats.processing}`);
      console.log(`Local: ${stats.local}`);
      console.log(`Uploading: ${stats.uploading}`);
      console.log(`Uploaded: ${stats.uploaded}`);
      console.log(`Failed: ${stats.failed}`);

      // Database statistics
      const dbStats = await Promise.all([
        Recording.countDocuments({ status: "recording" }),
        Recording.countDocuments({ status: "local" }),
        Recording.countDocuments({ status: "uploaded" }),
        Recording.countDocuments({ uploadStatus: "failed" }),
        Recording.countDocuments({ uploadStatus: "pending" }),
      ]);

      console.log(`\n💾 Database Statistics:`);
      console.log(`Recording: ${dbStats[0]}`);
      console.log(`Local: ${dbStats[1]}`);
      console.log(`Uploaded: ${dbStats[2]}`);
      console.log(`Upload Failed: ${dbStats[3]}`);
      console.log(`Upload Pending: ${dbStats[4]}`);
    } catch (error) {
      console.error("❌ Error getting statistics:", error);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Connect to database
  await connectDB();

  const manager = new RecordingManager();

  switch (command) {
    case "list-local":
      await manager.listLocalFiles();
      break;

    case "list-db":
      await manager.listDatabaseRecordings();
      break;

    case "queue-status":
      await manager.showUploadQueueStatus();
      break;

    case "retry-failed":
      await manager.retryFailedUploads();
      break;

    case "cleanup":
      const days = parseInt(args[1]) || 7;
      await manager.cleanupOldFiles(days);
      break;

    case "stats":
      await manager.showStatistics();
      break;

    case "monitor":
      // Continuous monitoring
      console.log("🔍 Monitoring recording system (Press Ctrl+C to stop)...\n");
      setInterval(async () => {
        console.clear();
        console.log("📹 IntelliMeet Recording Monitor");
        console.log("================================");
        console.log(`Last updated: ${new Date().toLocaleString()}\n`);

        await manager.showStatistics();
        await manager.showUploadQueueStatus();
      }, 5000);
      break;

    default:
      console.log(`
📹 IntelliMeet Recording Manager
================================

Usage: node recording-manager.js <command> [options]

Commands:
  list-local          List all local recording files
  list-db             List all recordings in database
  queue-status        Show upload queue status
  retry-failed        Retry all failed uploads
  cleanup [days]      Clean up old local files (default: 7 days)
  stats               Show recording statistics
  monitor             Start continuous monitoring

Examples:
  node recording-manager.js list-local
  node recording-manager.js cleanup 14
  node recording-manager.js monitor
      `);
      break;
  }

  // Exit unless monitoring
  if (command !== "monitor") {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}

export default RecordingManager;
