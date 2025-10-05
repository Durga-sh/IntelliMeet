import { io, Socket } from "socket.io-client";
import { Device } from "mediasoup-client";

export interface MediasoupUser {
  id: string;
  socketId: string;
  name: string;
  roomId: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
}

export interface MediasoupServiceOptions {
  onRoomJoined?: (
    roomId: string,
    currentUserId: string,
    allUsers: MediasoupUser[]
  ) => void;
  onUserJoined?: (user: MediasoupUser) => void;
  onUserLeft?: (userId: string) => void;
  onUserVideoToggled?: (userId: string, isVideoEnabled: boolean) => void;
  onUserAudioToggled?: (userId: string, isAudioEnabled: boolean) => void;
  onUserScreenShareToggled?: (userId: string, isScreenSharing: boolean) => void;
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onRecordingStarted?: (recordingId: string, startTime: Date) => void;
  onRecordingStopped?: (recordingId: string, endTime: Date) => void;
  onError?: (error: any) => void;
}

class MediasoupWebRTCService {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private sendTransport: any = null;
  private recvTransport: any = null;
  private producers: Map<string, any> = new Map();
  private consumers: Map<string, any> = new Map();
  private options: MediasoupServiceOptions = {};
  private currentUser: MediasoupUser | null = null;
  private roomId: string | null = null;

  constructor(options: MediasoupServiceOptions = {}) {
    this.options = options;
    this.device = new Device();
  }

  // Initialize connection
  public async connect(
    serverUrl: string = "http://localhost:5000"
  ): Promise<void> {
    try {
      this.socket = io(serverUrl, {
        transports: ["websocket"],
      });

      this.setupSocketListeners();

      return new Promise((resolve, reject) => {
        this.socket!.on("connect", () => {
          console.log("Connected to server");
          resolve();
        });

        this.socket!.on("connect_error", (error) => {
          console.error("Connection error:", error);
          reject(error);
        });
      });
    } catch (error) {
      console.error("Error connecting:", error);
      throw error;
    }
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Room events
    this.socket.on("joined-room", (data) => {
      console.log("Joined room:", data);
      this.roomId = data.roomId;
      this.currentUser = data.users.find(
        (u: MediasoupUser) => u.socketId === this.socket!.id
      );
      this.options.onRoomJoined?.(data.roomId, data.userId, data.users);
    });

    this.socket.on("user-joined", (data) => {
      console.log("User joined:", data);
      this.options.onUserJoined?.(data.user);
    });

    this.socket.on("user-left", (data) => {
      console.log("User left:", data);
      this.cleanupConsumersByUserId(data.userId);
      this.options.onUserLeft?.(data.userId);
    });

    // Mediasoup events
    this.socket.on("routerRtpCapabilities", async (data) => {
      console.log("Router RTP capabilities received");
      try {
        await this.device!.load({
          routerRtpCapabilities: data.rtpCapabilities,
        });
        await this.createTransports();
        // Device loaded, transports will be created when joining room
      } catch (error) {
        console.error("Error loading device:", error);
        this.options.onError?.(error);
      }
    });

    this.socket.on("webRtcTransportCreated", (data) => {
      console.log("WebRTC transport created:", data);
      this.handleTransportCreated(data);
    });

    this.socket.on("webRtcTransportConnected", (data) => {
      console.log("WebRTC transport connected:", data);
    });

    this.socket.on("producerCreated", (data) => {
      console.log("Producer created:", data);
    });

    this.socket.on("consumerCreated", async (data) => {
      console.log("Consumer created:", data);
      await this.handleConsumerCreated(data);
    });

    this.socket.on("consumerResumed", (data) => {
      console.log("Consumer resumed:", data);
    });

    // Recording events
    this.socket.on("recording-started", (data) => {
      console.log("Recording started:", data);
      this.options.onRecordingStarted?.(
        data.recordingId,
        new Date(data.startTime)
      );
    });

    this.socket.on("recording-stopped", (data) => {
      console.log("Recording stopped:", data);
      this.options.onRecordingStopped?.(
        data.recordingId,
        new Date(data.endTime)
      );
    });

    // User state changes
    this.socket.on("user-video-toggled", (data) => {
      this.options.onUserVideoToggled?.(data.userId, data.isVideoEnabled);
    });

    this.socket.on("user-audio-toggled", (data) => {
      this.options.onUserAudioToggled?.(data.userId, data.isAudioEnabled);
    });

    this.socket.on("user-screen-share-toggled", (data) => {
      this.options.onUserScreenShareToggled?.(
        data.userId,
        data.isScreenSharing
      );
    });

    // Error handling
    this.socket.on("error", (data) => {
      console.error("Server error:", data);
      this.options.onError?.(data);
    });
  }

  // Join a room
  public async joinRoom(roomId: string, userName: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Not connected to server");
    }

    this.roomId = roomId;

    // Get router RTP capabilities first
    this.socket.emit("getRouterRtpCapabilities", { roomId });

