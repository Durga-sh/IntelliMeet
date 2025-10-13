import React from "react";
import { Button } from "./ui/button";
import { MessageCircle } from "lucide-react";
import { Badge } from "./ui/badge";

interface ChatButtonProps {
  onClick: () => void;
  unreadCount?: number;
  isActive?: boolean;
}

const ChatButton: React.FC<ChatButtonProps> = ({ 
  onClick, 
  unreadCount = 0, 
  isActive = false 
}) => {
  return (
    <div className="relative">
      <Button
        onClick={onClick}
        variant={isActive ? "default" : "outline"}
        size="lg"
        className="rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all hover:scale-105"
        title="Toggle Chat"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
      
      {unreadCount > 0 && (
        <Badge 
          className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full min-w-[1.25rem] h-5 flex items-center justify-center"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </div>
  );
};

export default ChatButton;