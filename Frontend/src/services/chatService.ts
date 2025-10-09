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

export interface TypingUser {
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface ChatServiceOptions {
  onMessageReceived?: (message: ChatMessage) => void;
  onMessageEdited?: (message: ChatMessage) => void;
  onMessageDeleted?: (messageId: string, deletedBy: string) => void;
  onMessageRead?: (messageId: string, userId: string, userName: string) => void;
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
  onMessagesHistory?: (messages: ChatMessage[]) => void;
  onUnreadCount?: (count: number) => void;
  onSearchResults?: (messages: ChatMessage[], searchTerm: string) => void;
  onError?: (error: string) => void;
}

export class ChatService {
  private socket: Socket | null = null;
  private options: ChatServiceOptions = {};
  private typingTimeout: NodeJS.Timeout | null = null;
  private currentRoomId: string | null = null;

  constructor(socket: Socket, options: ChatServiceOptions = {}) {
    this.socket = socket;
    this.options = options;
    this.setupSocketListeners();
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
      console.log("Chat message received:", data);
      this.options.onMessageReceived?.(data.message);
    });

    // Messages history
    this.socket.on("chat-messages-history", (data) => {
      console.log("Chat messages history:", data);
      this.options.onMessagesHistory?.(data.messages);
    });

    // Message edited
    this.socket.on("chat-message-edited", (data) => {
      console.log("Message edited:", data);
      this.options.onMessageEdited?.(data.message);
    });

    // Message deleted
    this.socket.on("chat-message-deleted", (data) => {
      console.log("Message deleted:", data);
      this.options.onMessageDeleted?.(data.messageId, data.deletedBy);
    });

    // Message read receipt
    this.socket.on("chat-message-read", (data) => {
      console.log("Message read:", data);
      this.options.onMessageRead?.(data.messageId, data.userId, data.userName);
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
      console.log("Unread count:", data);
      this.options.onUnreadCount?.(data.count);
    });

    // Search results
    this.socket.on("chat-search-results", (data) => {
      console.log("Search results:", data);
      this.options.onSearchResults?.(data.messages, data.searchTerm);
    });

    // Error handling
    this.socket.on("chat-error", (data) => {
      console.error("Chat error:", data);
      this.options.onError?.(data.message);
    });
  }

  /**
   * Send a text message
   */
  public sendMessage(message: string, replyTo?: string): void {
    if (!this.socket || !message.trim()) return;

    this.socket.emit("chat-send-message", {
      message: message.trim(),
      messageType: "text",
      replyTo,
    });
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
  ): void {
    if (!this.socket) return;

    this.socket.emit("chat-send-message", {
      message: message || fileInfo.fileName,
      messageType: "file",
      fileInfo,
    });
  }

  /**
   * Get message history
   */
  public getMessages(limit: number = 50, before?: Date): void {
    if (!this.socket) return;

    this.socket.emit("chat-get-messages", {
      limit,
      before: before?.toISOString(),
    });
  }

  /**
   * Mark message as read
   */
  public markMessageAsRead(messageId: string): void {
    if (!this.socket) return;

    this.socket.emit("chat-mark-read", { messageId });
  }

  /**
   * Mark multiple messages as read
   */
  public markMessagesAsRead(messageIds: string[]): void {
    if (!this.socket || messageIds.length === 0) return;

    this.socket.emit("chat-mark-read", { messageIds });
  }

  /**
   * Edit a message
   */
  public editMessage(messageId: string, newMessage: string): void {
    if (!this.socket || !newMessage.trim()) return;

    this.socket.emit("chat-edit-message", {
      messageId,
      newMessage: newMessage.trim(),
    });
  }

  /**
   * Delete a message
   */
  public deleteMessage(messageId: string): void {
    if (!this.socket) return;

    this.socket.emit("chat-delete-message", { messageId });
  }

  /**
   * Add reaction to message
   */
  public addReaction(messageId: string, emoji: string): void {
    if (!this.socket) return;

    this.socket.emit("chat-add-reaction", { messageId, emoji });
  }

  /**
   * Remove reaction from message
   */
  public removeReaction(messageId: string): void {
    if (!this.socket) return;

    this.socket.emit("chat-remove-reaction", { messageId });
  }

  /**
   * Set typing status
   */
  public setTyping(isTyping: boolean): void {
    if (!this.socket) return;

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
  }

  /**
   * Start typing (convenience method for input events)
   */
  public startTyping(): void {
    this.setTyping(true);
  }

  /**
   * Stop typing
   */
  public stopTyping(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    this.setTyping(false);
  }

  /**
   * Get unread message count
   */
  public getUnreadCount(): void {
    if (!this.socket) return;

    this.socket.emit("chat-get-unread-count");
  }

  /**
   * Search messages
   */
  public searchMessages(searchTerm: string, limit: number = 20): void {
    if (!this.socket || !searchTerm.trim()) return;

    this.socket.emit("chat-search-messages", {
      searchTerm: searchTerm.trim(),
      limit,
    });
  }

  /**
   * Disconnect chat service
   */
  public disconnect(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    this.socket = null;
    this.currentRoomId = null;
  }
}

export default ChatService;
