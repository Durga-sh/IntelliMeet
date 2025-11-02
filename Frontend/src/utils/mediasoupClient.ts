import { Device } from "mediasoup-client";
import { Transport, Producer, Consumer } from "mediasoup-client/lib/types";
import { io, Socket } from "socket.io-client";

export interface Participant {
  id: string;
  userName: string;
  audioProducer?: Producer;
  videoProducer?: Producer;
  screenProducer?: Producer;
  consumers: Map<string, Consumer>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
  delivered?: boolean;
  deliveredTo?: string[];
  readBy?: string[];
}

class MediasoupClient {
  private socket: Socket | null = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private roomId: string = "";
  private userName: string = "";
  private userId: string = "";
  
  private audioProducer: Producer | null = null;
  private videoProducer: Producer | null = null;
  private screenProducer: Producer | null = null;
  
  private consumers: Map<string, Consumer> = new Map();
  private participants: Map<string, Participant> = new Map();
  private pendingProducers: Array<{ producerId: string; peerId: string }> = [];
  
  // Callbacks
  private onNewParticipantCallback?: (participant: Participant) => void;
  private onParticipantLeftCallback?: (participantId: string) => void;
  private onNewConsumerCallback?: (consumer: Consumer, peerId: string) => void;
  private onNewMessageCallback?: (message: ChatMessage) => void;
  private onTypingCallback?: (userId: string, userName: string) => void;
  private onStoppedTypingCallback?: (userId: string) => void;
  private onMessageDeliveredCallback?: (messageId: string, deliveredTo: string[]) => void;
  private onMessageReadCallback?: (messageId: string, userId: string) => void;
  private onProducerPausedCallback?: (producerId: string, peerId: string) => void;
  private onProducerResumedCallback?: (producerId: string, peerId: string) => void;

