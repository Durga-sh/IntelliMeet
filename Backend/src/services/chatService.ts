import { EventEmitter } from "events";
import ChatMessage, { IChatMessage } from "../models/ChatMessage";
import { v4 as uuidv4 } from "uuid";

export interface ChatMessageData {
  id?: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  messageType?: "text" | "file" | "system";
  replyTo?: string;
  fileInfo?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  };
}

export interface TypingUser {
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface MessageReaction {
  messageId: string;
  userId: string;
  emoji: string;
}

export class ChatService extends EventEmitter {
  private typingUsers: Map<string, Map<string, TypingUser>> = new Map(); // roomId -> userId -> TypingUser
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map(); // userId -> timeout

  constructor() {
    super();
    this.setupTypingCleanup();
  }

  /**
   * Send a new message
   */
  async sendMessage(messageData: ChatMessageData): Promise<IChatMessage> {
    try {
      const messageId = messageData.id || uuidv4();

      const chatMessage = new ChatMessage({
        id: messageId,
        roomId: messageData.roomId,
        userId: messageData.userId,
        userName: messageData.userName,
        message: messageData.message,
        messageType: messageData.messageType || "text",
        replyTo: messageData.replyTo,
        fileInfo: messageData.fileInfo,
        timestamp: new Date(),
        deliveredTo: [],
        readBy: [],
        reactions: [],
      });

      const savedMessage = await chatMessage.save();
      this.emit("message-sent", savedMessage);

      return savedMessage;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get messages for a room with pagination
   */
  async getMessages(
    roomId: string,
    limit: number = 50,
    before?: Date
  ): Promise<IChatMessage[]> {
    try {
      const query: any = { roomId };

      if (before) {
        query.timestamp = { $lt: before };
      }

      const messages = await ChatMessage.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      console.error("Error getting messages:", error);
      throw error;
    }
  }

  /**
   * Mark message as delivered to a user
   */
  async markAsDelivered(messageId: string, userId: string): Promise<void> {
    try {
      await ChatMessage.updateOne(
        {
          id: messageId,
          "deliveredTo.userId": { $ne: userId },
        },
        {
          $push: {
            deliveredTo: {
              userId,
              deliveredAt: new Date(),
            },
          },
        }
      );

      this.emit("message-delivered", { messageId, userId });
    } catch (error) {
      console.error("Error marking message as delivered:", error);
      throw error;
    }
  }

  /**
   * Mark message as read by a user
   */
  async markAsRead(messageId: string, userId: string): Promise<void> {
    try {
      // First mark as delivered if not already
      await this.markAsDelivered(messageId, userId);

      // Then mark as read
      await ChatMessage.updateOne(
        {
          id: messageId,
          "readBy.userId": { $ne: userId },
        },
        {
          $push: {
            readBy: {
              userId,
              readAt: new Date(),
            },
          },
        }
      );

      this.emit("message-read", { messageId, userId });
    } catch (error) {
      console.error("Error marking message as read:", error);
      throw error;
    }
  }

  /**
   * Mark multiple messages as read
   */
  async markMessagesAsRead(
    messageIds: string[],
    userId: string
  ): Promise<void> {
    try {
      for (const messageId of messageIds) {
        await this.markAsRead(messageId, userId);
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: string,
    userId: string,
    newMessage: string
  ): Promise<IChatMessage | null> {
    try {
      const updatedMessage = await ChatMessage.findOneAndUpdate(
        { id: messageId, userId }, // Only allow user to edit their own messages
        {
          message: newMessage,
          isEdited: true,
          editedAt: new Date(),
        },
        { new: true }
      );

      if (updatedMessage) {
        this.emit("message-edited", updatedMessage);
      }

      return updatedMessage;
    } catch (error) {
      console.error("Error editing message:", error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const result = await ChatMessage.deleteOne({ id: messageId, userId });

      if (result.deletedCount > 0) {
        this.emit("message-deleted", { messageId, userId });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  /**
   * Add reaction to a message
   */
  async addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    try {
      // Remove existing reaction from this user first
      await ChatMessage.updateOne(
        { id: messageId },
        {
          $pull: {
            reactions: { userId },
          },
        }
      );

      // Add new reaction
      await ChatMessage.updateOne(
        { id: messageId },
        {
          $push: {
            reactions: {
              userId,
              emoji,
              timestamp: new Date(),
            },
          },
        }
      );

      this.emit("message-reaction-added", { messageId, userId, emoji });
    } catch (error) {
      console.error("Error adding reaction:", error);
      throw error;
    }
  }

  /**
   * Remove reaction from a message
   */
  async removeReaction(messageId: string, userId: string): Promise<void> {
    try {
      await ChatMessage.updateOne(
        { id: messageId },
        {
          $pull: {
            reactions: { userId },
          },
        }
      );

      this.emit("message-reaction-removed", { messageId, userId });
    } catch (error) {
      console.error("Error removing reaction:", error);
      throw error;
    }
  }

  /**
   * Set user typing status
   */
  setTyping(
    roomId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): void {
    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Map());
    }

    const roomTyping = this.typingUsers.get(roomId)!;

    // Clear existing timeout for this user
    const existingTimeout = this.typingTimeouts.get(`${roomId}-${userId}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    if (isTyping) {
      // Add user to typing list
      roomTyping.set(userId, {
        userId,
        userName,
        timestamp: new Date(),
      });

      // Set timeout to remove typing status after 3 seconds
      const timeout = setTimeout(() => {
        this.setTyping(roomId, userId, userName, false);
      }, 3000);

      this.typingTimeouts.set(`${roomId}-${userId}`, timeout);
    } else {
      // Remove user from typing list
      roomTyping.delete(userId);
      this.typingTimeouts.delete(`${roomId}-${userId}`);
    }

    // Emit typing update
    this.emit("typing-update", {
      roomId,
      typingUsers: Array.from(roomTyping.values()),
    });
  }

  /**
   * Get currently typing users for a room
   */
  getTypingUsers(roomId: string): TypingUser[] {
    const roomTyping = this.typingUsers.get(roomId);
    return roomTyping ? Array.from(roomTyping.values()) : [];
  }

  /**
   * Clean up typing users periodically
   */
  private setupTypingCleanup(): void {
    setInterval(() => {
      const now = new Date();

      for (const [roomId, roomTyping] of this.typingUsers) {
        for (const [userId, typingUser] of roomTyping) {
          // Remove users who have been typing for more than 5 seconds
          if (now.getTime() - typingUser.timestamp.getTime() > 5000) {
            roomTyping.delete(userId);
            this.typingTimeouts.delete(`${roomId}-${userId}`);

            this.emit("typing-update", {
              roomId,
              typingUsers: Array.from(roomTyping.values()),
            });
          }
        }
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Clear typing status for user when they leave a room
   */
  clearUserTyping(roomId: string, userId: string): void {
    const roomTyping = this.typingUsers.get(roomId);
    if (roomTyping && roomTyping.has(userId)) {
      roomTyping.delete(userId);

      const timeout = this.typingTimeouts.get(`${roomId}-${userId}`);
      if (timeout) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(`${roomId}-${userId}`);
      }

      this.emit("typing-update", {
        roomId,
        typingUsers: Array.from(roomTyping.values()),
      });
    }
  }

  /**
   * Get unread message count for a user in a room
   */
  async getUnreadCount(roomId: string, userId: string): Promise<number> {
    try {
      const count = await ChatMessage.countDocuments({
        roomId,
        userId: { $ne: userId }, // Exclude user's own messages
        "readBy.userId": { $ne: userId }, // Messages not read by user
      });

      return count;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  /**
   * Search messages in a room
   */
  async searchMessages(
    roomId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<IChatMessage[]> {
    try {
      const messages = await ChatMessage.find({
        roomId,
        message: { $regex: searchTerm, $options: "i" },
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();

      return messages;
    } catch (error) {
      console.error("Error searching messages:", error);
      throw error;
    }
  }
}

export default new ChatService();
