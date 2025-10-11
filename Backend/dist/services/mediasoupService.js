"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediasoupService = void 0;
const mediasoup = __importStar(require("mediasoup"));
const events_1 = require("events");
const mediasoup_1 = require("../config/mediasoup");
const ffmpegService_1 = __importDefault(require("./ffmpegService"));
class MediasoupService extends events_1.EventEmitter {
    constructor() {
        super();
        this.rooms = new Map();
        this.peers = new Map();
        this.nextPort = 40000;
        this.initialize();
    }
    async initialize() {
        try {
            // Create mediasoup worker
            this.worker = await mediasoup.createWorker(mediasoup_1.mediasoupConfig.worker);
            this.worker.on("died", () => {
                console.error("Mediasoup worker died, exiting in 2 seconds...");
                setTimeout(() => process.exit(1), 2000);
            });
            console.log("Mediasoup worker created");
        }
        catch (error) {
            console.error("Failed to create mediasoup worker:", error);
            throw error;
        }
    }
    /**
     * Create or get existing room
     */
    async createRoom(roomId) {
        if (this.rooms.has(roomId)) {
            return this.rooms.get(roomId);
        }
        if (!this.worker) {
            throw new Error("Mediasoup worker not initialized");
        }
        try {
            // Create router
            const router = await this.worker.createRouter({
                mediaCodecs: mediasoup_1.mediasoupConfig.router.mediaCodecs,
            });
            const room = {
                id: roomId,
                router,
                recording: false,
            };
            this.rooms.set(roomId, room);
            console.log(`Created mediasoup room: ${roomId}`);
            return room;
        }
        catch (error) {
            console.error("Error creating mediasoup room:", error);
            throw error;
        }
    }
    /**
     * Create WebRTC transport for a peer
     */
    async createWebRtcTransport(roomId, peerId, direction) {
        const room = await this.createRoom(roomId);
        try {
            const transport = await room.router.createWebRtcTransport(mediasoup_1.mediasoupConfig.webRtcTransport);
            // Store transport
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
        }
        catch (error) {
            console.error("Error creating WebRTC transport:", error);
            throw error;
        }
    }
    /**
     * Connect WebRTC transport
     */
    async connectWebRtcTransport(peerId, transportId, dtlsParameters) {
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
        }
        catch (error) {
            console.error("Error connecting transport:", error);
            throw error;
        }
    }
    /**
     * Create producer
     */
    async createProducer(peerId, transportId, rtpParameters, kind) {
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
            // Handle producer events
            producer.on("transportclose", () => {
                peer.producers.delete(producer.id);
            });
            console.log(`Producer created: ${producer.id} (${kind})`);
            // If room is being recorded, consume this new producer
            const room = this.rooms.get(peer.roomId);
            if (room && room.recording) {
                await this.consumeNewProducerForRecording(peer.roomId, producer);
            }
            // Notify other peers about new producer
            this.emit("newProducer", {
                roomId: peer.roomId,
                peerId,
                producerId: producer.id,
                kind,
            });
            return producer.id;
        }
        catch (error) {
            console.error("Error creating producer:", error);
            throw error;
        }
    }
    /**
     * Create consumer
     */
    async createConsumer(peerId, producerId, rtpCapabilities) {
        const peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`Peer not found: ${peerId}`);
        }
        const room = this.rooms.get(peer.roomId);
        if (!room) {
            throw new Error(`Room not found: ${peer.roomId}`);
        }
        // Find producer
        let producer;
        for (const [, p] of this.peers) {
            if (p.roomId === peer.roomId) {
                producer = p.producers.get(producerId);
                if (producer)
                    break;
            }
        }
        if (!producer) {
            return null;
        }
        // Check if router can consume
        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
            return null;
        }
        try {
            // Get a suitable transport for consuming
            const transport = Array.from(peer.transports.values())[0];
            if (!transport) {
                throw new Error("No transport available for consuming");
            }
            const consumer = await transport.consume({
                producerId,
                rtpCapabilities,
                paused: true, // Start paused
            });
            peer.consumers.set(consumer.id, consumer);
            // Handle consumer events
            consumer.on("transportclose", () => {
                peer.consumers.delete(consumer.id);
            });
            console.log(`Consumer created: ${consumer.id}`);
            return {
                id: consumer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
            };
        }
        catch (error) {
            console.error("Error creating consumer:", error);
            throw error;
        }
    }
    /**
     * Resume consumer
     */
    async resumeConsumer(peerId, consumerId) {
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
        }
        catch (error) {
            console.error("Error resuming consumer:", error);
            throw error;
        }
    }
    /**
     * Start recording a room
     */
    async startRecording(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Room not found: ${roomId}`);
        }
        if (room.recording) {
            throw new Error(`Room ${roomId} is already being recorded`);
        }
        try {
            // Get available ports
            const audioPort = this.getNextPort();
            const videoPort = this.getNextPort();
            // Create plain transports for FFmpeg
            const audioPlainTransport = await room.router.createPlainTransport({
                ...mediasoup_1.mediasoupConfig.plainTransport,
                rtcpMux: false,
                comedia: true,
            });
            const videoPlainTransport = await room.router.createPlainTransport({
                ...mediasoup_1.mediasoupConfig.plainTransport,
                rtcpMux: false,
                comedia: true,
            });
            // Connect transports
            await audioPlainTransport.connect({
                ip: "127.0.0.1",
                port: audioPort,
            });
            await videoPlainTransport.connect({
                ip: "127.0.0.1",
                port: videoPort,
            });
            // Store transports
            room.audioPlainTransport = audioPlainTransport;
            room.videoPlainTransport = videoPlainTransport;
            room.recording = true;
            room.recordingStartTime = new Date();
            // Consume existing producers for recording
            await this.consumeProducersForRecording(roomId, audioPlainTransport, videoPlainTransport);
            // Start FFmpeg recording
            await ffmpegService_1.default.startRecording({
                roomId,
                audioPort,
                videoPort,
            });
            console.log(`Started recording for room ${roomId}`);
        }
        catch (error) {
            console.error(`Error starting recording for room ${roomId}:`, error);
            throw error;
        }
    }
    /**
     * Consume a new producer for an ongoing recording
     */
    async consumeNewProducerForRecording(roomId, producer) {
        const room = this.rooms.get(roomId);
        if (!room || !room.recording) {
            return;
        }
        console.log(`Consuming new ${producer.kind} producer ${producer.id} for ongoing recording`);
        try {
            const plainTransport = producer.kind === "audio"
                ? room.audioPlainTransport
                : room.videoPlainTransport;
            if (!plainTransport) {
                console.error(`No ${producer.kind} plain transport available for recording`);
                return;
            }
            const rtpCapabilities = producer.kind === "audio"
                ? {
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
                }
                : {
                    codecs: [
                        {
                            mimeType: "video/VP8",
                            kind: "video",
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
            console.log(`Successfully consuming ${producer.kind} producer ${producer.id} for recording`);
        }
        catch (error) {
            console.error(`Error consuming new ${producer.kind} producer for recording:`, error);
        }
    }
    /**
     * Consume existing producers for recording
     */
    async consumeProducersForRecording(roomId, audioPlainTransport, videoPlainTransport) {
        console.log(`Consuming producers for recording in room ${roomId}`);
        // Find all producers in the room
        const roomProducers = {
            audio: [],
            video: [],
        };
        for (const peer of this.peers.values()) {
            if (peer.roomId === roomId) {
                for (const producer of peer.producers.values()) {
                    if (producer.kind === "audio") {
                        roomProducers.audio.push(producer);
                    }
                    else if (producer.kind === "video") {
                        roomProducers.video.push(producer);
                    }
                }
            }
        }
        console.log(`Found ${roomProducers.audio.length} audio and ${roomProducers.video.length} video producers`);
        // Consume audio producers
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
                console.log(`Consuming audio producer ${audioProducer.id} for recording`);
                // Resume the consumer
                await consumer.resume();
            }
            catch (error) {
                console.error(`Error consuming audio producer ${audioProducer.id}:`, error);
            }
        }
        // Consume video producers
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
                console.log(`Consuming video producer ${videoProducer.id} for recording`);
                // Resume the consumer
                await consumer.resume();
            }
            catch (error) {
                console.error(`Error consuming video producer ${videoProducer.id}:`, error);
            }
        }
        if (roomProducers.audio.length === 0 && roomProducers.video.length === 0) {
            console.warn(`⚠️  No producers found in room ${roomId} for recording`);
            console.warn(`   This means no users have enabled camera/microphone yet.`);
            console.warn(`   FFmpeg will start but may not create files without input streams.`);
            console.warn(`   To fix: Have users join with camera/mic enabled before recording.`);
        }
        else {
            console.log(`✅ Found active producers - recording should work!`);
        }
    }
    /**
     * Stop recording a room
     */
    async stopRecording(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Room not found: ${roomId}`);
        }
        if (!room.recording) {
            throw new Error(`Room ${roomId} is not being recorded`);
        }
        try {
            // Stop FFmpeg recording
            await ffmpegService_1.default.stopRecording(roomId);
            // Close plain transports
            if (room.audioPlainTransport) {
                room.audioPlainTransport.close();
                room.audioPlainTransport = undefined;
            }
            if (room.videoPlainTransport) {
                room.videoPlainTransport.close();
                room.videoPlainTransport = undefined;
            }
            room.recording = false;
            room.recordingStartTime = undefined;
            console.log(`Stopped recording for room ${roomId}`);
        }
        catch (error) {
            console.error(`Error stopping recording for room ${roomId}:`, error);
            throw error;
        }
    }
    /**
     * Get router RTP capabilities
     */
    getRouterRtpCapabilities(roomId) {
        const room = this.rooms.get(roomId);
        return room ? room.router.rtpCapabilities : null;
    }
    /**
     * Remove peer
     */
    async removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer) {
            return;
        }
        try {
            // Close all transports (this will automatically close producers and consumers)
            for (const transport of peer.transports.values()) {
                transport.close();
            }
            this.peers.delete(peerId);
            console.log(`Removed peer: ${peerId}`);
            // Check if room is empty and clean up if necessary
            const roomPeers = Array.from(this.peers.values()).filter((p) => p.roomId === peer.roomId);
            if (roomPeers.length === 0) {
                await this.cleanupRoom(peer.roomId);
            }
        }
        catch (error) {
            console.error("Error removing peer:", error);
        }
    }
    /**
     * Clean up empty room
     */
    async cleanupRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        try {
            // Stop recording if active
            if (room.recording) {
                await this.stopRecording(roomId);
            }
            // Close router
            room.router.close();
            this.rooms.delete(roomId);
            console.log(`Cleaned up room: ${roomId}`);
        }
        catch (error) {
            console.error("Error cleaning up room:", error);
        }
    }
    /**
     * Get next available port
     */
    getNextPort() {
        return this.nextPort++;
    }
    /**
     * Get room info
     */
    getRoomInfo(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return null;
        }
        const peers = Array.from(this.peers.values()).filter((p) => p.roomId === roomId);
        return {
            id: roomId,
            peerCount: peers.length,
            recording: room.recording,
            recordingStartTime: room.recordingStartTime,
        };
    }
    /**
     * Get all rooms
     */
    getAllRooms() {
        return Array.from(this.rooms.keys()).map((roomId) => this.getRoomInfo(roomId));
    }
}
exports.MediasoupService = MediasoupService;
exports.default = new MediasoupService();
