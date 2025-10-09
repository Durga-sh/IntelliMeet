"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediasoupConfig = void 0;
const config_1 = __importDefault(require("./config"));
exports.mediasoupConfig = {
    // Worker settings
    worker: {
        rtcMinPort: config_1.default.MEDIASOUP_MIN_PORT,
        rtcMaxPort: config_1.default.MEDIASOUP_MAX_PORT,
        logLevel: "warn",
        logTags: [
            "info",
            "ice",
            "dtls",
            "rtp",
            "srtp",
            "rtcp",
            "rtx",
            "bwe",
            "score",
            "simulcast",
            "svc",
            "sctp",
        ],
    },
    // Router settings
    router: {
        mediaCodecs: [
            {
                kind: "audio",
                mimeType: "audio/opus",
                clockRate: 48000,
                channels: 2,
            },
            {
                kind: "video",
                mimeType: "video/VP8",
                clockRate: 90000,
                parameters: {
                    "x-google-start-bitrate": 1000,
                },
            },
            {
                kind: "video",
                mimeType: "video/VP9",
                clockRate: 90000,
                parameters: {
                    "profile-id": 2,
                    "x-google-start-bitrate": 1000,
                },
            },
            {
                kind: "video",
                mimeType: "video/h264",
                clockRate: 90000,
                parameters: {
                    "packetization-mode": 1,
                    "profile-level-id": "4d0032",
                    "level-asymmetry-allowed": 1,
                    "x-google-start-bitrate": 1000,
                },
            },
            {
                kind: "video",
                mimeType: "video/h264",
                clockRate: 90000,
                parameters: {
                    "packetization-mode": 1,
                    "profile-level-id": "42e01f",
                    "level-asymmetry-allowed": 1,
                    "x-google-start-bitrate": 1000,
                },
            },
        ],
    },
    // WebRTC transport settings
    webRtcTransport: {
        listenIps: [
            {
                ip: config_1.default.MEDIASOUP_LISTEN_IP,
                announcedIp: config_1.default.MEDIASOUP_ANNOUNCED_IP,
            },
        ],
        maxIncomingBitrate: 1500000,
        initialAvailableOutgoingBitrate: 1000000,
    },
    // Plain transport settings (for FFmpeg)
    plainTransport: {
        listenIp: {
            ip: config_1.default.MEDIASOUP_LISTEN_IP,
            announcedIp: config_1.default.MEDIASOUP_ANNOUNCED_IP,
        },
        rtcpMux: false,
        comedia: true,
    },
};
