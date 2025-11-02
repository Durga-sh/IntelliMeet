import { RtpCodecCapability, TransportListenInfo, WorkerLogLevel, WorkerLogTag } from "mediasoup/node/lib/types";
import os from "os";

export const config = {
  // Worker settings
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: "warn" as WorkerLogLevel,
    logTags: [
      "info",
      "ice",
      "dtls",
      "rtp",
      "srtp",
      "rtcp",
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
    listenInfos: [
      {
        protocol: "udp" as const,
        ip: "0.0.0.0",
        announcedAddress: process.env.MEDIASOUP_ANNOUNCED_IP || getLocalIp(),
      },
    ] as TransportListenInfo[],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
  },
};

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      const { address, family, internal } = iface;
      if (family === "IPv4" && !internal) {
        return address;
      }
    }
  }
  return "127.0.0.1";
}
