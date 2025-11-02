import * as mediasoup from "mediasoup";
import { Worker, Router, WebRtcTransport, Producer, Consumer } from "mediasoup/node/lib/types";
import { config } from "../config/mediasoup";

export interface Peer {
  id: string;
  roomId: string;
  userName: string;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

class MediasoupService {
  private workers: Worker[] = [];
  private nextWorkerIndex = 0;
  private routers: Map<string, Router> = new Map();
  private peers: Map<string, Peer> = new Map();
  private rooms: Map<string, Set<string>> = new Map(); // roomId -> Set of peerIds

  async initialize() {
    const numWorkers = Object.keys(require("os").cpus()).length;
    console.log(`Creating ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
        rtcMinPort: config.worker.rtcMinPort,
        rtcMaxPort: config.worker.rtcMaxPort,
      });

      worker.on("died", () => {
        console.error(
          `Mediasoup worker died, exiting in 2 seconds... [pid:${worker.pid}]`
        );
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
    }

    console.log("Mediasoup workers created successfully");
  }

  getWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRouter(roomId: string): Promise<Router> {
    if (this.routers.has(roomId)) {
      return this.routers.get(roomId)!;
    }

    const worker = this.getWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    });

    this.routers.set(roomId, router);
    console.log(`Router created for room: ${roomId}`);
    return router;
  }

  getRouter(roomId: string): Router | undefined {
    return this.routers.get(roomId);
  }

  async createWebRtcTransport(roomId: string, peerId: string): Promise<any> {
    const router = await this.createRouter(roomId);

    const transport = await router.createWebRtcTransport({
      listenInfos: config.webRtcTransport.listenInfos,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate:
        config.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    // Store transport
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.transports.set(transport.id, transport);
    }

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    peerId: string,
    transportId: string,
    dtlsParameters: any
  ): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error("Peer not found");
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error("Transport not found");
    }

    await transport.connect({ dtlsParameters });
  }

  async produce(
    peerId: string,
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: any,
    appData: any = {}
  ): Promise<string> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error("Peer not found");
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error("Transport not found");
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, peerId, transportId },
    });

    peer.producers.set(producer.id, producer);

    producer.on("transportclose", () => {
      console.log(`Producer transport closed [producerId:${producer.id}]`);
      producer.close();
      peer.producers.delete(producer.id);
    });

    return producer.id;
  }

  async consume(
    peerId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: any
  ): Promise<any> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error("Peer not found");
    }

    const router = this.routers.get(peer.roomId);
    if (!router) {
      throw new Error("Router not found");
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error("Transport not found");
    }

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error("Cannot consume");
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    peer.consumers.set(consumer.id, consumer);

    consumer.on("transportclose", () => {
      console.log(`Consumer transport closed [consumerId:${consumer.id}]`);
      consumer.close();
      peer.consumers.delete(consumer.id);
    });

    consumer.on("producerclose", () => {
      console.log(`Consumer producer closed [consumerId:${consumer.id}]`);
      consumer.close();
      peer.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    };
  }

  async resumeConsumer(peerId: string, consumerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error("Peer not found");
    }

    const consumer = peer.consumers.get(consumerId);
    if (!consumer) {
      throw new Error("Consumer not found");
    }

    await consumer.resume();
  }

  async pauseProducer(peerId: string, producerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error("Peer not found");
    }

    const producer = peer.producers.get(producerId);
    if (!producer) {
      throw new Error("Producer not found");
    }

    await producer.pause();
  }

  async resumeProducer(peerId: string, producerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error("Peer not found");
    }

    const producer = peer.producers.get(producerId);
    if (!producer) {
      throw new Error("Producer not found");
    }

    await producer.resume();
  }

  addPeer(peerId: string, roomId: string, userName: string): void {
    const peer: Peer = {
      id: peerId,
      roomId,
      userName,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    this.peers.set(peerId, peer);

    // Add peer to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(peerId);

    console.log(`Peer added: ${peerId} to room: ${roomId}`);
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    // Close all transports
    peer.transports.forEach((transport) => transport.close());

    // Remove from room
    const roomPeers = this.rooms.get(peer.roomId);
    if (roomPeers) {
      roomPeers.delete(peerId);
      if (roomPeers.size === 0) {
        this.rooms.delete(peer.roomId);
        const router = this.routers.get(peer.roomId);
        if (router) {
          router.close();
          this.routers.delete(peer.roomId);
        }
      }
    }

    this.peers.delete(peerId);
    console.log(`Peer removed: ${peerId}`);
  }

  getPeer(peerId: string): Peer | undefined {
    return this.peers.get(peerId);
  }

  getRoomPeers(roomId: string): Peer[] {
    const peerIds = this.rooms.get(roomId);
    if (!peerIds) return [];

    return Array.from(peerIds)
      .map((id) => this.peers.get(id))
      .filter((peer): peer is Peer => peer !== undefined);
  }

  getProducersByRoom(roomId: string): Array<{ producerId: string; peerId: string; kind: string }> {
    const peers = this.getRoomPeers(roomId);
    const producers: Array<{ producerId: string; peerId: string; kind: string }> = [];

    peers.forEach((peer) => {
      peer.producers.forEach((producer, producerId) => {
        producers.push({
          producerId,
          peerId: peer.id,
          kind: producer.kind,
        });
      });
    });

    return producers;
  }

  closeProducer(peerId: string, producerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const producer = peer.producers.get(producerId);
    if (producer) {
      producer.close();
      peer.producers.delete(producerId);
    }
  }
}

export default new MediasoupService();
