import { Socket } from "socket.io-client";

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  messageType: "text" | "file" | "system";
  timestamp: Date;
  deliveredTo: Array<{
    userId: string;
    deliveredAt: Date;
  }>;
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  isEdited: boolean;
  editedAt?: Date;
  replyTo?: string;
  reactions: Array<{
    userId: string;
    emoji: string;
    timestamp: Date;
  }>;
  fileInfo?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  };
}

export interface ChatServiceOptions {
  onMessageReceived?: (message: ChatMessage) => void;
  onMessageDelivered?: (messageId: string, deliveredCount: number) => void;
  onMessageEdited?: (message: ChatMessage) => void;
  onMessageDeleted?: (messageId: string, deletedBy: string) => void;
  onMessageRead?: (messageId: string, userId: string, userName: string) => void;
  onMessagesRead?: (
    messageIds: string[],
    userId: string,
    userName: string,
    count: number
  ) => void;
  onReactionAdded?: (
    messageId: string,
    userId: string,
    userName: string,
    emoji: string
  ) => void;
  onReactionRemoved?: (messageId: string, userId: string) => void;
  onTypingUpdate?: (
    userId: string,
    userName: string,
    isTyping: boolean
  ) => void;
  onMessagesHistory?: (messages: ChatMessage[], count: number) => void;
  onUnreadCount?: (count: number) => void;
  onSearchResults?: (
    messages: ChatMessage[],
    searchTerm: string,
    count: number
  ) => void;
  onError?: (error: string) => void;
}

export class ChatService {
  private socket: Socket | null = null;
  private options: ChatServiceOptions = {};
  private typingTimeout: NodeJS.Timeout | null = null;
  private currentRoomId: string | null = null;
  private isConnected: boolean = false;

  constructor(socket: Socket, options: ChatServiceOptions = {}) {
    this.socket = socket;
    this.options = options;
    this.setupSocketListeners();
    this.isConnected = true;
  }

  public setOptions(options: ChatServiceOptions): void {
    this.options = { ...this.options, ...options };
  }

  public setCurrentRoom(roomId: string): void {
    this.currentRoomId = roomId;
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Message received
    this.socket.on("chat-message-received", (data) => {
      console.log("🎯 FRONTEND: Received chat-message-received event:", data);
      console.log("Current room ID:", this.currentRoomId);
      console.log("Message room ID:", data.message?.roomId);

      if (data.message) {
        // Ensure timestamp is a Date object
        const message = {
          ...data.message,
          timestamp: new Date(data.message.timestamp),
        };
        console.log("✅ FRONTEND: Calling onMessageReceived with:", message);
        this.options.onMessageReceived?.(message);
      } else {
        console.warn("⚠️ FRONTEND: Received chat message without message data");
      }
    }); // Message delivered
    this.socket.on("chat-message-delivered", (data) => {
      console.log("Message delivered:", data);
      this.options.onMessageDelivered?.(
        data.messageId,
        data.deliveredCount || 0
      );
    });

    // Messages history
    this.socket.on("chat-messages-history", (data) => {
      console.log(
        "🎯 FRONTEND: Received chat-messages-history event:",
        data.count || 0,
        "messages"
      );
      if (data.messages) {
        const messages = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        console.log("✅ FRONTEND: Calling onMessagesHistory with:", messages);
        this.options.onMessagesHistory?.(
          messages,
          data.count || messages.length
        );
      } else {
        console.log("⚠️ FRONTEND: No messages in history response");
      }
    });

    // Message edited
    this.socket.on("chat-message-edited", (data) => {
      console.log("Message edited:", data);
      if (data.message) {
        const message = {
          ...data.message,
          timestamp: new Date(data.message.timestamp),
          editedAt: data.message.editedAt
            ? new Date(data.message.editedAt)
            : undefined,
        };
        this.options.onMessageEdited?.(message);
      }
    });

    // Message deleted
    this.socket.on("chat-message-deleted", (data) => {
      console.log("Message deleted:", data);
      this.options.onMessageDeleted?.(data.messageId, data.deletedBy);
    });

    // Single message read receipt
    this.socket.on("chat-message-read", (data) => {
      console.log("Message read:", data);
      this.options.onMessageRead?.(data.messageId, data.userId, data.userName);
    });

    // Multiple messages read receipt
    this.socket.on("chat-messages-read", (data) => {
      console.log("Messages read:", data);
      this.options.onMessagesRead?.(
        data.messageIds,
        data.userId,
        data.userName,
        data.count || 0
      );
    });

    // Reaction added
    this.socket.on("chat-reaction-added", (data) => {
      console.log("Reaction added:", data);
      this.options.onReactionAdded?.(
        data.messageId,
        data.userId,
        data.userName,
        data.emoji
      );
    });

    // Reaction removed
    this.socket.on("chat-reaction-removed", (data) => {
      console.log("Reaction removed:", data);
      this.options.onReactionRemoved?.(data.messageId, data.userId);
    });

    // Typing update
    this.socket.on("chat-typing-update", (data) => {
      console.log("Typing update:", data);
      this.options.onTypingUpdate?.(data.userId, data.userName, data.isTyping);
    });

    // Unread count
    this.socket.on("chat-unread-count", (data) => {
      console.log("Unread count:", data.count);
      this.options.onUnreadCount?.(data.count || 0);
    });

    // Search results
    this.socket.on("chat-search-results", (data) => {
      console.log("Search results:", data.count || 0, "messages found");
      if (data.messages) {
        const messages = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.options.onSearchResults?.(
          messages,
          data.searchTerm,
          data.count || messages.length
        );
      }
    });

    // Error handling
    this.socket.on("chat-error", (data) => {
      console.error("Chat error:", data);
      this.options.onError?.(data.message || "Unknown chat error");
    });

    // Connection events
    this.socket.on("connect", () => {
      console.log("Chat service connected");
      this.isConnected = true;
    });

    this.socket.on("disconnect", () => {
      console.log("Chat service disconnected");
      this.isConnected = false;
      this.stopTyping();
    });
  }

