import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import mediasoupService from "./mediasoupService";
import recordingService from "./recordingService";
import chatService from "./chatService";
import {
  RtpCapabilities,
  DtlsParameters,
  RtpParameters,
} from "mediasoup/node/lib/types";

interface User {
  id: string;
  socketId: string;
  name: string;
  roomId: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
}

interface Room {
  id: string;
  users: Map<string, User>;
  createdAt: Date;
}

class SocketService {
  private io: Server;
  private rooms: Map<string, Room> = new Map();
  private users: Map<string, User> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Join a room
      socket.on("join-room", ({ roomId, user }) => {
        try {
          if (!roomId || roomId.trim() === "") {
            console.log("Empty room ID received from client");
            socket.emit("error", { message: "Room ID is required" });
            return;
          }

          console.log(
            `Join room request - Room ID: "${roomId}", User: "${user?.name}"`
          );

          const userId = uuidv4();
          const newUser: User = {
            id: userId,
            socketId: socket.id,
            name: user.name || `User ${socket.id.substring(0, 5)}`,
            roomId,
            isVideoEnabled: true,
            isAudioEnabled: true,
            isScreenSharing: false,
          };

          // Create room if it doesn't exist
          if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
              id: roomId,
              users: new Map(),
              createdAt: new Date(),
            });
          }

          const room = this.rooms.get(roomId)!;
          room.users.set(userId, newUser);
          this.users.set(socket.id, newUser);

          socket.join(roomId);

          // Notify user they joined successfully
          socket.emit("joined-room", {
            roomId,
            userId,
            users: Array.from(room.users.values()),
          });

          // Notify other users in the room
          socket.to(roomId).emit("user-joined", {
            user: newUser,
            users: Array.from(room.users.values()),
          });

