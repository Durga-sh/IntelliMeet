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
const FFMPEG_PATHS = [
    `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-essentials_build\\bin\\ffmpeg.exe`,
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
    "C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe",
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
        this.sdpDir = (0, path_1.join)(process.cwd(), "sdp");
        this.ffmpegPath = findFFmpegPath();
        fluent_ffmpeg_1.default.setFfmpegPath(this.ffmpegPath);
        this.ensureDirectories();
    }
    async ensureDirectories() {
        try {
            await fs_1.promises.access(this.recordingsDir);
        }
        catch {
            await fs_1.promises.mkdir(this.recordingsDir, { recursive: true });
        }
        try {
            await fs_1.promises.access(this.sdpDir);
        }
        catch {
            await fs_1.promises.mkdir(this.sdpDir, { recursive: true });
        }
    }
    /**
     * Create SDP file for receiving RTP streams from mediasoup
     */
    createSDP(audioPort, videoPort) {
        return `v=0
o=- 0 0 IN IP4 127.0.0.1
s=FFmpeg Recording
c=IN IP4 127.0.0.1
t=0 0
m=audio ${audioPort} RTP/AVP 111
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
m=video ${videoPort} RTP/AVP 96
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtcp-fb:96 ccm fir`;
    }
    async startRecording(options) {
        const { roomId, audioPort, videoPort, duration } = options;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const outputFilename = `${roomId}_${timestamp}.mp4`;
        const outputPath = (0, path_1.join)(this.recordingsDir, outputFilename);
        const sdpPath = (0, path_1.join)(this.sdpDir, `${roomId}.sdp`);
        try {
            // Create SDP file
            const sdpContent = this.createSDP(audioPort, videoPort);
            (0, fs_2.writeFileSync)(sdpPath, sdpContent);
            console.log(`📝 Created SDP file: ${sdpPath}`);
            console.log(`   Audio port: ${audioPort}, Video port: ${videoPort}`);
            // Create FFmpeg command
            const command = (0, fluent_ffmpeg_1.default)();
            // Input from SDP file
            command
                .input(sdpPath)
                .inputOptions([
                "-protocol_whitelist",
                "file,rtp,udp",
                "-analyzeduration",
                "10000000",
                "-probesize",
                "10000000",
                "-fflags",
                "+genpts",
                "-use_wallclock_as_timestamps",
                "1",
            ]);
            // Output options
            command
                .outputOptions([
                "-map",
                "0:a:0",
                "-map",
                "0:v:0",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-tune",
                "zerolatency",
                "-crf",
                "28",
                "-maxrate",
                "2M",
                "-bufsize",
                "4M",
                "-c:a",
                "aac",
                "-ar",
                "48000",
                "-ac",
                "2",
                "-b:a",
                "128k",
                "-f",
                "mp4",
                "-movflags",
                "+faststart+frag_keyframe+empty_moov",
                "-threads",
                "0",
                "-y",
            ])
                .output(outputPath);
            if (duration) {
                command.duration(duration);
            }
            command
                .on("start", (commandLine) => {
                console.log(`✅ FFmpeg started for room ${roomId}`);
                console.log(`🎬 Command: ${commandLine.substring(0, 200)}...`);
                console.log(`📁 Output: ${outputPath}`);
                this.emit("recordingStarted", { roomId, outputPath });
            })
                .on("progress", (progress) => {
                if (progress.timemark && progress.frames > 0) {
                    console.log(`🎥 Recording ${roomId}: ${progress.timemark} (${progress.frames} frames)`);
                }
                this.emit("recordingProgress", { roomId, progress });
            })
                .on("end", async () => {
                console.log(`🎬 FFmpeg finished for room ${roomId}`);
                this.activeProcesses.delete(roomId);
                // Clean up SDP
                try {
                    if ((0, fs_2.existsSync)(sdpPath))
                        (0, fs_2.unlinkSync)(sdpPath);
                }
                catch (err) {
                    console.error("Error deleting SDP:", err);
                }
                try {
                    const stats = await fs_1.promises.stat(outputPath);
                    const fileSize = stats.size;
                    console.log(`✅ Recording completed: ${outputPath}`);
                    console.log(`📊 File size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
                    if (fileSize > 10000) {
                        console.log(`✅ Recording has content`);
                    }
                    else {
                        console.warn(`⚠️ Recording file is very small (${fileSize} bytes)`);
                    }
                    this.emit("recordingCompleted", { roomId, outputPath, fileSize });
                }
                catch (error) {
                    console.error("❌ Failed to get file stats:", error);
                    this.emit("recordingError", { roomId, error });
                }
            })
                .on("error", (error) => {
                console.error(`❌ FFmpeg error for room ${roomId}:`, error);
                this.activeProcesses.delete(roomId);
                // Clean up
                try {
                    if ((0, fs_2.existsSync)(sdpPath))
                        (0, fs_2.unlinkSync)(sdpPath);
                }
                catch (err) {
                    console.error("Error deleting SDP:", err);
                }
                const errorString = error.toString();
                if (errorString.includes("SIGINT") ||
                    errorString.includes("SIGTERM")) {
                    console.log(`ℹ️ FFmpeg was stopped gracefully for room ${roomId}`);
                    this.emit("recordingStopped", { roomId });
                }
                else {
                    this.emit("recordingError", { roomId, error });
                }
            });
            command.run();
            this.activeProcesses.set(roomId, command);
            return outputPath;
        }
        catch (error) {
            console.error("Error starting FFmpeg:", error);
            try {
                if ((0, fs_2.existsSync)(sdpPath))
                    (0, fs_2.unlinkSync)(sdpPath);
            }
            catch (err) {
                // Ignore
            }
            throw error;
        }
    }
    async stopRecording(roomId) {
        const process = this.activeProcesses.get(roomId);
        if (process) {
            try {
                process.kill("SIGINT");
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
    async stopAllRecordings() {
        const promises = Array.from(this.activeProcesses.keys()).map((roomId) => this.stopRecording(roomId).catch((error) => console.error(`Error stopping recording for room ${roomId}:`, error)));
        await Promise.all(promises);
    }
    getActiveRecordings() {
        return Array.from(this.activeProcesses.keys());
    }
    isRecording(roomId) {
        return this.activeProcesses.has(roomId);
    }
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
