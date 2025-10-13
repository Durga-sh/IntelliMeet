import {
  Worker,
  Router,
  WebRtcTransport,
  PlainTransport,
  Producer,
  Consumer,
  RtpCapabilities,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  RtpParameters,
} from "mediasoup/node/lib/types";
import * as mediasoup from "mediasoup";
import { EventEmitter } from "events";
import { mediasoupConfig } from "../config/mediasoup";
import ffmpegService from "./ffmpegService";

interface MediasoupRoom {
  id: string;
  router: Router;
  audioPlainTransport?: PlainTransport;
  videoPlainTransport?: PlainTransport;
  recording: boolean;
  recordingStartTime?: Date;
  recordingPending: boolean;
  audioPort?: number;
  videoPort?: number;
}

interface MediasoupPeer {
  id: string;
  roomId: string;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export class MediasoupService extends EventEmitter {
  private worker?: Worker;
  private rooms: Map<string, MediasoupRoom> = new Map();
  private peers: Map<string, MediasoupPeer> = new Map();

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.worker = await mediasoup.createWorker(mediasoupConfig.worker);

      this.worker.on("died", () => {
        console.error("Mediasoup worker died, exiting in 2 seconds...");
        setTimeout(() => process.exit(1), 2000);
      });

      console.log("Mediasoup worker created");
    } catch (error) {
      console.error("Failed to create mediasoup worker:", error);
      throw error;
    }
  }

  async createRoom(roomId: string): Promise<MediasoupRoom> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    if (!this.worker) {
      throw new Error("Mediasoup worker not initialized");
    }

    try {
      const router = await this.worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs,
      });

      const room: MediasoupRoom = {
        id: roomId,
        router,
        recording: false,
        recordingPending: false,
      };

      this.rooms.set(roomId, room);
      console.log(`Created mediasoup room: ${roomId}`);

      return room;
    } catch (error) {
      console.error("Error creating mediasoup room:", error);
      throw error;
    }
  }

  async createWebRtcTransport(
    roomId: string,
    peerId: string,
    direction: "send" | "recv"
  ): Promise<{
    id: string;
    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    dtlsParameters: DtlsParameters;
  }> {
    const room = await this.createRoom(roomId);

    try {
      const transport = await room.router.createWebRtcTransport(
        mediasoupConfig.webRtcTransport
      );

      let peer = this.peers.get(peerId);
      if (!peer) {
        peer = {
          id: peerId,
          roomId,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        };
        this.peers.set(peerId, peer);
      }

      peer.transports.set(transport.id, transport);

      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      };
    } catch (error) {
      console.error("Error creating WebRTC transport:", error);
      throw error;
    }
  }

  async connectWebRtcTransport(
    peerId: string,
    transportId: string,
    dtlsParameters: DtlsParameters
  ): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer not found: ${peerId}`);
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    try {
      await transport.connect({ dtlsParameters });
      console.log(`Transport connected: ${transportId}`);
    } catch (error) {
      console.error("Error connecting transport:", error);
      throw error;
    }
  }

  async createProducer(
    peerId: string,
    transportId: string,
    rtpParameters: RtpParameters,
    kind: "audio" | "video"
  ): Promise<string> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer not found: ${peerId}`);
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    try {
      const producer = await transport.produce({
        kind,
        rtpParameters,
      });

      peer.producers.set(producer.id, producer);

      producer.on("transportclose", () => {
        peer.producers.delete(producer.id);
      });

      console.log(
        `🎤📹 Producer created: ${producer.id} (${kind}) for peer ${peerId}`
      );

      const room = this.rooms.get(peer.roomId);
      if (room && (room.recording || room.recordingPending)) {
        console.log(
          `🔴 Room is recording/pending - consuming new ${kind} producer for recording`
        );
        await this.consumeNewProducerForRecording(peer.roomId, producer);

        if (room.recordingPending && room.audioPort && room.videoPort) {
          const producerCount = this.getProducerCount(peer.roomId);
          if (producerCount === 1) {
            console.log(
              `✅ First producer available, starting FFmpeg for room ${peer.roomId}`
            );
            await this.startFFmpegRecording(
              peer.roomId,
              room.audioPort,
              room.videoPort
            );
            room.recordingPending = false;
          }
        }
      }

      this.emit("newProducer", {
        roomId: peer.roomId,
        peerId,
        producerId: producer.id,
        kind,
      });

      return producer.id;
    } catch (error) {
      console.error("Error creating producer:", error);
      throw error;
    }
  }

  private getProducerCount(roomId: string): number {
    let count = 0;
    for (const peer of this.peers.values()) {
      if (peer.roomId === roomId) {
        count += peer.producers.size;
      }
    }
    return count;
  }

  async createConsumer(
    peerId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<{
    id: string;
    kind: string;
    rtpParameters: RtpParameters;
  } | null> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer not found: ${peerId}`);
    }

    const room = this.rooms.get(peer.roomId);
    if (!room) {
      throw new Error(`Room not found: ${peer.roomId}`);
    }

    let producer: Producer | undefined;
    for (const [, p] of this.peers) {
      if (p.roomId === peer.roomId) {
        producer = p.producers.get(producerId);
        if (producer) break;
      }
    }

    if (!producer) {
      return null;
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return null;
    }

    try {
      const transport = Array.from(peer.transports.values())[0];
      if (!transport) {
        throw new Error("No transport available for consuming");
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      peer.consumers.set(consumer.id, consumer);

      consumer.on("transportclose", () => {
        peer.consumers.delete(consumer.id);
      });

      console.log(`Consumer created: ${consumer.id}`);

      return {
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
    } catch (error) {
      console.error("Error creating consumer:", error);
      throw error;
    }
  }

  async resumeConsumer(peerId: string, consumerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer not found: ${peerId}`);
    }

    const consumer = peer.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer not found: ${consumerId}`);
    }

    try {
      await consumer.resume();
      console.log(`Consumer resumed: ${consumerId}`);
    } catch (error) {
      console.error("Error resuming consumer:", error);
      throw error;
    }
  }

  async startRecording(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }

    if (room.recording) {
      throw new Error(`Room ${roomId} is already being recorded`);
    }

    try {
      const producerCount = this.getProducerCount(roomId);

      console.log(`🎥 Starting recording for room ${roomId}`);
      console.log(`👥 Active producers in room: ${producerCount}`);

      // Create plain transports with comedia=true (mediasoup learns ports from incoming RTP)
      const audioPlainTransport = await room.router.createPlainTransport({
        listenIp: { ip: "127.0.0.1", announcedIp: undefined },
        rtcpMux: false,
        comedia: true, // Learn remote address/port from first RTP packet
      });

      const videoPlainTransport = await room.router.createPlainTransport({
        listenIp: { ip: "127.0.0.1", announcedIp: undefined },
        rtcpMux: false,
        comedia: true, // Learn remote address/port from first RTP packet
      });

      // Get the ports mediasoup is listening on
      const audioPort = audioPlainTransport.tuple.localPort;
      const videoPort = videoPlainTransport.tuple.localPort;

      console.log(
        `📡 Mediasoup listening on - Audio: ${audioPort}, Video: ${videoPort}`
      );

      // Store transports and ports
      room.audioPlainTransport = audioPlainTransport;
      room.videoPlainTransport = videoPlainTransport;
      room.audioPort = audioPort;
      room.videoPort = videoPort;
      room.recording = true;
      room.recordingStartTime = new Date();

      // Consume existing producers for recording (this starts RTP flow)
      await this.consumeProducersForRecording(
        roomId,
        audioPlainTransport,
        videoPlainTransport
      );

      console.log(`📤 RTP streams ready`);

      // Now start FFmpeg to receive the RTP (after consumers are sending)
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Give consumers time to start

      await this.startFFmpegRecording(roomId, audioPort, videoPort);

      if (producerCount === 0) {
        console.warn(`⚠️ No active producers found in room ${roomId}`);
        console.warn(`⏳ Recording is ready and waiting for users`);
        room.recordingPending = true;
      } else {
        console.log(`✅ Recording ${producerCount} producers`);
      }

      console.log(`✅ Recording started successfully for room ${roomId}`);
    } catch (error) {
      console.error(`❌ Error starting recording for room ${roomId}:`, error);
      // Cleanup on error
      if (room.audioPlainTransport) {
        room.audioPlainTransport.close();
        room.audioPlainTransport = undefined;
      }
      if (room.videoPlainTransport) {
        room.videoPlainTransport.close();
        room.videoPlainTransport = undefined;
      }
      room.recording = false;
      throw error;
    }
  }

  private async startFFmpegRecording(
    roomId: string,
    audioPort: number,
    videoPort: number
  ): Promise<void> {
    try {
      await ffmpegService.startRecording({
        roomId,
        audioPort,
        videoPort,
      });
      console.log(`🎬 FFmpeg process started for room ${roomId}`);
    } catch (error) {
      console.error(`❌ Failed to start FFmpeg for room ${roomId}:`, error);
      throw error;
    }
  }

  private async consumeNewProducerForRecording(
    roomId: string,
    producer: Producer
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || (!room.recording && !room.recordingPending)) {
      return;
    }

    console.log(
      `🔴 Consuming new ${producer.kind} producer ${producer.id} for ongoing recording`
    );

    try {
      const plainTransport =
        producer.kind === "audio"
          ? room.audioPlainTransport
          : room.videoPlainTransport;

      if (!plainTransport) {
        console.error(
          `No ${producer.kind} plain transport available for recording`
        );
        return;
      }

      const rtpCapabilities =
        producer.kind === "audio"
          ? {
              codecs: [
                {
                  mimeType: "audio/opus",
                  kind: "audio" as const,
                  clockRate: 48000,
                  channels: 2,
                  preferredPayloadType: 111,
                },
              ],
              headerExtensions: [],
            }
          : {
              codecs: [
                {
                  mimeType: "video/VP8",
                  kind: "video" as const,
                  clockRate: 90000,
                  preferredPayloadType: 96,
                },
              ],
              headerExtensions: [],
            };

      const consumer = await plainTransport.consume({
        producerId: producer.id,
        rtpCapabilities,
      });

      await consumer.resume();
      console.log(
        `✅ Successfully consuming ${producer.kind} producer ${producer.id}`
      );
    } catch (error) {
      console.error(`Error consuming new ${producer.kind} producer:`, error);
    }
  }

  private async consumeProducersForRecording(
    roomId: string,
    audioPlainTransport: PlainTransport,
    videoPlainTransport: PlainTransport
  ): Promise<void> {
    console.log(`🎙️ Consuming producers for recording in room ${roomId}`);

    const roomProducers: { audio: Producer[]; video: Producer[] } = {
      audio: [],
      video: [],
    };

    for (const peer of this.peers.values()) {
      if (peer.roomId === roomId) {
        for (const producer of peer.producers.values()) {
          if (producer.kind === "audio") {
            roomProducers.audio.push(producer);
          } else if (producer.kind === "video") {
            roomProducers.video.push(producer);
          }
        }
      }
    }

    console.log(
      `📊 Found ${roomProducers.audio.length} audio and ${roomProducers.video.length} video producers`
    );

    for (const audioProducer of roomProducers.audio) {
      try {
        const consumer = await audioPlainTransport.consume({
          producerId: audioProducer.id,
          rtpCapabilities: {
            codecs: [
              {
                mimeType: "audio/opus",
                kind: "audio",
                clockRate: 48000,
                channels: 2,
                preferredPayloadType: 111,
              },
            ],
            headerExtensions: [],
          },
        });

        console.log(`🎤 Consuming audio producer ${audioProducer.id}`);

        await consumer.resume();
        console.log(`✅ Audio consumer ${consumer.id} resumed`);
      } catch (error) {
        console.error(
          `Error consuming audio producer ${audioProducer.id}:`,
          error
        );
      }
    }

    for (const videoProducer of roomProducers.video) {
      try {
        const consumer = await videoPlainTransport.consume({
          producerId: videoProducer.id,
          rtpCapabilities: {
            codecs: [
              {
                mimeType: "video/VP8",
                kind: "video",
                clockRate: 90000,
                preferredPayloadType: 96,
              },
            ],
            headerExtensions: [],
          },
        });

        console.log(`📹 Consuming video producer ${videoProducer.id}`);

        await consumer.resume();
        console.log(`✅ Video consumer ${consumer.id} resumed`);
      } catch (error) {
        console.error(
          `Error consuming video producer ${videoProducer.id}:`,
          error
        );
      }
    }
  }

  async stopRecording(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }

    if (!room.recording) {
      throw new Error(`Room ${roomId} is not being recorded`);
    }

    try {
      if (!room.recordingPending) {
        await ffmpegService.stopRecording(roomId);
      }

      if (room.audioPlainTransport) {
        room.audioPlainTransport.close();
        room.audioPlainTransport = undefined;
      }

      if (room.videoPlainTransport) {
        room.videoPlainTransport.close();
        room.videoPlainTransport = undefined;
      }

      room.recording = false;
      room.recordingPending = false;
      room.recordingStartTime = undefined;
      room.audioPort = undefined;
      room.videoPort = undefined;

      console.log(`Stopped recording for room ${roomId}`);
    } catch (error) {
      console.error(`Error stopping recording for room ${roomId}:`, error);
      throw error;
    }
  }

  getRouterRtpCapabilities(roomId: string): RtpCapabilities | null {
    const room = this.rooms.get(roomId);
    return room ? room.router.rtpCapabilities : null;
  }

  async removePeer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return;
    }

    try {
      for (const transport of peer.transports.values()) {
        transport.close();
      }

      this.peers.delete(peerId);
      console.log(`Removed peer: ${peerId}`);

      const roomPeers = Array.from(this.peers.values()).filter(
        (p) => p.roomId === peer.roomId
      );

      if (roomPeers.length === 0) {
        await this.cleanupRoom(peer.roomId);
      }
    } catch (error) {
      console.error("Error removing peer:", error);
    }
  }

  private async cleanupRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    try {
      if (room.recording) {
        await this.stopRecording(roomId);
      }

      room.router.close();

      this.rooms.delete(roomId);
      console.log(`Cleaned up room: ${roomId}`);
    } catch (error) {
      console.error("Error cleaning up room:", error);
    }
  }

  getRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const peers = Array.from(this.peers.values()).filter(
      (p) => p.roomId === roomId
    );

    return {
      id: roomId,
      peerCount: peers.length,
      recording: room.recording,
      recordingStartTime: room.recordingStartTime,
      recordingPending: room.recordingPending,
    };
  }

  getAllRooms() {
    return Array.from(this.rooms.keys()).map((roomId) =>
      this.getRoomInfo(roomId)
    );
  }
}

export default new MediasoupService();
