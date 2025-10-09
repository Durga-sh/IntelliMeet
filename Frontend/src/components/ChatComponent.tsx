import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Smile, Paperclip, Search, MoreVertical, Reply, Edit2, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Card, CardContent } from "./ui/card";
import ChatService, { ChatMessage, ChatServiceOptions } from "../services/chatService";
import { Socket } from "socket.io-client";
import { useToast } from "./ui/use-toast";

interface ChatComponentProps {
  socket: Socket | null;
  currentUserId: string;
  currentUserName: string;
  roomId: string;
  isVisible: boolean;
  onToggle: () => void;
}

interface MessageGroup {
  userId: string;
  userName: string;
  messages: ChatMessage[];
  timestamp: Date;
}

const emojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "👏", "🎉"];

const ChatComponent: React.FC<ChatComponentProps> = ({
  socket,
  currentUserId,
  currentUserName,
  roomId,
  isVisible,
  onToggle,
}) => {
  console.log("ChatComponent rendered with props:", {
    socket: !!socket,
    currentUserId,
    currentUserName,
    roomId,
    isVisible
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const chatService = useRef<ChatService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Initialize chat service
  useEffect(() => {
    if (!socket) {
      console.error("Socket not available from webrtcService");
      console.log("WebRTC service socket:", socket);
      setConnectionError(true);
      setIsLoading(false);
      return;
    }

    console.log("Socket available:", socket?.connected, socket?.id);
    console.log("Room ID:", roomId, "User ID:", currentUserId);
    setConnectionError(false);

    const options: ChatServiceOptions = {
      onMessageReceived: (message: ChatMessage) => {
        console.log("ChatComponent: onMessageReceived called with:", message);
        console.log("Current messages count:", messages.length);
        
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === message.id)) {
            console.log("Duplicate message detected, skipping:", message.id);
            return prev;
          }
          console.log("Adding new message to state");
          const newMessages = [...prev, message];
          console.log("New messages count:", newMessages.length);
          return newMessages;
        });
        
        if (message.userId !== currentUserId && isVisible) {
          // Auto-mark as read if chat is visible
          chatService.current?.markMessageAsRead(message.id);
        } else if (message.userId !== currentUserId) {
          // Increment unread count
          setUnreadCount(prev => prev + 1);
        }
      },

      onMessageDelivered: (messageId: string, deliveredCount: number) => {
        console.log(`Message ${messageId} delivered to ${deliveredCount} users`);
      },

      onMessageEdited: (message: ChatMessage) => {
        setMessages(prev => prev.map(m => m.id === message.id ? message : m));
      },

      onMessageDeleted: (messageId: string) => {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      },

      onMessageRead: (messageId: string, userId: string) => {
        setMessages(prev => prev.map(m => {
          if (m.id === messageId) {
            const readBy = [...m.readBy];
            if (!readBy.find(r => r.userId === userId)) {
              readBy.push({ userId, readAt: new Date() });
            }
            return { ...m, readBy };
          }
          return m;
        }));
      },

      onMessagesRead: (messageIds: string[], userId: string) => {
        setMessages(prev => prev.map(m => {
          if (messageIds.includes(m.id)) {
            const readBy = [...m.readBy];
            if (!readBy.find(r => r.userId === userId)) {
              readBy.push({ userId, readAt: new Date() });
            }
            return { ...m, readBy };
          }
          return m;
        }));
      },

      onReactionAdded: (messageId: string, userId: string, _userName: string, emoji: string) => {
        setMessages(prev => prev.map(m => {
          if (m.id === messageId) {
            const reactions = m.reactions.filter(r => r.userId !== userId);
            reactions.push({ userId, emoji, timestamp: new Date() });
            return { ...m, reactions };
          }
          return m;
        }));
      },

      onReactionRemoved: (messageId: string, userId: string) => {
        setMessages(prev => prev.map(m => {
          if (m.id === messageId) {
            const reactions = m.reactions.filter(r => r.userId !== userId);
            return { ...m, reactions };
          }
          return m;
        }));
      },

      onTypingUpdate: (userId: string, userName: string, isTyping: boolean) => {
        if (userId === currentUserId) return;
        
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (isTyping) {
            newSet.add(userName);
          } else {
            newSet.delete(userName);
          }
          return newSet;
        });
      },

      onMessagesHistory: (historyMessages: ChatMessage[], count: number) => {
        console.log(`Loaded ${count} messages`);
        setMessages(historyMessages);
        setIsLoading(false);
        
        // Mark visible messages as read
        if (isVisible) {
          const unreadMessageIds = historyMessages
            .filter(m => m.userId !== currentUserId && !m.readBy.find(r => r.userId === currentUserId))
            .map(m => m.id);
          
          if (unreadMessageIds.length > 0) {
            chatService.current?.markMessagesAsRead(unreadMessageIds);
            setUnreadCount(0);
          }
        }
      },

      onUnreadCount: (count: number) => {
        setUnreadCount(count);
      },

      onSearchResults: (results: ChatMessage[], searchTerm: string, count: number) => {
        console.log(`Found ${count} messages for "${searchTerm}"`);
        setSearchResults(results);
        setIsSearching(false);
      },

      onError: (error: string) => {
        console.error("Chat error:", error);
        toast({
          title: "Chat Error",
          description: error,
          variant: "destructive",
        });
      }
    };

    console.log("Creating ChatService with socket:", socket);
    chatService.current = new ChatService(socket, options);
    chatService.current.setCurrentRoom(roomId);
    console.log("ChatService created, setting room:", roomId);

    // Load initial messages
    console.log("Requesting initial messages...");
    const messagesRequested = chatService.current.getMessages(50);
    console.log("Messages request result:", messagesRequested);

    // Set a timeout to stop loading if no response
    const loadingTimeout = setTimeout(() => {
      console.log("Loading timeout - no messages received, stopping loading state");
      setIsLoading(false);
    }, 3000);

    return () => {
      clearTimeout(loadingTimeout);
      chatService.current?.disconnect();
    };
  }, [socket, currentUserId, roomId, isVisible, toast]);

  // Update unread count when visibility changes
  useEffect(() => {
    if (isVisible && chatService.current) {
      // Mark all unread messages as read
      const unreadMessageIds = messages
        .filter(m => m.userId !== currentUserId && !m.readBy.find(r => r.userId === currentUserId))
        .map(m => m.id);
      
      if (unreadMessageIds.length > 0) {
        chatService.current.markMessagesAsRead(unreadMessageIds);
        setUnreadCount(0);
      }
    }
  }, [isVisible, currentUserId, messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isVisible) {
      scrollToBottom();
    }
  }, [messages, isVisible]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim() || !chatService.current) return;

    const success = editingMessage
      ? chatService.current.editMessage(editingMessage.id, newMessage)
      : chatService.current.sendMessage(newMessage, replyingTo?.id);

    if (success) {
      setNewMessage("");
      setEditingMessage(null);
      setReplyingTo(null);
      chatService.current.stopTyping();
    }
  }, [newMessage, editingMessage, replyingTo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (chatService.current) {
      if (e.target.value.length > 0) {
        chatService.current.startTyping();
      } else {
        chatService.current.stopTyping();
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === "Escape") {
      setReplyingTo(null);
      setEditingMessage(null);
      setNewMessage("");
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim() || !chatService.current) return;
    
    setIsSearching(true);
    chatService.current.searchMessages(searchTerm);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!chatService.current) return;

    const message = messages.find(m => m.id === messageId);
    const existingReaction = message?.reactions.find(r => r.userId === currentUserId);

    if (existingReaction?.emoji === emoji) {
      chatService.current.removeReaction(messageId);
    } else {
      chatService.current.addReaction(messageId, emoji);
    }
    
    setShowEmojiPicker(null);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!chatService.current) return;
    if (window.confirm("Are you sure you want to delete this message?")) {
      chatService.current.deleteMessage(messageId);
    }
  };

  const handleEditMessage = (message: ChatMessage) => {
    setEditingMessage(message);
    setNewMessage(message.message);
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message);
    setEditingMessage(null);
    inputRef.current?.focus();
  };

  const cancelEditOrReply = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setNewMessage("");
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(date));
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    const isToday = messageDate.toDateString() === today.toDateString();
    
    if (isToday) {
      return "Today";
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = messageDate.toDateString() === yesterday.toDateString();
    
    if (isYesterday) {
      return "Yesterday";
    }
    
    return messageDate.toLocaleDateString();
  };

  // Group messages by user and time proximity
  const groupedMessages = messages.reduce<MessageGroup[]>((groups, message) => {
    const lastGroup = groups[groups.length - 1];
    const messageTime = new Date(message.timestamp);
    
    if (
      lastGroup &&
      lastGroup.userId === message.userId &&
      messageTime.getTime() - lastGroup.timestamp.getTime() < 300000
    ) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        userId: message.userId,
        userName: message.userName,
        messages: [message],
        timestamp: messageTime
      });
    }
    
    return groups;
  }, []);

  const renderMessage = (message: ChatMessage, isGrouped: boolean = false) => {
    const isOwn = message.userId === currentUserId;
    const isReplying = message.replyTo;
    const replyMessage = isReplying ? messages.find(m => m.id === message.replyTo) : null;

    return (
      <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isGrouped ? "mb-1" : "mb-2"}`}>
        <div className={`max-w-xs lg:max-w-md ${isOwn ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"} rounded-lg px-3 py-2 relative group`}>
          {/* Reply indicator */}
          {replyMessage && (
            <div className={`text-xs opacity-70 mb-1 border-l-2 pl-2 ${isOwn ? "border-white" : "border-gray-400"}`}>
              <div className="font-semibold">{replyMessage.userName}</div>
              <div className="truncate">{replyMessage.message}</div>
            </div>
          )}

          {/* Message content */}
          <div className="break-words whitespace-pre-wrap">
            {message.message}
            {message.isEdited && <span className="text-xs opacity-70 ml-2">(edited)</span>}
          </div>

          {/* File info */}
          {message.fileInfo && (
            <div className={`mt-2 p-2 rounded text-xs ${isOwn ? "bg-white bg-opacity-20" : "bg-gray-300"}`}>
              <div className="font-semibold">{message.fileInfo.fileName}</div>
              <div>{(message.fileInfo.fileSize / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          )}

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Array.from(new Set(message.reactions.map(r => r.emoji))).map((emoji) => {
                const count = message.reactions.filter(r => r.emoji === emoji).length;
                const hasReacted = message.reactions.some(r => r.emoji === emoji && r.userId === currentUserId);
                return (
                  <span
                    key={emoji}
                    className={`rounded-full px-2 py-0.5 text-xs cursor-pointer transition-colors ${
                      hasReacted 
                        ? "bg-blue-100 border border-blue-400" 
                        : isOwn ? "bg-white bg-opacity-20 hover:bg-opacity-30" : "bg-gray-300 hover:bg-gray-400"
                    }`}
                    onClick={() => handleReaction(message.id, emoji)}
                  >
                    {emoji} {count > 1 && count}
                  </span>
                );
              })}
            </div>
          )}

          {/* Timestamp and status */}
          <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
            <span>{formatTime(message.timestamp)}</span>
            {isOwn && (
              <div className="flex items-center space-x-1">
                {message.deliveredTo.length > 0 && <span>✓</span>}
                {message.readBy.length > 0 && <span className="text-blue-200">✓✓</span>}
              </div>
            )}
          </div>

          {/* Message options */}
          <div className="absolute top-0 -right-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <Popover open={showEmojiPicker === message.id} onOpenChange={(open) => !open && setShowEmojiPicker(null)}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-8 h-8 p-0 bg-white shadow-md hover:bg-gray-100"
                  onClick={() => setShowEmojiPicker(message.id)}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => handleReply(message)}
                  >
                    <Reply className="w-3 h-3 mr-2" />
                    Reply
                  </Button>
                  
                  {/* Emoji picker inline */}
                  <div className="p-2 border-t">
                    <div className="text-xs font-semibold mb-2">React</div>
                    <div className="grid grid-cols-4 gap-1">
                      {emojis.map((emoji) => (
                        <Button
                          key={emoji}
                          variant="ghost"
                          size="sm"
                          className="w-8 h-8 p-0 text-lg hover:bg-gray-100"
                          onClick={() => handleReaction(message.id, emoji)}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {isOwn && (
                    <>
                      <div className="border-t my-1"></div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm"
                        onClick={() => handleEditMessage(message)}
                      >
                        <Edit2 className="w-3 h-3 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteMessage(message.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    );
  };

  if (connectionError) {
    return (
      <Sheet open={isVisible} onOpenChange={onToggle}>
        <SheetContent side="right" className="w-80 sm:w-96">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 mb-2">Connection Error</p>
              <p className="text-sm text-gray-500">Unable to connect to chat service</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isVisible} onOpenChange={onToggle}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle>Chat</SheetTitle>
          <div className="flex items-center space-x-2 mt-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="text-sm pr-8"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-2"
                  onClick={clearSearch}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button size="sm" onClick={handleSearch} disabled={isSearching || !searchTerm.trim()}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Loading messages...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search Results */}
              {searchResults.length > 0 && (
                <Card className="sticky top-0 z-10">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Search Results ({searchResults.length})</h4>
                      <Button variant="ghost" size="sm" onClick={clearSearch}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {searchResults.map((message) => (
                        <div key={message.id} className="text-sm p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100">
                          <div className="font-medium">{message.userName}</div>
                          <div className="truncate">{message.message}</div>
                          <div className="text-xs text-gray-500">{formatTime(message.timestamp)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {messages.length === 0 && !isLoading && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 text-center">
                    No messages yet.<br />
                    <span className="text-sm">Start the conversation!</span>
                  </p>
                </div>
              )}

              {/* Message Groups */}
              {groupedMessages.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {/* Date separator */}
                  {(groupIndex === 0 || 
                    formatDate(group.timestamp) !== formatDate(groupedMessages[groupIndex - 1].timestamp)
                  ) && (
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                        {formatDate(group.timestamp)}
                      </div>
                    </div>
                  )}

                  {/* User name for non-own messages */}
                  {group.userId !== currentUserId && (
                    <div className="text-xs font-semibold text-gray-600 mb-1 ml-1">
                      {group.userName}
                    </div>
                  )}

                  {/* Messages in group */}
                  {group.messages.map((message, messageIndex) => 
                    renderMessage(message, messageIndex > 0)
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                      <span>
                        {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Reply/Edit indicator */}
        {(replyingTo || editingMessage) && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-blue-900 mb-1">
                  {editingMessage ? (
                    <span className="flex items-center">
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editing message
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Reply className="w-3 h-3 mr-1" />
                      Replying to <strong className="ml-1">{replyingTo?.userName}</strong>
                    </span>
                  )}
                </div>
                {!editingMessage && replyingTo && (
                  <div className="text-xs text-gray-600 truncate">
                    {replyingTo.message}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 ml-2"
                onClick={cancelEditOrReply}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t shrink-0 bg-white">
          <div className="flex items-end space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="shrink-0"
              disabled
              title="File upload (coming soon)"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                value={newMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                disabled={connectionError}
                className="resize-none"
              />
            </div>
            <Button 
              size="sm" 
              onClick={handleSendMessage} 
              disabled={!newMessage.trim() || connectionError}
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center">
            Press Enter to send, Esc to cancel
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatComponent;