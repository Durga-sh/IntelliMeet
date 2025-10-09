import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Smile, Paperclip, Search, MoreVertical, Reply, Edit2, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Card, CardContent } from "./ui/card";
import ChatService, { ChatMessage, ChatServiceOptions } from "../services/chatService";
import { Socket } from "socket.io-client";

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
  onToggle
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [, setUnreadCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

  const chatService = useRef<ChatService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize chat service
  useEffect(() => {
    if (!socket) return;

    const options: ChatServiceOptions = {
      onMessageReceived: (message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
        if (message.userId !== currentUserId && isVisible) {
          // Auto-mark as read if chat is visible
          chatService.current?.markMessageAsRead(message.id);
        }
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

      onReactionAdded: (messageId: string, userId: string, _userName: string, emoji: string) => {
        setMessages(prev => prev.map(m => {
          if (m.id === messageId) {
            const reactions = m.reactions.filter(r => r.userId !== userId); // Remove existing reaction
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
        if (userId === currentUserId) return; // Don't show own typing
        
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

      onMessagesHistory: (historyMessages: ChatMessage[]) => {
        setMessages(historyMessages);
        // Mark all messages as read when loading history
        const unreadMessageIds = historyMessages
          .filter(m => m.userId !== currentUserId && !m.readBy.find(r => r.userId === currentUserId))
          .map(m => m.id);
        
        if (unreadMessageIds.length > 0) {
          chatService.current?.markMessagesAsRead(unreadMessageIds);
        }
      },

      onUnreadCount: (count: number) => {
        setUnreadCount(count);
      },

      onSearchResults: (results: ChatMessage[]) => {
        setSearchResults(results);
        setIsSearching(false);
      },

      onError: (error: string) => {
        console.error("Chat error:", error);
        // You could show a toast notification here
      }
    };

    chatService.current = new ChatService(socket, options);
    chatService.current.setCurrentRoom(roomId);

    // Load initial messages
    chatService.current.getMessages(50);
    chatService.current.getUnreadCount();

    return () => {
      chatService.current?.disconnect();
    };
  }, [socket, currentUserId, roomId, isVisible]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim() || !chatService.current) return;

    if (editingMessage) {
      // Edit existing message
      chatService.current.editMessage(editingMessage.id, newMessage);
      setEditingMessage(null);
    } else {
      // Send new message
      chatService.current.sendMessage(newMessage, replyingTo?.id);
      setReplyingTo(null);
    }

    setNewMessage("");
    chatService.current.stopTyping();
  }, [newMessage, editingMessage, replyingTo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Handle typing indicator
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
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim() || !chatService.current) return;
    
    setIsSearching(true);
    chatService.current.searchMessages(searchTerm);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!chatService.current) return;

    // Check if user already reacted with this emoji
    const message = messages.find(m => m.id === messageId);
    const existingReaction = message?.reactions.find(r => r.userId === currentUserId);

    if (existingReaction?.emoji === emoji) {
      // Remove reaction if same emoji
      chatService.current.removeReaction(messageId);
    } else {
      // Add or change reaction
      chatService.current.addReaction(messageId, emoji);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!chatService.current) return;
    chatService.current.deleteMessage(messageId);
  };

  const handleEditMessage = (message: ChatMessage) => {
    setEditingMessage(message);
    setNewMessage(message.message);
    inputRef.current?.focus();
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
      messageTime.getTime() - lastGroup.timestamp.getTime() < 300000 // 5 minutes
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

  const renderMessage = (message: ChatMessage, _isGrouped: boolean = false) => {
    const isOwn = message.userId === currentUserId;
    const isReplying = message.replyTo;
    const replyMessage = isReplying ? messages.find(m => m.id === message.replyTo) : null;

    return (
      <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
        <div className={`max-w-xs lg:max-w-md ${isOwn ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"} rounded-lg px-3 py-2 relative group`}>
          {/* Reply indicator */}
          {replyMessage && (
            <div className="text-xs opacity-70 mb-1 border-l-2 border-gray-400 pl-2">
              <div className="font-semibold">{replyMessage.userName}</div>
              <div className="truncate">{replyMessage.message}</div>
            </div>
          )}

          {/* Message content */}
          <div className="break-words">
            {message.message}
            {message.isEdited && <span className="text-xs opacity-70 ml-2">(edited)</span>}
          </div>

          {/* File info */}
          {message.fileInfo && (
            <div className="mt-2 p-2 bg-white bg-opacity-20 rounded text-xs">
              <div className="font-semibold">{message.fileInfo.fileName}</div>
              <div>{(message.fileInfo.fileSize / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          )}

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map((reaction, index) => (
                <span
                  key={index}
                  className="bg-white bg-opacity-20 rounded-full px-2 py-1 text-xs cursor-pointer hover:bg-opacity-30"
                  onClick={() => handleReaction(message.id, reaction.emoji)}
                >
                  {reaction.emoji}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp and status */}
          <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
            <span>{formatTime(message.timestamp)}</span>
            {isOwn && (
              <div className="flex items-center space-x-1">
                {message.deliveredTo.length > 0 && <span>✓</span>}
                {message.readBy.length > 0 && <span>✓✓</span>}
              </div>
            )}
          </div>

          {/* Message options */}
          <div className="absolute top-0 right-0 -mr-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1">
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setReplyingTo(message)}
                  >
                    <Reply className="w-3 h-3 mr-2" />
                    Reply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowEmojiPicker(message.id)}
                  >
                    <Smile className="w-3 h-3 mr-2" />
                    React
                  </Button>
                  {isOwn && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleEditMessage(message)}
                      >
                        <Edit2 className="w-3 h-3 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-red-600"
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

            {/* Emoji picker */}
            {showEmojiPicker === message.id && (
              <Popover open={showEmojiPicker === message.id} onOpenChange={() => setShowEmojiPicker(null)}>
                <PopoverContent className="w-auto p-2">
                  <div className="grid grid-cols-4 gap-1">
                    {emojis.map((emoji) => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => {
                          handleReaction(message.id, emoji);
                          setShowEmojiPicker(null);
                        }}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isVisible} onOpenChange={onToggle}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Chat</SheetTitle>
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <Input
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="text-sm"
                />
              </div>
              <Button size="sm" onClick={handleSearch} disabled={isSearching}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Search Results */}
              {searchResults.length > 0 && (
                <Card>
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-sm mb-2">Search Results</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {searchResults.map((message) => (
                        <div key={message.id} className="text-sm p-2 bg-gray-50 rounded">
                          <div className="font-medium">{message.userName}</div>
                          <div className="truncate">{message.message}</div>
                          <div className="text-xs text-gray-500">{formatTime(message.timestamp)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Message Groups */}
              {groupedMessages.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {/* Date separator */}
                  {(groupIndex === 0 || 
                    formatDate(group.timestamp) !== formatDate(groupedMessages[groupIndex - 1].timestamp)
                  ) && (
                    <div className="text-center text-xs text-gray-500 my-4">
                      {formatDate(group.timestamp)}
                    </div>
                  )}

                  {/* User name for non-own messages */}
                  {group.userId !== currentUserId && (
                    <div className="text-xs font-semibold text-gray-600 mb-1">
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
                    {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Reply/Edit indicator */}
          {(replyingTo || editingMessage) && (
            <div className="p-2 bg-blue-50 border-t border-blue-200">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {editingMessage ? (
                    <span>Editing message</span>
                  ) : (
                    <span>Replying to <strong>{replyingTo?.userName}</strong></span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyingTo(null);
                    setEditingMessage(null);
                    setNewMessage("");
                  }}
                >
                  ✕
                </Button>
              </div>
              {!editingMessage && replyingTo && (
                <div className="text-xs text-gray-600 truncate mt-1">
                  {replyingTo.message}
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Paperclip className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                />
              </div>
              <Button size="sm" onClick={handleSendMessage} disabled={!newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatComponent;