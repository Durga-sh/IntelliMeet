"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const events_1 = require("events");
const ChatMessage_1 = __importDefault(require("../models/ChatMessage"));
const uuid_1 = require("uuid");
class ChatService extends events_1.EventEmitter {
    constructor() {
        super();
        this.typingUsers = new Map();
        this.typingTimeouts = new Map();
        this.setupTypingCleanup();
    }
    /**
     * Send a new message
     */
    async sendMessage(messageData) {
        try {
            const messageId = messageData.id || (0, uuid_1.v4)();
            const chatMessage = new ChatMessage_1.default({
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
                isEdited: false,
            });
            const savedMessage = await chatMessage.save();
            // Convert to plain object with proper date serialization
            const messageObj = savedMessage.toObject();
            this.emit("message-sent", messageObj);
            return savedMessage;
        }
        catch (error) {
            console.error("Error sending message:", error);
            throw new Error("Failed to send message");
        }
    }
    /**
     * Get messages for a room with pagination
     */
    async getMessages(roomId, limit = 50, before) {
        try {
            const query = { roomId };
            if (before) {
                query.timestamp = { $lt: before };
            }
            const messages = await ChatMessage_1.default.find(query)
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean()
                .exec();
            return messages.reverse(); // Return in chronological order
        }
        catch (error) {
            console.error("Error getting messages:", error);
            throw new Error("Failed to get messages");
        }
    }
    /**
     * Mark message as delivered to a user
     */
    async markAsDelivered(messageId, userId) {
        try {
            const result = await ChatMessage_1.default.updateOne({
                id: messageId,
                "deliveredTo.userId": { $ne: userId },
            }, {
                $push: {
                    deliveredTo: {
                        userId,
                        deliveredAt: new Date(),
                    },
                },
            });
            if (result.modifiedCount > 0) {
                this.emit("message-delivered", { messageId, userId });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("Error marking message as delivered:", error);
            return false;
        }
    }
    /**
     * Mark message as read by a user
     */
    async markAsRead(messageId, userId) {
        try {
            // First mark as delivered if not already
            await this.markAsDelivered(messageId, userId);
            // Then mark as read
            const result = await ChatMessage_1.default.updateOne({
                id: messageId,
                "readBy.userId": { $ne: userId },
            }, {
                $push: {
                    readBy: {
                        userId,
                        readAt: new Date(),
                    },
                },
            });
            if (result.modifiedCount > 0) {
                this.emit("message-read", { messageId, userId });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("Error marking message as read:", error);
            return false;
        }
    }
    /**
     * Mark multiple messages as read
     */
    async markMessagesAsRead(messageIds, userId) {
        try {
            let count = 0;
            for (const messageId of messageIds) {
                const success = await this.markAsRead(messageId, userId);
                if (success)
                    count++;
            }
            return count;
        }
        catch (error) {
            console.error("Error marking messages as read:", error);
            return 0;
        }
    }
    /**
     * Edit a message
     */
    async editMessage(messageId, userId, newMessage) {
        try {
            const updatedMessage = await ChatMessage_1.default.findOneAndUpdate({ id: messageId, userId }, {
                message: newMessage,
                isEdited: true,
                editedAt: new Date(),
            }, { new: true }).lean();
            if (updatedMessage) {
                this.emit("message-edited", updatedMessage);
            }
            return updatedMessage;
        }
        catch (error) {
            console.error("Error editing message:", error);
            return null;
        }
    }
    /**
     * Delete a message
     */
    async deleteMessage(messageId, userId) {
        try {
            const result = await ChatMessage_1.default.deleteOne({ id: messageId, userId });
            if (result.deletedCount > 0) {
                this.emit("message-deleted", { messageId, userId });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("Error deleting message:", error);
            return false;
        }
    }
    /**
     * Add reaction to a message
     */
    async addReaction(messageId, userId, emoji) {
        try {
            // Remove existing reaction from this user first
            await ChatMessage_1.default.updateOne({ id: messageId }, {
                $pull: {
                    reactions: { userId },
                },
            });
            // Add new reaction
            const result = await ChatMessage_1.default.updateOne({ id: messageId }, {
                $push: {
                    reactions: {
                        userId,
                        emoji,
                        timestamp: new Date(),
                    },
                },
            });
            if (result.modifiedCount > 0) {
                this.emit("message-reaction-added", { messageId, userId, emoji });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("Error adding reaction:", error);
            return false;
        }
    }
    /**
     * Remove reaction from a message
     */
    async removeReaction(messageId, userId) {
        try {
            const result = await ChatMessage_1.default.updateOne({ id: messageId }, {
                $pull: {
                    reactions: { userId },
                },
            });
            if (result.modifiedCount > 0) {
                this.emit("message-reaction-removed", { messageId, userId });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("Error removing reaction:", error);
            return false;
        }
    }
    /**
     * Set user typing status
     */
    setTyping(roomId, userId, userName, isTyping) {
        if (!this.typingUsers.has(roomId)) {
            this.typingUsers.set(roomId, new Map());
        }
        const roomTyping = this.typingUsers.get(roomId);
        const timeoutKey = `${roomId}-${userId}`;
        // Clear existing timeout for this user
        const existingTimeout = this.typingTimeouts.get(timeoutKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            this.typingTimeouts.delete(timeoutKey);
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
            this.typingTimeouts.set(timeoutKey, timeout);
        }
        else {
            // Remove user from typing list
            roomTyping.delete(userId);
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
    getTypingUsers(roomId) {
        const roomTyping = this.typingUsers.get(roomId);
        return roomTyping ? Array.from(roomTyping.values()) : [];
    }
    /**
     * Clean up typing users periodically
     */
    setupTypingCleanup() {
        setInterval(() => {
            const now = new Date();
            for (const [roomId, roomTyping] of this.typingUsers) {
                for (const [userId, typingUser] of roomTyping) {
                    // Remove users who have been typing for more than 5 seconds
                    if (now.getTime() - typingUser.timestamp.getTime() > 5000) {
                        roomTyping.delete(userId);
                        const timeoutKey = `${roomId}-${userId}`;
                        const timeout = this.typingTimeouts.get(timeoutKey);
                        if (timeout) {
                            clearTimeout(timeout);
                            this.typingTimeouts.delete(timeoutKey);
                        }
                        this.emit("typing-update", {
                            roomId,
                            typingUsers: Array.from(roomTyping.values()),
                        });
                    }
                }
            }
        }, 2000);
    }
    /**
     * Clear typing status for user when they leave a room
     */
    clearUserTyping(roomId, userId) {
        const roomTyping = this.typingUsers.get(roomId);
        if (roomTyping && roomTyping.has(userId)) {
            roomTyping.delete(userId);
            const timeoutKey = `${roomId}-${userId}`;
            const timeout = this.typingTimeouts.get(timeoutKey);
            if (timeout) {
                clearTimeout(timeout);
                this.typingTimeouts.delete(timeoutKey);
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
    async getUnreadCount(roomId, userId) {
        try {
            const count = await ChatMessage_1.default.countDocuments({
                roomId,
                userId: { $ne: userId },
                "readBy.userId": { $ne: userId },
            });
            return count;
        }
        catch (error) {
            console.error("Error getting unread count:", error);
            return 0;
        }
    }
    /**
     * Search messages in a room
     */
    async searchMessages(roomId, searchTerm, limit = 20) {
        try {
            const messages = await ChatMessage_1.default.find({
                roomId,
                message: { $regex: searchTerm, $options: "i" },
            })
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean()
                .exec();
            return messages;
        }
        catch (error) {
            console.error("Error searching messages:", error);
            return [];
        }
    }
    /**
     * Delete all messages in a room (cleanup)
     */
    async deleteRoomMessages(roomId) {
        try {
            const result = await ChatMessage_1.default.deleteMany({ roomId });
            return result.deletedCount || 0;
        }
        catch (error) {
            console.error("Error deleting room messages:", error);
            return 0;
        }
    }
}
exports.ChatService = ChatService;
exports.default = new ChatService();