    // Join the room
    this.socket.emit("join-room", {
      roomId,
      user: { name: userName },
    });
  }

  // Create transports
  private async createTransports(): Promise<void> {
    if (!this.socket || !this.roomId) return;

    // Create send transport
    this.socket.emit("createWebRtcTransport", {
      roomId: this.roomId,
      direction: "send",
    });

    // Create receive transport
    this.socket.emit("createWebRtcTransport", {
      roomId: this.roomId,
      direction: "recv",
    });
  }

  // Handle transport creation
  private async handleTransportCreated(data: any): Promise<void> {
    try {
      if (data.direction === "send") {
        this.sendTransport = this.device!.createSendTransport({
          id: data.id,
          iceParameters: data.iceParameters,
          iceCandidates: data.iceCandidates,
          dtlsParameters: data.dtlsParameters,
        });

        this.sendTransport.on(
          "connect",
          async ({ dtlsParameters }: any, callback: any, errback: any) => {
            try {
              this.socket!.emit("connectWebRtcTransport", {
                transportId: data.id,
                dtlsParameters,
              });
              callback();
            } catch (error) {
              errback(error);
            }
          }
        );

        this.sendTransport.on(
          "produce",
          async (parameters: any, callback: any, errback: any) => {
            try {
              this.socket!.emit("createProducer", {
                transportId: data.id,
                kind: parameters.kind,
                rtpParameters: parameters.rtpParameters,
              });

              this.socket!.once("producerCreated", (producerData) => {
                callback({ id: producerData.producerId });
              });
            } catch (error) {
              errback(error);
            }
          }
        );
      } else if (data.direction === "recv") {
        this.recvTransport = this.device!.createRecvTransport({
          id: data.id,
          iceParameters: data.iceParameters,
          iceCandidates: data.iceCandidates,
          dtlsParameters: data.dtlsParameters,
        });

        this.recvTransport.on(
          "connect",
          async ({ dtlsParameters }: any, callback: any, errback: any) => {
            try {
              this.socket!.emit("connectWebRtcTransport", {
                transportId: data.id,
                dtlsParameters,
              });
              callback();
            } catch (error) {
              errback(error);
            }
          }
        );
      }
    } catch (error) {
      console.error("Error handling transport creation:", error);
      this.options.onError?.(error);
    }
  }

  // Start local media
  public async startLocalMedia(
    video: boolean = true,
    audio: boolean = true
  ): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 640, height: 480 } : false,
        audio: audio,
      });

      // Produce media if transport is available
      if (this.sendTransport) {
        await this.produceMedia();
      }

      return this.localStream;
    } catch (error) {
      console.error("Error starting local media:", error);
      throw error;
    }
  }

  // Produce media
  private async produceMedia(): Promise<void> {
    if (!this.sendTransport || !this.localStream) return;

    try {
      // Produce video
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        const videoProducer = await this.sendTransport.produce({
          track: videoTrack,
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
        });
        this.producers.set("video", videoProducer);
      }

      // Produce audio
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        const audioProducer = await this.sendTransport.produce({
          track: audioTrack,
        });
        this.producers.set("audio", audioProducer);
      }
    } catch (error) {
      console.error("Error producing media:", error);
      this.options.onError?.(error);
    }
  }

  // Handle consumer creation
  private async handleConsumerCreated(data: any): Promise<void> {
    if (!this.recvTransport) return;

    try {
      const consumer = await this.recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });

      this.consumers.set(data.id, consumer);

      // Resume consumer
      this.socket!.emit("resumeConsumer", { consumerId: data.id });

      // Create media stream
      const stream = new MediaStream([consumer.track]);
      this.options.onRemoteStream?.(data.producerId, stream);
    } catch (error) {
      console.error("Error handling consumer creation:", error);
      this.options.onError?.(error);
    }
  }

  // Toggle video
  public async toggleVideo(): Promise<boolean> {
    if (!this.currentUser) return false;

    const videoProducer = this.producers.get("video");
    const newState = !this.currentUser.isVideoEnabled;

    if (videoProducer) {
      if (newState) {
        videoProducer.resume();
      } else {
        videoProducer.pause();
      }
    }

    this.currentUser.isVideoEnabled = newState;
    this.socket?.emit("toggle-video", { isVideoEnabled: newState });

    return newState;
  }

  // Toggle audio
  public async toggleAudio(): Promise<boolean> {
    if (!this.currentUser) return false;

    const audioProducer = this.producers.get("audio");
    const newState = !this.currentUser.isAudioEnabled;

    if (audioProducer) {
      if (newState) {
        audioProducer.resume();
      } else {
        audioProducer.pause();
      }
    }

    this.currentUser.isAudioEnabled = newState;
    this.socket?.emit("toggle-audio", { isAudioEnabled: newState });

    return newState;
  }

  // Start recording
  public startRecording(): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("start-recording", { roomId: this.roomId });
  }

  // Stop recording
  public stopRecording(): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("stop-recording", { roomId: this.roomId });
  }

  // Get recording status
  public getRecordingStatus(): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("get-recording-status", { roomId: this.roomId });
  }

  // Leave room
  public leaveRoom(): void {
    if (!this.socket) return;

    // Close producers
    this.producers.forEach((producer) => producer.close());
    this.producers.clear();

    // Close consumers
    this.consumers.forEach((consumer) => consumer.close());
    this.consumers.clear();

    // Close transports
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.sendTransport = null;
    this.recvTransport = null;

    // Stop local streams
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.screenStream = null;

    this.socket.emit("leave-room");
    this.currentUser = null;
    this.roomId = null;
  }

  // Disconnect
  public disconnect(): void {
    this.leaveRoom();
    this.socket?.disconnect();
    this.socket = null;
  }

  // Clean up consumers by user ID
  private cleanupConsumersByUserId(_userId: string): void {
    // This would need to be implemented based on how you track user-consumer relationships
    // For now, we'll clean up all consumers as a simple approach
    this.consumers.forEach((consumer, consumerId) => {
      consumer.close();
      this.consumers.delete(consumerId);
    });
  }

  // Getters
  public getCurrentUser(): MediasoupUser | null {
    return this.currentUser;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRoomId(): string | null {
    return this.roomId;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export default MediasoupWebRTCService;
