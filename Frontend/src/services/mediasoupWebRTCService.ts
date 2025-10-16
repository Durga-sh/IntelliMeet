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

  // Set options (allow updating options after construction)
  public setOptions(options: MediasoupServiceOptions): void {
    this.options = { ...this.options, ...options };
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
          console.log("✅ Connected to server, socket ID:", this.socket!.id);
          resolve();
        });

        this.socket!.on("connect_error", (error) => {
          console.error("❌ Connection error:", error);
          reject(error);
        });
      });
    } catch (error) {
      console.error("❌ Error connecting:", error);
      throw error;
    }
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Room events
    this.socket.on("joined-room", (data) => {
      console.log("✅ Joined room:", data);
      this.roomId = data.roomId;
      this.currentUser = data.users.find(
        (u: MediasoupUser) => u.socketId === this.socket!.id
      );
      this.options.onRoomJoined?.(data.roomId, data.userId, data.users);
    });

    this.socket.on("user-joined", (data) => {
      console.log("👋 User joined:", data);
      this.options.onUserJoined?.(data.user);
    });

    this.socket.on("user-left", (data) => {
      console.log("👋 User left:", data);
      this.cleanupConsumersByUserId(data.userId);
      this.options.onUserLeft?.(data.userId);
    });

    // Mediasoup events
    this.socket.on("routerRtpCapabilities", async (data) => {
      console.log("📋 Router RTP capabilities received");
      try {
        await this.device!.load({
          routerRtpCapabilities: data.rtpCapabilities,
        });
        console.log("✅ Device loaded with RTP capabilities");
        await this.createTransports();
        
        // Note: Existing producers will be handled via separate "existingProducers" event
      } catch (error) {
        console.error("❌ Error loading device:", error);
        this.options.onError?.(error);
      }
    });

    this.socket.on("webRtcTransportCreated", (data) => {
      console.log("🚚 WebRTC transport created:", data.direction);
      this.handleTransportCreated(data);
    });

    this.socket.on("webRtcTransportConnected", (data) => {
      console.log("✅ WebRTC transport connected:", data.transportId);
    });

    this.socket.on("producerCreated", (data) => {
      console.log("🎬 Producer created:", data.producerId, data.kind);
    });

    this.socket.on("consumerCreated", async (data) => {
      console.log("📺 Consumer created:", data.id);
      await this.handleConsumerCreated(data);
    });

    this.socket.on("consumerResumed", (data) => {
      console.log("▶️ Consumer resumed:", data.consumerId);
    });

    // Handle new producer notifications
    this.socket.on("newProducer", async (data) => {
      console.log("🆕 New producer available:", data.producerId, "kind:", data.kind, "from user:", data.producerUserId);
      
      // Try immediate creation
      if (this.socket && this.device?.rtpCapabilities && this.recvTransport) {
        console.log("📺 Creating consumer for new producer immediately");
        this.socket.emit("createConsumer", {
          producerId: data.producerId,
          rtpCapabilities: this.device.rtpCapabilities,
        });
        return;
      }

      // Wait for receive transport and try again
      console.warn("❌ Receive transport not ready, waiting...");
      const maxRetries = 5;
      let retries = 0;
      
      const tryAgain = () => {
        if (retries >= maxRetries) {
          console.error("❌ Max retries reached for creating consumer");
          return;
        }
        
        retries++;
        if (this.socket && this.device?.rtpCapabilities && this.recvTransport) {
          console.log(`📺 Retry ${retries}: Creating consumer for producer ${data.producerId}`);
          this.socket.emit("createConsumer", {
            producerId: data.producerId,
            rtpCapabilities: this.device.rtpCapabilities,
          });
        } else {
          setTimeout(tryAgain, 1000);
        }
      };
      
      setTimeout(tryAgain, 1000);
    });

    // Handle existing producers notification
    this.socket.on("existingProducers", async (data) => {
      console.log("📺 Received existing producers notification:", data.existingProducers.length);
      if (data.existingProducers && data.existingProducers.length > 0) {
        try {
          await this.waitForReceiveTransport();
          console.log("📺 Creating consumers for existing producers");
          this.createConsumersForExistingProducers(data.existingProducers);
        } catch (error) {
          console.error("❌ Error creating consumers for existing producers:", error);
        }
      }
    });

    // Recording events
    this.socket.on("recording-started", (data) => {
      console.log("🔴 Recording started:", data);
      this.options.onRecordingStarted?.(
        data.recordingId,
        new Date(data.startTime)
      );
    });

    this.socket.on("recording-stopped", (data) => {
      console.log("⏹️ Recording stopped:", data);
      this.options.onRecordingStopped?.(
        data.recordingId,
        new Date(data.endTime)
      );
    });

    // User state changes
    this.socket.on("user-video-toggled", (data) => {
      console.log("📹 User video toggled:", data.userId, data.isVideoEnabled);
      this.options.onUserVideoToggled?.(data.userId, data.isVideoEnabled);
    });

    this.socket.on("user-audio-toggled", (data) => {
      console.log("🎤 User audio toggled:", data.userId, data.isAudioEnabled);
      this.options.onUserAudioToggled?.(data.userId, data.isAudioEnabled);
    });

    this.socket.on("user-screen-share-toggled", (data) => {
      console.log(
        "🖥️ User screen share toggled:",
        data.userId,
        data.isScreenSharing
      );
      this.options.onUserScreenShareToggled?.(
        data.userId,
        data.isScreenSharing
      );
    });

    // Error handling
    this.socket.on("error", (data) => {
      console.error("❌ Server error:", data);
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
    console.log("📋 Requesting router RTP capabilities...");
    this.socket.emit("getRouterRtpCapabilities", { roomId });

    // Join the room
    console.log("🚪 Emitting join-room event...");
    this.socket.emit("join-room", {
      roomId,
      user: { name: userName },
    });
  }

  // Create transports
  private async createTransports(): Promise<void> {
    if (!this.socket || !this.roomId) {
      console.error("❌ Cannot create transports: no socket or roomId");
      return;
    }

    console.log("🚚 Creating send transport...");
    this.socket.emit("createWebRtcTransport", {
      roomId: this.roomId,
      direction: "send",
    });

    console.log("🚚 Creating receive transport...");
    this.socket.emit("createWebRtcTransport", {
      roomId: this.roomId,
      direction: "recv",
    });
  }

  // Handle transport creation
  private async handleTransportCreated(data: any): Promise<void> {
    try {
      if (data.direction === "send") {
        console.log("🚚 Creating send transport on client side...");
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
              console.log("🔗 Send transport connecting...");
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
              console.log("🎬 Producing:", parameters.kind);
              this.socket!.emit("createProducer", {
                transportId: data.id,
                kind: parameters.kind,
                rtpParameters: parameters.rtpParameters,
              });

              this.socket!.once("producerCreated", (producerData) => {
                console.log(
                  "✅ Producer created on server:",
                  producerData.producerId
                );
                callback({ id: producerData.producerId });
              });
            } catch (error) {
              errback(error);
            }
          }
        );

        console.log("✅ Send transport setup complete");
      } else if (data.direction === "recv") {
        console.log("🚚 Creating receive transport on client side...");
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
              console.log("🔗 Receive transport connecting...");
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

        console.log("✅ Receive transport setup complete");
      }
    } catch (error) {
      console.error("❌ Error handling transport creation:", error);
      this.options.onError?.(error);
    }
  }

  // Start local media
  public async startLocalMedia(
    video: boolean = true,
    audio: boolean = true
  ): Promise<MediaStream> {
    try {
      console.log("🎥 Requesting user media...");
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: audio,
      });

      console.log("✅ Local media stream obtained");
      console.log("📹 Video tracks:", this.localStream.getVideoTracks().length);
      console.log("🎤 Audio tracks:", this.localStream.getAudioTracks().length);

      // Wait for send transport to be ready
      await this.waitForTransport();

      // Produce media
      await this.produceMedia();

      return this.localStream;
    } catch (error) {
      console.error("❌ Error starting local media:", error);
      throw error;
    }
  }

  // Wait for transport to be ready
  private async waitForTransport(maxWait: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (!this.sendTransport && Date.now() - startTime < maxWait) {
      console.log("⏳ Waiting for send transport...");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!this.sendTransport) {
      throw new Error("Send transport not ready after waiting");
    }
    console.log("✅ Send transport is ready");
  }

  // Wait for receive transport to be ready
  private async waitForReceiveTransport(maxWait: number = 8000): Promise<void> {
    const startTime = Date.now();
    while (!this.recvTransport && Date.now() - startTime < maxWait) {
      console.log("⏳ Waiting for receive transport...");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!this.recvTransport) {
      throw new Error("Receive transport not ready after waiting");
    }
    console.log("✅ Receive transport is ready");
  }

  // Produce media
  private async produceMedia(): Promise<void> {
    if (!this.sendTransport || !this.localStream) {
      console.error("❌ Cannot produce media: no transport or stream");
      return;
    }

    try {
      // Produce video
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        console.log("📹 Producing video track...");
        const videoProducer = await this.sendTransport.produce({
          track: videoTrack,
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
        });
        this.producers.set("video", videoProducer);
        console.log("✅ Video producer created:", videoProducer.id);
      }

      // Produce audio
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        console.log("🎤 Producing audio track...");
        const audioProducer = await this.sendTransport.produce({
          track: audioTrack,
        });
        this.producers.set("audio", audioProducer);
        console.log("✅ Audio producer created:", audioProducer.id);
      }
    } catch (error) {
      console.error("❌ Error producing media:", error);
      this.options.onError?.(error);
    }
  }

  // Handle consumer creation
  private async handleConsumerCreated(data: any): Promise<void> {
    if (!this.recvTransport) {
      console.error("❌ Cannot create consumer: no receive transport");
      return;
    }

    try {
      console.log("📺 Creating consumer for:", data.kind, "from user:", data.producerUserId);
      const consumer = await this.recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });

      this.consumers.set(data.id, consumer);

      // Resume consumer
      console.log("▶️ Resuming consumer:", data.id);
      this.socket!.emit("resumeConsumer", { consumerId: data.id });

      // Create media stream
      const stream = new MediaStream([consumer.track]);
      console.log("✅ Remote stream created for user:", data.producerUserId, "kind:", data.kind);
      this.options.onRemoteStream?.(data.producerUserId, stream);
    } catch (error) {
      console.error("❌ Error handling consumer creation:", error);
      this.options.onError?.(error);
    }
  }

  // Toggle video
  public async toggleVideo(): Promise<boolean> {
    if (!this.currentUser) {
      console.error("❌ Cannot toggle video: no current user");
      return false;
    }

    const videoProducer = this.producers.get("video");
    const newState = !this.currentUser.isVideoEnabled;

    if (videoProducer) {
      if (newState) {
        videoProducer.resume();
        console.log("📹 Video resumed");
      } else {
        videoProducer.pause();
        console.log("📹 Video paused");
      }
    }

    this.currentUser.isVideoEnabled = newState;
    this.socket?.emit("toggle-video", { isVideoEnabled: newState });

    return newState;
  }

  // Toggle audio
  public async toggleAudio(): Promise<boolean> {
    if (!this.currentUser) {
      console.error("❌ Cannot toggle audio: no current user");
      return false;
    }

    const audioProducer = this.producers.get("audio");
    const newState = !this.currentUser.isAudioEnabled;

    if (audioProducer) {
      if (newState) {
        audioProducer.resume();
        console.log("🎤 Audio resumed");
      } else {
        audioProducer.pause();
        console.log("🎤 Audio paused");
      }
    }

    this.currentUser.isAudioEnabled = newState;
    this.socket?.emit("toggle-audio", { isAudioEnabled: newState });

    return newState;
  }

  // Start recording
  public startRecording(): void {
    if (!this.socket || !this.roomId) return;
    console.log("🔴 Starting recording...");
    this.socket.emit("start-recording", { roomId: this.roomId });
  }

  // Stop recording
  public stopRecording(): void {
    if (!this.socket || !this.roomId) return;
    console.log("⏹️ Stopping recording...");
    this.socket.emit("stop-recording", { roomId: this.roomId });
  }

  // Get recording status
  public getRecordingStatus(): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit("get-recording-status", { roomId: this.roomId });
  }

  // Create consumers for existing producers
  private async createConsumersForExistingProducers(existingProducers: any[]): Promise<void> {
    if (!this.socket || !this.device?.rtpCapabilities) {
      console.error("❌ Cannot create consumers: no socket or device capabilities");
      return;
    }

    console.log("📺 Creating consumers for existing producers:", existingProducers.length);
    console.log("📺 Existing producers details:", existingProducers);
    
    for (const producer of existingProducers) {
      try {
        console.log(`📺 Creating consumer for producer ${producer.producerId} (${producer.kind}) from user ${producer.producerUserId}`);
        this.socket.emit("createConsumer", {
          producerId: producer.producerId,
          rtpCapabilities: this.device.rtpCapabilities,
        });
        
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error creating consumer for producer ${producer.producerId}:`, error);
      }
    }
  }

  // Leave room
  public leaveRoom(): void {
    if (!this.socket) return;

    console.log("👋 Leaving room...");

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

    console.log("✅ Left room");
  }

  // Disconnect
  public disconnect(): void {
    console.log("🔌 Disconnecting...");
    this.leaveRoom();
    this.socket?.disconnect();
    this.socket = null;
  }

  // Clean up consumers by user ID
  private cleanupConsumersByUserId(_userId: string): void {
    // Clean up all consumers as a simple approach
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

  public getSocket(): Socket | null {
    return this.socket;
  }
}

export default MediasoupWebRTCService;
