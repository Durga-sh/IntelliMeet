import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

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

      // Handle WebRTC signaling
      socket.on("webrtc-signal", ({ targetUserId, signal, type }) => {
        try {
          const user = this.users.get(socket.id);
          if (!user) return;

          const room = this.rooms.get(user.roomId);
          if (!room) return;

          const targetUser = Array.from(room.users.values()).find(
            (u) => u.id === targetUserId
          );

          if (targetUser) {
            this.io.to(targetUser.socketId).emit("webrtc-signal", {
              fromUserId: user.id,
              signal,
              type,
            });
          }
        } catch (error) {
          console.error("Error handling WebRTC signal:", error);
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

  private handleUserLeave(socketId: string) {
    try {
      const user = this.users.get(socketId);
      if (!user) return;

      const room = this.rooms.get(user.roomId);
      if (room) {
        room.users.delete(user.id);

        // Notify other users
        this.io.to(user.roomId).emit("user-left", {
          userId: user.id,
          users: Array.from(room.users.values()),
        });

        // Clean up empty rooms
        if (room.users.size === 0) {
          this.rooms.delete(user.roomId);
          console.log(`Room ${user.roomId} deleted (empty)`);
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