          console.log(`User ${newUser.name} joined room ${roomId}`);
        } catch (error) {
          console.error("Error joining room:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      });

      // Get router RTP capabilities
      // Get router RTP capabilities - FIXED VERSION
      socket.on("getRouterRtpCapabilities", async ({ roomId }) => {
        try {
          console.log(`📋 Getting router RTP capabilities for room ${roomId}`);

          // CRITICAL FIX: Create the mediasoup room first
          await mediasoupService.createRoom(roomId);

          // Now get the RTP capabilities
          const rtpCapabilities =
            mediasoupService.getRouterRtpCapabilities(roomId);

          if (!rtpCapabilities) {
            console.error(
              `❌ Failed to get RTP capabilities for room ${roomId}`
            );
            socket.emit("error", {
              message: "Failed to get router capabilities",
            });
            return;
          }

          console.log(`✅ Sending RTP capabilities for room ${roomId}`);
          console.log(`   Codecs: ${rtpCapabilities.codecs?.length || 0}`);

          // Get existing producers for this room
          const user = this.users.get(socket.id);
          const existingProducers = user ? mediasoupService.getExistingProducers(roomId, user.id) : [];
          console.log(`📺 Found ${existingProducers.length} existing producers for new peer`);

          socket.emit("routerRtpCapabilities", { 
            rtpCapabilities,
            existingProducers
          });
        } catch (error) {
          console.error("❌ Error getting router RTP capabilities:", error);
          socket.emit("error", {
            message: "Failed to get router capabilities",
          });
        }
      });

      // Create WebRTC transport
      socket.on("createWebRtcTransport", async ({ roomId, direction }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const transportOptions = await mediasoupService.createWebRtcTransport(
            roomId,
            user.id,
            direction
          );

          socket.emit("webRtcTransportCreated", {
            direction,
            ...transportOptions,
          });
        } catch (error) {
          console.error("Error creating WebRTC transport:", error);
          socket.emit("error", { message: "Failed to create transport" });
        }
      });

      // Connect WebRTC transport
      socket.on(
        "connectWebRtcTransport",
        async ({ transportId, dtlsParameters }) => {
          try {
            const user = this.users.get(socket.id);
            if (!user) return;

            await mediasoupService.connectWebRtcTransport(
              user.id,
              transportId,
              dtlsParameters
            );

            socket.emit("webRtcTransportConnected", { transportId });
          } catch (error) {
            console.error("Error connecting WebRTC transport:", error);
            socket.emit("error", { message: "Failed to connect transport" });
          }
        }
      );

      // Create producer
      socket.on(
        "createProducer",
        async ({ transportId, kind, rtpParameters }) => {
          try {
            const user = this.users.get(socket.id);
            if (!user) return;

            const producerId = await mediasoupService.createProducer(
              user.id,
              transportId,
              rtpParameters,
              kind
            );

            socket.emit("producerCreated", { producerId, kind });

            // Notify other peers in the room about the new producer
            const room = this.rooms.get(user.roomId);
            if (room) {
              console.log(`📢 Notifying other peers about new producer ${producerId} from ${user.name}`);
              socket.to(user.roomId).emit("newProducer", {
                producerId,
                producerUserId: user.id,
                producerUserName: user.name,
                kind
              });
            }
          } catch (error) {
            console.error("Error creating producer:", error);
            socket.emit("error", { message: "Failed to create producer" });
          }
        }
      );

      // Create consumer
      socket.on("createConsumer", async ({ producerId, rtpCapabilities }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const consumerData = await mediasoupService.createConsumer(
            user.id,
            producerId,
            rtpCapabilities
          );

          if (consumerData) {
            socket.emit("consumerCreated", consumerData);
          } else {
            socket.emit("error", { message: "Cannot consume this producer" });
          }
        } catch (error) {
          console.error("Error creating consumer:", error);
          socket.emit("error", { message: "Failed to create consumer" });
        }
      });

      // Resume consumer
      socket.on("resumeConsumer", async ({ consumerId }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          await mediasoupService.resumeConsumer(user.id, consumerId);
          socket.emit("consumerResumed", { consumerId });
        } catch (error) {
          console.error("Error resuming consumer:", error);
          socket.emit("error", { message: "Failed to resume consumer" });
        }
      });

      // Handle offer
      socket.on("webrtc-offer", ({ targetUserId, offer }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const room = this.rooms.get(user.roomId);
          if (!room) return;

          const targetUser = Array.from(room.users.values()).find(
            (u) => u.id === targetUserId
          );

          if (targetUser) {
            this.io.to(targetUser.socketId).emit("webrtc-offer", {
              fromUserId: user.id,
              offer,
            });
          }
        } catch (error) {
          console.error("Error handling WebRTC offer:", error);
        }
      });

      // Handle answer
      socket.on("webrtc-answer", ({ targetUserId, answer }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const room = this.rooms.get(user.roomId);
          if (!room) return;

          const targetUser = Array.from(room.users.values()).find(
            (u) => u.id === targetUserId
          );

          if (targetUser) {
            this.io.to(targetUser.socketId).emit("webrtc-answer", {
              fromUserId: user.id,
              answer,
            });
          }
        } catch (error) {
          console.error("Error handling WebRTC answer:", error);
        }
      });

      // Handle ICE candidate
      socket.on("webrtc-ice-candidate", ({ targetUserId, candidate }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const room = this.rooms.get(user.roomId);
          if (!room) return;

          const targetUser = Array.from(room.users.values()).find(
            (u) => u.id === targetUserId
          );

          if (targetUser) {
            this.io.to(targetUser.socketId).emit("webrtc-ice-candidate", {
              fromUserId: user.id,
              candidate,
            });
          }
        } catch (error) {
          console.error("Error handling ICE candidate:", error);
        }
      });

      // Toggle video
      socket.on("toggle-video", ({ isVideoEnabled }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          user.isVideoEnabled = isVideoEnabled;
          const room = this.rooms.get(user.roomId);
          if (!room) return;

          socket.to(user.roomId).emit("user-video-toggled", {
            userId: user.id,
            isVideoEnabled,
          });
        } catch (error) {
          console.error("Error toggling video:", error);
        }
      });

      // Toggle audio
      socket.on("toggle-audio", ({ isAudioEnabled }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          user.isAudioEnabled = isAudioEnabled;
          const room = this.rooms.get(user.roomId);
          if (!room) return;

          socket.to(user.roomId).emit("user-audio-toggled", {
            userId: user.id,
            isAudioEnabled,
          });
        } catch (error) {
          console.error("Error toggling audio:", error);
        }
      });

      // Toggle screen sharing
      socket.on("toggle-screen-share", ({ isScreenSharing }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          user.isScreenSharing = isScreenSharing;
          const room = this.rooms.get(user.roomId);
          if (!room) return;

          socket.to(user.roomId).emit("user-screen-share-toggled", {
            userId: user.id,
            isScreenSharing,
          });
        } catch (error) {
          console.error("Error toggling screen share:", error);
        }
      });

      // Start recording
      socket.on("start-recording", async ({ roomId }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user || user.roomId !== roomId) return;

          const room = this.rooms.get(roomId);
          if (!room) return;

          const participants = Array.from(room.users.values()).map(
            (u) => u.name
          );
          const recording = await recordingService.startRecording(
            roomId,
            participants
          );

          this.io.to(roomId).emit("recording-started", {
            recordingId: recording.id,
            startTime: recording.startTime,
          });
        } catch (error) {
          console.error("Error starting recording:", error);
          socket.emit("error", { message: "Failed to start recording" });
        }
      });

      // Stop recording
      socket.on("stop-recording", async ({ roomId }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user || user.roomId !== roomId) return;

          const recording = await recordingService.stopRecording(roomId);
          if (recording) {
            this.io.to(roomId).emit("recording-stopped", {
              recordingId: recording.id,
              endTime: new Date(),
            });
          }
        } catch (error) {
          console.error("Error stopping recording:", error);
          socket.emit("error", { message: "Failed to stop recording" });
        }
      });

      // Get recording status
      socket.on("get-recording-status", ({ roomId }) => {
        try {
          const recording = recordingService.getRecording(roomId);
          socket.emit("recording-status", {
            recording: recording
              ? {
                  id: recording.id,
                  status: recording.status,
                  startTime: recording.startTime,
                  endTime: recording.endTime,
                  duration: recording.duration,
                }
              : null,
          });
        } catch (error) {
          console.error("Error getting recording status:", error);
          socket.emit("error", { message: "Failed to get recording status" });
        }
      });

      // ========== ENHANCED CHAT FUNCTIONALITY ==========

      // Send chat message
      socket.on("chat-send-message", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) {
            socket.emit("chat-error", { message: "User not found" });
            return;
          }

          console.log("Chat message received:", {
            from: user.name,
            roomId: user.roomId,
            messageType: data.messageType || "text",
            message: data.message,
          });

          // Validate message content
          if (!data.message || !data.message.trim()) {
            console.log("Empty message rejected");
            socket.emit("chat-error", { message: "Message cannot be empty" });
            return;
          }

          // Stop typing indicator when message is sent
          chatService.setTyping(user.roomId, user.id, user.name, false);

          const message = await chatService.sendMessage({
            roomId: user.roomId,
            userId: user.id,
            userName: user.name,
            message: data.message,
            messageType: data.messageType || "text",
            replyTo: data.replyTo,
            fileInfo: data.fileInfo,
          });

          // Convert to plain object for transmission
          const messageObj = {
            id: message.id,
            roomId: message.roomId,
            userId: message.userId,
            userName: message.userName,
            message: message.message,
            messageType: message.messageType,
            timestamp: message.timestamp,
            deliveredTo: message.deliveredTo,
            readBy: message.readBy,
            isEdited: message.isEdited,
            editedAt: message.editedAt,
            replyTo: message.replyTo,
            reactions: message.reactions,
            fileInfo: message.fileInfo,
          };

          console.log("Broadcasting message to room:", user.roomId);
          console.log("Message object:", messageObj);
          console.log(
            "Room users:",
            Array.from(this.rooms.get(user.roomId)?.users.values() || []).map(
              (u) => u.name
            )
          );

          // Broadcast message to all users in the room (including sender)
          this.io.to(user.roomId).emit("chat-message-received", {
            message: messageObj,
          });

          // Mark as delivered for all users in the room except sender
          const room = this.rooms.get(user.roomId);
          if (room) {
            const otherUsers = Array.from(room.users.values()).filter(
              (u) => u.id !== user.id
            );

            for (const otherUser of otherUsers) {
              await chatService.markAsDelivered(message.id, otherUser.id);
            }

            // Notify sender that message was delivered
            socket.emit("chat-message-delivered", {
              messageId: message.id,
              deliveredCount: otherUsers.length,
            });
          }
        } catch (error) {
          console.error("Error sending chat message:", error);
          socket.emit("chat-error", {
            message: "Failed to send message",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });

      // Get chat history
      socket.on("chat-get-messages", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) {
            socket.emit("chat-error", { message: "User not found" });
            return;
          }

          const limit = data?.limit || 50;
          const before = data?.before ? new Date(data.before) : undefined;

          console.log(`Loading ${limit} messages for room ${user.roomId}`);

          const messages = await chatService.getMessages(
            user.roomId,
            limit,
            before
          );

          socket.emit("chat-messages-history", {
            messages,
            roomId: user.roomId,
            count: messages.length,
          });

          console.log(`Sent ${messages.length} messages to ${user.name}`);
        } catch (error) {
          console.error("Error getting chat messages:", error);
          socket.emit("chat-error", { message: "Failed to get messages" });
        }
      });

      // Mark message as read
      socket.on("chat-mark-read", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          if (Array.isArray(data.messageIds)) {
            // Mark multiple messages as read
            const count = await chatService.markMessagesAsRead(
              data.messageIds,
              user.id
            );

            if (count > 0) {
              // Notify other users in the room about read receipts
              socket.to(user.roomId).emit("chat-messages-read", {
                messageIds: data.messageIds,
                userId: user.id,
                userName: user.name,
                readAt: new Date(),
                count,
              });
            }
          } else if (data.messageId) {
            // Mark single message as read
            const success = await chatService.markAsRead(
              data.messageId,
              user.id
            );

            if (success) {
              socket.to(user.roomId).emit("chat-message-read", {
                messageId: data.messageId,
                userId: user.id,
                userName: user.name,
                readAt: new Date(),
              });
            }
          }
        } catch (error) {
          console.error("Error marking message as read:", error);
        }
      });

      // Edit message
      socket.on("chat-edit-message", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) {
            socket.emit("chat-error", { message: "User not found" });
            return;
          }

          if (!data.messageId || !data.newMessage || !data.newMessage.trim()) {
            socket.emit("chat-error", { message: "Invalid message data" });
            return;
          }

          const updatedMessage = await chatService.editMessage(
            data.messageId,
            user.id,
            data.newMessage
          );

          if (updatedMessage) {
            // Broadcast edited message to all users in the room
            this.io.to(user.roomId).emit("chat-message-edited", {
              message: updatedMessage,
              editedAt: updatedMessage.editedAt,
            });
          } else {
            socket.emit("chat-error", {
              message:
                "Failed to edit message - you can only edit your own messages",
            });
          }
        } catch (error) {
          console.error("Error editing message:", error);
          socket.emit("chat-error", { message: "Failed to edit message" });
        }
      });

      // Delete message
      socket.on("chat-delete-message", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) {
            socket.emit("chat-error", { message: "User not found" });
            return;
          }

          if (!data.messageId) {
            socket.emit("chat-error", { message: "Message ID required" });
            return;
          }

          const success = await chatService.deleteMessage(
            data.messageId,
            user.id
          );

          if (success) {
            // Broadcast message deletion to all users in the room
            this.io.to(user.roomId).emit("chat-message-deleted", {
              messageId: data.messageId,
              deletedBy: user.id,
              deletedAt: new Date(),
            });
          } else {
            socket.emit("chat-error", {
              message:
                "Failed to delete message - you can only delete your own messages",
            });
          }
        } catch (error) {
          console.error("Error deleting message:", error);
          socket.emit("chat-error", { message: "Failed to delete message" });
        }
      });

      // Add reaction to message
      socket.on("chat-add-reaction", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          if (!data.messageId || !data.emoji) {
            socket.emit("chat-error", { message: "Invalid reaction data" });
            return;
          }

          const success = await chatService.addReaction(
            data.messageId,
            user.id,
            data.emoji
          );

          if (success) {
            // Broadcast reaction to all users in the room
            this.io.to(user.roomId).emit("chat-reaction-added", {
              messageId: data.messageId,
              userId: user.id,
              userName: user.name,
              emoji: data.emoji,
              timestamp: new Date(),
            });
          }
        } catch (error) {
          console.error("Error adding reaction:", error);
          socket.emit("chat-error", { message: "Failed to add reaction" });
        }
      });

      // Remove reaction from message
      socket.on("chat-remove-reaction", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          if (!data.messageId) {
            socket.emit("chat-error", { message: "Message ID required" });
            return;
          }

          const success = await chatService.removeReaction(
            data.messageId,
            user.id
          );

          if (success) {
            // Broadcast reaction removal to all users in the room
            this.io.to(user.roomId).emit("chat-reaction-removed", {
              messageId: data.messageId,
              userId: user.id,
              timestamp: new Date(),
            });
          }
        } catch (error) {
          console.error("Error removing reaction:", error);
          socket.emit("chat-error", { message: "Failed to remove reaction" });
        }
      });

      // Typing indicator
      socket.on("chat-typing", (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const isTyping = Boolean(data?.isTyping);
          chatService.setTyping(user.roomId, user.id, user.name, isTyping);

          // Broadcast typing status to other users in the room (exclude sender)
          socket.to(user.roomId).emit("chat-typing-update", {
            userId: user.id,
            userName: user.name,
            isTyping,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error("Error handling typing:", error);
        }
      });

      // Get unread message count
      socket.on("chat-get-unread-count", async () => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const unreadCount = await chatService.getUnreadCount(
            user.roomId,
            user.id
          );

          socket.emit("chat-unread-count", {
            count: unreadCount,
            roomId: user.roomId,
          });
        } catch (error) {
          console.error("Error getting unread count:", error);
          socket.emit("chat-unread-count", { count: 0, roomId: null });
        }
      });

      // Search messages
      socket.on("chat-search-messages", async (data) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) {
            socket.emit("chat-error", { message: "User not found" });
            return;
          }

          if (!data?.searchTerm || !data.searchTerm.trim()) {
            socket.emit("chat-search-results", {
              messages: [],
              searchTerm: "",
              roomId: user.roomId,
            });
            return;
          }

          const messages = await chatService.searchMessages(
            user.roomId,
            data.searchTerm,
            data.limit || 20
          );

          socket.emit("chat-search-results", {
            messages,
            searchTerm: data.searchTerm,
            roomId: user.roomId,
            count: messages.length,
          });
        } catch (error) {
          console.error("Error searching messages:", error);
          socket.emit("chat-error", { message: "Failed to search messages" });
        }
      });

      // ========== END ENHANCED CHAT FUNCTIONALITY ==========

      // Leave room
      socket.on("leave-room", () => {
        this.handleUserLeave(socket.id);
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        this.handleUserLeave(socket.id);
      });
    });
  }

  private async handleUserLeave(socketId: string) {
    try {
      const user = this.users.get(socketId);
      if (!user) return;

      const room = this.rooms.get(user.roomId);
      if (room) {
        room.users.delete(user.id);

        // Clear typing status
        chatService.clearUserTyping(user.roomId, user.id);

        // Notify other users
        this.io.to(user.roomId).emit("user-left", {
          userId: user.id,
          users: Array.from(room.users.values()),
        });

        // Clean up mediasoup peer
        await mediasoupService.removePeer(user.id);

        // Clean up empty rooms
        if (room.users.size === 0) {
          this.rooms.delete(user.roomId);
          console.log(`Room ${user.roomId} deleted (empty)`);

          // Stop recording if active
          const recording = recordingService.getRecording(user.roomId);
          if (recording && recording.status === "recording") {
            await recordingService.stopRecording(user.roomId);
          }
        } else {
          // Update recording participants
          const participants = Array.from(room.users.values()).map(
            (u) => u.name
          );
          recordingService.updateRecordingParticipants(
            user.roomId,
            participants
          );
        }
      }

      this.users.delete(socketId);
      console.log(`User ${user.name} left room ${user.roomId}`);
    } catch (error) {
      console.error("Error handling user leave:", error);
    }
  }

  // Get room info
  public getRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      users: Array.from(room.users.values()),
      createdAt: room.createdAt,
      userCount: room.users.size,
    };
  }

  // Get all rooms
  public getAllRooms() {
    return Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      userCount: room.users.size,
      createdAt: room.createdAt,
    }));
  }
}

export default SocketService;
