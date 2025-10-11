"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpegService = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const events_1 = require("events");
const path_1 = require("path");
const fs_1 = require("fs");
const fs_2 = require("fs");
// Configure FFmpeg binary path
const FFMPEG_PATHS = [
    // Winget installation path
    `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-essentials_build\\bin\\ffmpeg.exe`,
    // Common manual installation paths
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
    "C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe",
    // Try system PATH
    "ffmpeg",
];
function findFFmpegPath() {
    for (const path of FFMPEG_PATHS) {
        if (path === "ffmpeg" || (0, fs_2.existsSync)(path)) {
            console.log(`Using FFmpeg at: ${path}`);
            return path;
        }
    }
    throw new Error("FFmpeg not found. Please install FFmpeg and ensure it's in your PATH.");
}
class FFmpegService extends events_1.EventEmitter {
    constructor() {
        super();
        this.activeProcesses = new Map();
        this.recordingsDir = (0, path_1.join)(process.cwd(), "recordings");
        this.ffmpegPath = findFFmpegPath();
        fluent_ffmpeg_1.default.setFfmpegPath(this.ffmpegPath);
        this.ensureRecordingsDir();
    }
    async ensureRecordingsDir() {
        try {
            await fs_1.promises.access(this.recordingsDir);
        }
        catch {
            await fs_1.promises.mkdir(this.recordingsDir, { recursive: true });
        }
    }
    /**
     * Start recording a room's media streams
     */
    async startRecording(options) {
        const { roomId, audioPort, videoPort, duration } = options;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const outputFilename = `${roomId}_${timestamp}.mp4`;
        const outputPath = (0, path_1.join)(this.recordingsDir, outputFilename);
        try {
            // Create FFmpeg command
            const command = (0, fluent_ffmpeg_1.default)();
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
                // Store locally only (no S3 upload)
                try {
                    // Get file size
                    const stats = await require("fs").promises.stat(outputPath);
                    const fileSize = stats.size;
                    console.log(`Recording completed: ${outputPath} (${fileSize} bytes)`);
                    this.emit("recordingCompleted", {
                        roomId,
                        outputPath,
                        fileSize,
                    });
                }
                catch (error) {
                    console.error("Failed to get recording file stats:", error);
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
        }
        catch (error) {
            console.error("Error starting FFmpeg recording:", error);
            throw error;
        }
    }
    /**
     * Stop recording for a specific room
     */
    async stopRecording(roomId) {
        const process = this.activeProcesses.get(roomId);
        if (process) {
            try {
                process.kill("SIGINT"); // Graceful termination
                this.activeProcesses.delete(roomId);
                this.emit("recordingStopped", { roomId });
            }
            catch (error) {
                console.error(`Error stopping recording for room ${roomId}:`, error);
                throw error;
            }
        }
        else {
            console.warn(`No active recording found for room ${roomId}`);
        }
    }
    /**
     * Stop all active recordings
     */
    async stopAllRecordings() {
        const promises = Array.from(this.activeProcesses.keys()).map((roomId) => this.stopRecording(roomId).catch((error) => console.error(`Error stopping recording for room ${roomId}:`, error)));
        await Promise.all(promises);
    }
    /**
     * Get active recordings
     */
    getActiveRecordings() {
        return Array.from(this.activeProcesses.keys());
    }
    /**
     * Check if recording is active for a room
     */
    isRecording(roomId) {
        return this.activeProcesses.has(roomId);
    }
    /**
     * Create SDP file for FFmpeg input
     */
    createSDP(audioPort, videoPort) {
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
    async cleanupOldRecordings(daysOld = 7) {
        try {
            const files = await fs_1.promises.readdir(this.recordingsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            for (const file of files) {
                if (file.endsWith(".mp4")) {
                    const filePath = (0, path_1.join)(this.recordingsDir, file);
                    const stats = await fs_1.promises.stat(filePath);
                    if (stats.mtime < cutoffDate) {
                        await fs_1.promises.unlink(filePath);
                        console.log(`Deleted old recording: ${file}`);
                    }
                }
            }
        }
        catch (error) {
            console.error("Error cleaning up old recordings:", error);
        }
    }
}
exports.FFmpegService = FFmpegService;
exports.default = new FFmpegService();
