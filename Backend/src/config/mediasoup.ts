import {
  WorkerLogLevel,
  WorkerLogTag,
  RtpCodecCapability,
} from "mediasoup/node/lib/types";
import config from "./config";

export const mediasoupConfig = {
  // Worker settings
  worker: {
    rtcMinPort: config.MEDIASOUP_MIN_PORT,
    rtcMaxPort: config.MEDIASOUP_MAX_PORT,
    logLevel: "warn" as WorkerLogLevel,
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
    ] as WorkerLogTag[],
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
    ] as RtpCodecCapability[],
  },

  // WebRTC transport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: config.MEDIASOUP_LISTEN_IP,
        announcedIp: config.MEDIASOUP_ANNOUNCED_IP,
      },
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },

  // Plain transport settings (for FFmpeg)
  plainTransport: {
    listenIp: {
      ip: config.MEDIASOUP_LISTEN_IP,
      announcedIp: config.MEDIASOUP_ANNOUNCED_IP,
    },
    rtcpMux: false,
    comedia: true,
  },
};