  async connect(serverUrl: string, roomId: string, userName: string, userId: string) {
    this.roomId = roomId;
    this.userName = userName;
    this.userId = userId;

    // Connect to Socket.IO
    this.socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout. Please check if the server is running."));
      }, 15000);

      this.socket!.on("connect", () => {
        clearTimeout(timeout);
        console.log("Connected to server");
        this.setupSocketListeners();
        this.joinRoom();
        resolve();
      });

      this.socket!.on("connect_error", (error) => {
        clearTimeout(timeout);
        console.error("Connection error:", error);
        reject(new Error("Cannot connect to server. Please ensure the backend is running."));
      });

      this.socket!.on("error", (data) => {
        console.error("Socket error:", data);
      });
    });
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on("router-rtp-capabilities", async (rtpCapabilities) => {
      await this.loadDevice(rtpCapabilities);
    });

    this.socket.on("existing-producers", async (producers) => {
      console.log(`📥 Received ${producers.length} existing producers:`, producers);
      // Store them to consume after receive transport is ready
      this.pendingProducers = producers;
      console.log(`� Stored ${producers.length} pending producers to consume after transport is ready`);
    });

    this.socket.on("new-producer", async (data) => {
      await this.consume(data.producerId, data.peerId);
    });

    this.socket.on("user-joined", (data) => {
      console.log("User joined:", data);
      const participant: Participant = {
        id: data.userId,
        userName: data.userName,
        consumers: new Map(),
      };
      this.participants.set(data.userId, participant);
      this.onNewParticipantCallback?.(participant);
    });

    this.socket.on("user-left", (data) => {
      console.log("User left:", data);
      this.participants.delete(data.userId);
      this.onParticipantLeftCallback?.(data.userId);
    });

    this.socket.on("room-participants", (participants) => {
      participants.forEach((p: any) => {
        if (p.id !== this.socket!.id) {
          const participant: Participant = {
            id: p.id,
            userName: p.userName,
            consumers: new Map(),
          };
          this.participants.set(p.id, participant);
        }
      });
    });

    this.socket.on("producer-paused", (data) => {
      this.onProducerPausedCallback?.(data.producerId, data.peerId);
    });

    this.socket.on("producer-resumed", (data) => {
      this.onProducerResumedCallback?.(data.producerId, data.peerId);
    });

    this.socket.on("producer-closed", (data) => {
      const consumer = Array.from(this.consumers.values()).find(
        (c) => c.producerId === data.producerId
      );
      if (consumer) {
        consumer.close();
        this.consumers.delete(consumer.id);
      }
    });

    // Chat listeners
    this.socket.on("new-message", (message) => {
      this.onNewMessageCallback?.(message);
    });

    this.socket.on("user-typing", (data) => {
      this.onTypingCallback?.(data.userId, data.userName);
    });

    this.socket.on("user-stopped-typing", (data) => {
      this.onStoppedTypingCallback?.(data.userId);
    });

    this.socket.on("message-delivered", (data) => {
      this.onMessageDeliveredCallback?.(data.messageId, data.deliveredTo);
    });

    this.socket.on("message-read-receipt", (data) => {
      this.onMessageReadCallback?.(data.messageId, data.userId);
    });

    this.socket.on("chat-history", (messages) => {
      messages.forEach((msg: ChatMessage) => {
        this.onNewMessageCallback?.(msg);
      });
    });
  }

  private joinRoom() {
    console.log("🔵 Sending join-room event to server...", {
      roomId: this.roomId,
      userName: this.userName,
      userId: this.userId,
    });
    this.socket!.emit("join-room", {
      roomId: this.roomId,
      userName: this.userName,
      userId: this.userId,
    });
  }

  private async loadDevice(rtpCapabilities: any) {
    try {
      console.log("🔵 Loading mediasoup device with RTP capabilities...");
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });
      console.log("✅ Device loaded successfully");

      // Create transports
      console.log("🔵 Creating send transport...");
      await this.createSendTransport();
      console.log("✅ Send transport created");
      
      console.log("🔵 Creating receive transport...");
      await this.createRecvTransport();
      console.log("✅ Receive transport created");
      
      // Now consume any pending producers that arrived before transport was ready
      if (this.pendingProducers.length > 0) {
        console.log(`🔵 Consuming ${this.pendingProducers.length} pending producers...`);
        for (const producer of this.pendingProducers) {
          console.log(`🔵 Consuming pending producer ${producer.producerId} from peer ${producer.peerId}`);
          await this.consume(producer.producerId, producer.peerId);
        }
        this.pendingProducers = []; // Clear pending producers
        console.log("✅ All pending producers consumed");
      }
    } catch (error) {
      console.error("❌ Error loading device:", error);
      throw error;
    }
  }

  private async createSendTransport() {
    return new Promise<void>((resolve, reject) => {
      console.log("🔵 Requesting create-transport (send) from server...");
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for transport-created (send)"));
      }, 10000);
      
      this.socket!.emit("create-transport", {
        roomId: this.roomId,
        direction: "send",
      });

      this.socket!.once("transport-created", async (data) => {
        if (data.direction === "send") {
          clearTimeout(timeout);
          console.log("✅ Received transport-created (send) from server");
          this.sendTransport = this.device!.createSendTransport(data.transport);

          this.sendTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
            try {
              console.log("🔵 Send transport 'connect' event triggered, calling connect-transport...");
              await this.emitAsync("connect-transport", {
                transportId: this.sendTransport!.id,
                dtlsParameters,
              });
              console.log("✅ Transport connected successfully");
              callback();
            } catch (error) {
              console.error("❌ Error in transport connect:", error);
              errback(error as Error);
            }
          });

          this.sendTransport.on("produce", async ({ kind, rtpParameters, appData }, callback, errback) => {
            try {
              const { producerId } = await this.emitAsync("produce", {
                transportId: this.sendTransport!.id,
                kind,
                rtpParameters,
                appData,
              });
              callback({ id: producerId });
            } catch (error) {
              errback(error as Error);
            }
          });

          this.sendTransport.on("connectionstatechange", (state) => {
            console.log("Send transport connection state:", state);
          });

          resolve();
        }
      });
    });
  }

  private async createRecvTransport() {
    return new Promise<void>((resolve) => {
      this.socket!.emit("create-transport", {
        roomId: this.roomId,
        direction: "recv",
      });

      this.socket!.once("transport-created", async (data) => {
        if (data.direction === "recv") {
          this.recvTransport = this.device!.createRecvTransport(data.transport);

          this.recvTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
            try {
              await this.emitAsync("connect-transport", {
                transportId: this.recvTransport!.id,
                dtlsParameters,
              });
              callback();
            } catch (error) {
              errback(error as Error);
            }
          });

          this.recvTransport.on("connectionstatechange", (state) => {
            console.log("Recv transport connection state:", state);
          });

          resolve();
        }
      });
    });
  }

  async produce(track: MediaStreamTrack, appData: any = {}) {
    console.log(`🔵 produce() called for ${track.kind} track`, { appData });
    
    if (!this.sendTransport) {
      console.error("❌ Send transport not created!");
      throw new Error("Send transport not created");
    }

    console.log(`🔵 Calling sendTransport.produce() for ${track.kind}...`);
    const producer = await this.sendTransport.produce({
      track,
      appData,
    });
    console.log(`✅ Producer created for ${track.kind}, ID:`, producer.id);

    if (track.kind === "audio") {
      this.audioProducer = producer;
    } else if (appData.screen) {
      this.screenProducer = producer;
    } else {
      this.videoProducer = producer;
    }

    producer.on("trackended", () => {
      console.log("Track ended");
      this.closeProducer(producer.id);
    });

    producer.on("transportclose", () => {
      console.log("Producer transport closed");
    });

    return producer;
  }

  private async consume(producerId: string, peerId: string) {
    if (!this.recvTransport || !this.device) {
      return;
    }

    const { id, kind, rtpParameters } = await this.emitAsync("consume", {
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });

    const consumer = await this.recvTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
    });

    this.consumers.set(consumer.id, consumer);

    // Resume consumer
    await this.emitAsync("resume-consumer", { consumerId: consumer.id });

    this.onNewConsumerCallback?.(consumer, peerId);

    return consumer;
  }

  async pauseProducer(kind: "audio" | "video" | "screen") {
    let producer: Producer | null = null;

    if (kind === "audio") producer = this.audioProducer;
    else if (kind === "screen") producer = this.screenProducer;
    else producer = this.videoProducer;

    if (producer) {
      await producer.pause();
      this.socket!.emit("pause-producer", { producerId: producer.id });
    }
  }

  async resumeProducer(kind: "audio" | "video" | "screen") {
    let producer: Producer | null = null;

    if (kind === "audio") producer = this.audioProducer;
    else if (kind === "screen") producer = this.screenProducer;
    else producer = this.videoProducer;

    if (producer) {
      await producer.resume();
      this.socket!.emit("resume-producer", { producerId: producer.id });
    }
  }

  closeProducer(producerId: string) {
    this.socket!.emit("close-producer", { producerId });

    if (this.audioProducer?.id === producerId) this.audioProducer = null;
    if (this.videoProducer?.id === producerId) this.videoProducer = null;
    if (this.screenProducer?.id === producerId) this.screenProducer = null;
  }

  // Chat methods
  sendMessage(message: string) {
    this.socket!.emit("send-message", {
      roomId: this.roomId,
      message,
      userName: this.userName,
      userId: this.userId,
    });
  }

  startTyping() {
    this.socket!.emit("typing-start", {
      roomId: this.roomId,
      userName: this.userName,
      userId: this.userId,
    });
  }

  stopTyping() {
    this.socket!.emit("typing-stop", {
      roomId: this.roomId,
      userId: this.userId,
    });
  }

  markMessageAsRead(messageId: string) {
    this.socket!.emit("message-read", {
      messageId,
      userId: this.userId,
    });
  }

  getChatHistory(limit: number = 50) {
    this.socket!.emit("get-chat-history", {
      roomId: this.roomId,
      limit,
    });
  }

  // Event handlers
  onNewParticipant(callback: (participant: Participant) => void) {
    this.onNewParticipantCallback = callback;
  }

  onParticipantLeft(callback: (participantId: string) => void) {
    this.onParticipantLeftCallback = callback;
  }

  onNewConsumer(callback: (consumer: Consumer, peerId: string) => void) {
    this.onNewConsumerCallback = callback;
  }

  onNewMessage(callback: (message: ChatMessage) => void) {
    this.onNewMessageCallback = callback;
  }

  onTyping(callback: (userId: string, userName: string) => void) {
    this.onTypingCallback = callback;
  }

  onStoppedTyping(callback: (userId: string) => void) {
    this.onStoppedTypingCallback = callback;
  }

  onMessageDelivered(callback: (messageId: string, deliveredTo: string[]) => void) {
    this.onMessageDeliveredCallback = callback;
  }

  onMessageRead(callback: (messageId: string, userId: string) => void) {
    this.onMessageReadCallback = callback;
  }

  onProducerPaused(callback: (producerId: string, peerId: string) => void) {
    this.onProducerPausedCallback = callback;
  }

  onProducerResumed(callback: (producerId: string, peerId: string) => void) {
    this.onProducerResumedCallback = callback;
  }

  getParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  disconnect() {
    if (this.audioProducer) this.audioProducer.close();
    if (this.videoProducer) this.videoProducer.close();
    if (this.screenProducer) this.screenProducer.close();

    this.consumers.forEach((consumer) => consumer.close());

    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private emitAsync(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`🔵 emitAsync: Sending '${event}' event...`);
      
      // Map event names to their response event names
      const responseEventMap: { [key: string]: string } = {
        "create-transport": "transport-created",
        "connect-transport": "transport-connected",
        "produce": "produced",
        "consume": "consumed",
        "resume-consumer": "resumed"
      };
      
      const responseEvent = responseEventMap[event] || event + "-response";
      console.log(`🔵 emitAsync: Waiting for '${responseEvent}' response...`);
      
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${responseEvent}`));
      }, 10000);
      
      this.socket!.emit(event, data);
      
      this.socket!.once(responseEvent, (response: any) => {
        clearTimeout(timeout);
        console.log(`✅ emitAsync: Received '${responseEvent}' response`);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }
}

export default new MediasoupClient();
