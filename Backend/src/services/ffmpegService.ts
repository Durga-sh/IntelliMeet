import ffmpeg from "fluent-ffmpeg";
import { EventEmitter } from "events";
import { join } from "path";
import { promises as fs } from "fs";
import s3Service from "./s3Service";

export interface FFmpegProcessOptions {
  roomId: string;
  audioPort: number;
  videoPort: number;
  outputPath?: string;
  duration?: number; // in seconds, if not provided, recording continues until stopped
}

export class FFmpegService extends EventEmitter {
  private activeProcesses: Map<string, ffmpeg.FfmpegCommand> = new Map();
  private recordingsDir: string;

  constructor() {
    super();
    this.recordingsDir = join(process.cwd(), "recordings");
    this.ensureRecordingsDir();
  }

  private async ensureRecordingsDir(): Promise<void> {
    try {
      await fs.access(this.recordingsDir);
    } catch {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    }
  }

  /**
   * Start recording a room's media streams
   */
  async startRecording(options: FFmpegProcessOptions): Promise<string> {
    const { roomId, audioPort, videoPort, duration } = options;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFilename = `${roomId}_${timestamp}.mp4`;
    const outputPath = join(this.recordingsDir, outputFilename);

    try {
      // Create FFmpeg command
      const command = ffmpeg();

      // Add audio input (RTP)
      command
        .input(`rtp://127.0.0.1:${audioPort}`)
        .inputOptions(["-protocol_whitelist", "file,udp,rtp", "-f", "rtp"]);

      // Add video input (RTP)
      command
        .input(`rtp://127.0.0.1:${videoPort}`)
        .inputOptions(["-protocol_whitelist", "file,udp,rtp", "-f", "rtp"]);

      // Output options
      command
        .outputOptions([
          "-c:v",
          "libx264", // Video codec
          "-preset",
          "medium", // Encoding preset
          "-crf",
          "23", // Constant Rate Factor (quality)
          "-c:a",
          "aac", // Audio codec
          "-ar",
          "48000", // Audio sample rate
          "-ac",
          "2", // Audio channels
          "-f",
          "mp4", // Output format
          "-movflags",
          "+faststart", // Enable fast start for web playback
        ])
        .output(outputPath);

      // Set duration if specified
      if (duration) {
        command.duration(duration);
      }

      // Handle events
      command
        .on("start", (commandLine) => {
          console.log(`FFmpeg started for room ${roomId}: ${commandLine}`);
          this.emit("recordingStarted", { roomId, outputPath });
        })
        .on("progress", (progress) => {
          this.emit("recordingProgress", { roomId, progress });
        })
        .on("end", async () => {
          console.log(`FFmpeg finished for room ${roomId}`);
          this.activeProcesses.delete(roomId);

          // Upload to S3
          try {
            const s3Key = `recordings/${outputFilename}`;
            const s3Url = await s3Service.uploadFile(outputPath, s3Key);
            this.emit("recordingCompleted", {
              roomId,
              outputPath,
              s3Url,
              s3Key,
            });
          } catch (error) {
            console.error("Failed to upload recording to S3:", error);
            this.emit("recordingError", { roomId, error });
          }
        })
        .on("error", (error) => {
          console.error(`FFmpeg error for room ${roomId}:`, error);
          this.activeProcesses.delete(roomId);
          this.emit("recordingError", { roomId, error });
        });

      // Start the process
      command.run();

      // Store the process
      this.activeProcesses.set(roomId, command);

      return outputPath;
    } catch (error) {
      console.error("Error starting FFmpeg recording:", error);
      throw error;
    }
  }

  /**
   * Stop recording for a specific room
   */
  async stopRecording(roomId: string): Promise<void> {
    const process = this.activeProcesses.get(roomId);
    if (process) {
      try {
        process.kill("SIGINT"); // Graceful termination
        this.activeProcesses.delete(roomId);
        this.emit("recordingStopped", { roomId });
      } catch (error) {
        console.error(`Error stopping recording for room ${roomId}:`, error);
        throw error;
      }
    } else {
      console.warn(`No active recording found for room ${roomId}`);
    }
  }

  /**
   * Stop all active recordings
   */
  async stopAllRecordings(): Promise<void> {
    const promises = Array.from(this.activeProcesses.keys()).map((roomId) =>
      this.stopRecording(roomId).catch((error) =>
        console.error(`Error stopping recording for room ${roomId}:`, error)
      )
    );
    await Promise.all(promises);
  }

  /**
   * Get active recordings
   */
  getActiveRecordings(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Check if recording is active for a room
   */
  isRecording(roomId: string): boolean {
    return this.activeProcesses.has(roomId);
  }

  /**
   * Create SDP file for FFmpeg input
   */
  createSDP(audioPort: number, videoPort: number): string {
    return `v=0
o=- 0 0 IN IP4 127.0.0.1
s=FFmpeg
c=IN IP4 127.0.0.1
t=0 0
m=audio ${audioPort} RTP/AVP 111
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
m=video ${videoPort} RTP/AVP 96
a=rtpmap:96 VP8/90000
a=ssrc:1 cname:ARDAMS
a=ssrc:1 msid:ARDAMS ARDAMSv0
a=ssrc:1 mslabel:ARDAMS
a=ssrc:1 label:ARDAMSv0`;
  }

  /**
   * Clean up old recording files (older than specified days)
   */
  async cleanupOldRecordings(daysOld: number = 7): Promise<void> {
    try {
      const files = await fs.readdir(this.recordingsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      for (const file of files) {
        if (file.endsWith(".mp4")) {
          const filePath = join(this.recordingsDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`Deleted old recording: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning up old recordings:", error);
    }
  }
}

export default new FFmpegService();
