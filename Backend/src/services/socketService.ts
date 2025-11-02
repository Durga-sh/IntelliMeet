import { Server, Socket } from "socket.io";
import mediasoupService from "./mediasoupService";
import Room from "../models/Room";
import ChatMessage from "../models/ChatMessage";

interface UserTyping {
  userId: string;
  userName: string;
  roomId: string;
}

class SocketService {
  private io!: Server;
  private typingUsers: Map<string, UserTyping> = new Map();
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  initialize(io: Server) {
    this.io = io;

    io.on("connection", (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join room
      socket.on("join-room", async (data: { roomId: string; userName: string; userId: string }) => {
        try {
          const { roomId, userName, userId } = data;
          
          console.log(`Received join-room request:`, { roomId, userName, userId });
          
          socket.join(roomId);
          this.userSockets.set(userId, socket.id);

          // Add peer to mediasoup
          mediasoupService.addPeer(socket.id, roomId, userName);

          // Update room in database
          await this.updateRoomParticipants(roomId, userId, userName, "join");

          // Get router RTP capabilities
          console.log(` Creating router for room ${roomId}...`);
          const router = await mediasoupService.createRouter(roomId);
          const rtpCapabilities = router.rtpCapabilities;
          console.log(`Router created, RTP capabilities ready`);

          // Notify others in the room
          socket.to(roomId).emit("user-joined", {
            userId: socket.id,
            userName,
          });

          // Send router capabilities
          console.log(` Sending router-rtp-capabilities to client...`);
          socket.emit("router-rtp-capabilities", rtpCapabilities);
          console.log(`Sent router-rtp-capabilities`);

          // Send existing producers to new user
          const producers = mediasoupService.getProducersByRoom(roomId);
          console.log(`Sending ${producers.length} existing producers to new user:`, producers);
          socket.emit("existing-producers", producers);

          // Get room participants
          const participants = mediasoupService.getRoomPeers(roomId).map((peer) => ({
            id: peer.id,
            userName: peer.userName,
          }));

          console.log(`📤 Sending ${participants.length} room participants...`);
          socket.emit("room-participants", participants);

          console.log(`User ${userName} joined room ${roomId} successfully`);
        } catch (error) {
          console.error("Error joining room:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      });

      // Create WebRTC transport
      socket.on("create-transport", async (data: { roomId: string; direction: "send" | "recv" }) => {
        try {
          const { roomId, direction } = data;
          const transport = await mediasoupService.createWebRtcTransport(roomId, socket.id);

          socket.emit("transport-created", {
            direction,
            transport,
          });
        } catch (error) {
          console.error("Error creating transport:", error);
          socket.emit("error", { message: "Failed to create transport" });
        }
      });

      // Connect transport
      socket.on("connect-transport", async (data: { transportId: string; dtlsParameters: any }) => {
        try {
          console.log(`📥 Received connect-transport request for transport:`, data.transportId);
          const { transportId, dtlsParameters } = data;
          await mediasoupService.connectTransport(socket.id, transportId, dtlsParameters);
          console.log(`✅ Transport connected successfully`);

          socket.emit("transport-connected", { transportId });
          console.log(`📤 Sent transport-connected event`);
        } catch (error) {
          console.error("❌ Error connecting transport:", error);
          socket.emit("error", { message: "Failed to connect transport" });
        }
      });

      // Produce media
      socket.on(
        "produce",
        async (data: {
          transportId: string;
          kind: "audio" | "video";
          rtpParameters: any;
          appData: any;
        }) => {
          try {
            console.log(`📥 Received produce request for ${data.kind}`);
            const { transportId, kind, rtpParameters, appData } = data;
            const producerId = await mediasoupService.produce(
              socket.id,
              transportId,
              kind,
              rtpParameters,
              appData
            );
            console.log(`✅ Producer created for ${kind}, ID: ${producerId}`);

            socket.emit("produced", { producerId });
            console.log(`📤 Sent 'produced' event back to client`);

            // Notify other peers about new producer
            const peer = mediasoupService.getPeer(socket.id);
            if (peer) {
              socket.to(peer.roomId).emit("new-producer", {
                producerId,
                peerId: socket.id,
                kind,
              });
            }
          } catch (error) {
            console.error("Error producing:", error);
            socket.emit("error", { message: "Failed to produce media" });
          }
        }
      );

      // Consume media
      socket.on(
        "consume",
        async (data: { transportId: string; producerId: string; rtpCapabilities: any }) => {
          try {
            const { transportId, producerId, rtpCapabilities } = data;
            const consumerData = await mediasoupService.consume(
              socket.id,
              transportId,
              producerId,
              rtpCapabilities
            );

            socket.emit("consumed", consumerData);
          } catch (error) {
            console.error("Error consuming:", error);
            socket.emit("error", { message: "Failed to consume media" });
          }
        }
      );

      // Resume consumer
      socket.on("resume-consumer", async (data: { consumerId: string }) => {
        try {
          console.log(`📥 Received resume-consumer request for ${data.consumerId}`);
          const { consumerId } = data;
          await mediasoupService.resumeConsumer(socket.id, consumerId);
          console.log(`✅ Consumer resumed successfully`);

          socket.emit("resumed", { consumerId });
          console.log(`📤 Sent 'resumed' event`);
        } catch (error) {
          console.error("❌ Error resuming consumer:", error);
        }
      });

      // Pause/Resume producer
      socket.on("pause-producer", async (data: { producerId: string }) => {
        try {
          const { producerId } = data;
          await mediasoupService.pauseProducer(socket.id, producerId);

          const peer = mediasoupService.getPeer(socket.id);
          if (peer) {
            socket.to(peer.roomId).emit("producer-paused", {
              producerId,
              peerId: socket.id,
            });
          }
        } catch (error) {
          console.error("Error pausing producer:", error);
        }
      });

      socket.on("resume-producer", async (data: { producerId: string }) => {
        try {
          const { producerId } = data;
          await mediasoupService.resumeProducer(socket.id, producerId);

          const peer = mediasoupService.getPeer(socket.id);
          if (peer) {
            socket.to(peer.roomId).emit("producer-resumed", {
              producerId,
              peerId: socket.id,
            });
          }
        } catch (error) {
          console.error("Error resuming producer:", error);
        }
      });

      // Close producer
      socket.on("close-producer", async (data: { producerId: string }) => {
        try {
          const { producerId } = data;
          mediasoupService.closeProducer(socket.id, producerId);

          const peer = mediasoupService.getPeer(socket.id);
          if (peer) {
            socket.to(peer.roomId).emit("producer-closed", {
              producerId,
              peerId: socket.id,
            });
          }
        } catch (error) {
          console.error("Error closing producer:", error);
        }
      });

      // Chat messages
      socket.on("send-message", async (data: { roomId: string; message: string; userName: string; userId: string }) => {
        try {
          const { roomId, message, userName, userId } = data;

          // Save message to database
          const chatMessage = new ChatMessage({
            roomId,
            senderId: userId,
            senderName: userName,
            message,
            timestamp: new Date(),
          });

          await chatMessage.save();

          // Broadcast to room
          this.io.to(roomId).emit("new-message", {
            id: chatMessage._id,
            senderId: userId,
            senderName: userName,
            message,
            timestamp: chatMessage.timestamp,
          });

          // Send delivery receipts
          const roomParticipants = mediasoupService.getRoomPeers(roomId);
          const deliveredTo = roomParticipants
            .filter((p) => p.id !== socket.id)
            .map((p) => p.id);

          chatMessage.deliveredTo = deliveredTo;
          chatMessage.delivered = true;
          await chatMessage.save();

          socket.emit("message-delivered", {
            messageId: chatMessage._id,
            deliveredTo,
          });
        } catch (error) {
          console.error("Error sending message:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // Typing indicators
      socket.on("typing-start", (data: { roomId: string; userName: string; userId: string }) => {
        const { roomId, userName, userId } = data;
        
        this.typingUsers.set(socket.id, { userId, userName, roomId });
        
        socket.to(roomId).emit("user-typing", {
          userId,
          userName,
        });
      });

      socket.on("typing-stop", (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data;
        
        this.typingUsers.delete(socket.id);
        
        socket.to(roomId).emit("user-stopped-typing", {
          userId,
        });
      });

      // Message read receipts
      socket.on("message-read", async (data: { messageId: string; userId: string }) => {
        try {
          const { messageId, userId } = data;

          const message = await ChatMessage.findById(messageId);
          if (message && !message.readBy.includes(userId)) {
            message.readBy.push(userId);
            await message.save();

            this.io.to(message.roomId).emit("message-read-receipt", {
              messageId,
              userId,
            });
          }
        } catch (error) {
          console.error("Error marking message as read:", error);
        }
      });

      // Get chat history
      socket.on("get-chat-history", async (data: { roomId: string; limit?: number }) => {
        try {
          const { roomId, limit = 50 } = data;

          const messages = await ChatMessage.find({ roomId })
            .sort({ timestamp: -1 })
            .limit(limit);

          socket.emit("chat-history", messages.reverse());
        } catch (error) {
          console.error("Error fetching chat history:", error);
          socket.emit("error", { message: "Failed to fetch chat history" });
        }
      });

      // Screen sharing
      socket.on("start-screen-share", (data: { roomId: string }) => {
        const { roomId } = data;
        socket.to(roomId).emit("user-started-screen-share", {
          userId: socket.id,
        });
      });

      socket.on("stop-screen-share", (data: { roomId: string }) => {
        const { roomId } = data;
        socket.to(roomId).emit("user-stopped-screen-share", {
          userId: socket.id,
        });
      });

      // Disconnect
      socket.on("disconnect", async () => {
        console.log(`Client disconnected: ${socket.id}`);

        const peer = mediasoupService.getPeer(socket.id);
        if (peer) {
          // Update room in database
          await this.updateRoomParticipants(peer.roomId, socket.id, peer.userName, "leave");

          // Notify others
          socket.to(peer.roomId).emit("user-left", {
            userId: socket.id,
            userName: peer.userName,
          });

          // Remove typing indicator
          this.typingUsers.delete(socket.id);
          socket.to(peer.roomId).emit("user-stopped-typing", {
            userId: socket.id,
          });
        }

        // Remove peer from mediasoup
        mediasoupService.removePeer(socket.id);

        // Remove from userSockets map
        for (const [userId, socketId] of this.userSockets.entries()) {
          if (socketId === socket.id) {
            this.userSockets.delete(userId);
            break;
          }
        }
      });
    });
  }

  private async updateRoomParticipants(
    roomId: string,
    userId: string,
    userName: string,
    action: "join" | "leave"
  ) {
    try {
      let room = await Room.findOne({ roomId, isActive: true });

      if (!room && action === "join") {
        room = new Room({
          roomId,
          name: `Room ${roomId}`,
          createdBy: userId,
          isActive: true,
          participants: [],
        });
      }

      if (room) {
        if (action === "join") {
          room.participants.push({
            userId,
            userName,
            joinedAt: new Date(),
          });
        } else if (action === "leave") {
          const participant = room.participants.find(
            (p) => p.userId === userId && !p.leftAt
          );
          if (participant) {
            participant.leftAt = new Date();
          }
        }

        await room.save();
      }
    } catch (error) {
      console.error("Error updating room participants:", error);
    }
  }
}

export default new SocketService();