  /**
   * Check if service is connected
   */
  public isServiceConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Send a text message
   */
  public sendMessage(message: string, replyTo?: string): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      console.error("Cannot send message: Socket not connected");
      this.options.onError?.("Not connected to chat service");
      return false;
    }

    if (!message.trim()) {
      console.error("Cannot send empty message");
      return false;
    }

    console.log("ChatService: Sending message:", {
      message: message.trim(),
      messageType: "text",
      replyTo,
      currentRoomId: this.currentRoomId,
      socketConnected: this.socket?.connected,
      isServiceConnected: this.isServiceConnected(),
    });

    this.socket.emit("chat-send-message", {
      message: message.trim(),
      messageType: "text",
      replyTo,
    });

    console.log("ChatService: Message emit completed");
    return true;
  }

  /**
   * Send a file message
   */
  public sendFileMessage(
    message: string,
    fileInfo: {
      fileName: string;
      fileSize: number;
      fileType: string;
      fileUrl: string;
    }
  ): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      console.error("Cannot send file: Socket not connected");
      this.options.onError?.("Not connected to chat service");
      return false;
    }

    this.socket.emit("chat-send-message", {
      message: message || fileInfo.fileName,
      messageType: "file",
      fileInfo,
    });

    return true;
  }

  /**
   * Get message history
   */
  public getMessages(limit: number = 50, before?: Date): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      console.error("Cannot get messages: Socket not connected");
      return false;
    }

    this.socket.emit("chat-get-messages", {
      limit,
      before: before?.toISOString(),
    });

    return true;
  }

  /**
   * Mark message as read
   */
  public markMessageAsRead(messageId: string): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      return false;
    }

    this.socket.emit("chat-mark-read", { messageId });
    return true;
  }

  /**
   * Mark multiple messages as read
   */
  public markMessagesAsRead(messageIds: string[]): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      return false;
    }

    if (messageIds.length === 0) {
      return false;
    }

    this.socket.emit("chat-mark-read", { messageIds });
    return true;
  }

  /**
   * Edit a message
   */
  public editMessage(messageId: string, newMessage: string): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      console.error("Cannot edit message: Socket not connected");
      this.options.onError?.("Not connected to chat service");
      return false;
    }

    if (!newMessage.trim()) {
      console.error("Cannot edit to empty message");
      return false;
    }

    this.socket.emit("chat-edit-message", {
      messageId,
      newMessage: newMessage.trim(),
    });

    return true;
  }

  /**
   * Delete a message
   */
  public deleteMessage(messageId: string): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      console.error("Cannot delete message: Socket not connected");
      this.options.onError?.("Not connected to chat service");
      return false;
    }

    this.socket.emit("chat-delete-message", { messageId });
    return true;
  }

  /**
   * Add reaction to message
   */
  public addReaction(messageId: string, emoji: string): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      return false;
    }

    this.socket.emit("chat-add-reaction", { messageId, emoji });
    return true;
  }

  /**
   * Remove reaction from message
   */
  public removeReaction(messageId: string): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      return false;
    }

    this.socket.emit("chat-remove-reaction", { messageId });
    return true;
  }

  /**
   * Set typing status
   */
  public setTyping(isTyping: boolean): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      return false;
    }

    this.socket.emit("chat-typing", { isTyping });

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      this.typingTimeout = setTimeout(() => {
        this.setTyping(false);
      }, 3000);
    }

    return true;
  }

  /**
   * Start typing (convenience method for input events)
   */
  public startTyping(): boolean {
    return this.setTyping(true);
  }

  /**
   * Stop typing
   */
  public stopTyping(): boolean {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    return this.setTyping(false);
  }

  /**
   * Get unread message count
   */
  public getUnreadCount(): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      return false;
    }

    this.socket.emit("chat-get-unread-count");
    return true;
  }

  /**
   * Search messages
   */
  public searchMessages(searchTerm: string, limit: number = 20): boolean {
    if (!this.socket || !this.isServiceConnected()) {
      console.error("Cannot search: Socket not connected");
      return false;
    }

    if (!searchTerm.trim()) {
      return false;
    }

    this.socket.emit("chat-search-messages", {
      searchTerm: searchTerm.trim(),
      limit,
    });

    return true;
  }

  /**
   * Disconnect chat service
   */
  public disconnect(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    this.stopTyping();
    this.isConnected = false;
    this.socket = null;
    this.currentRoomId = null;
  }
}

export default ChatService;
