import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Video, Users, Plus } from "lucide-react";
import { createRoom, joinRoom } from "../api/videoCall";

interface JoinCallProps {
  onJoinCall: (roomId: string, userName: string) => void;
  onError: (error: string) => void;
}

const JoinCall: React.FC<JoinCallProps> = ({ onJoinCall, onError }) => {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<"join" | "create">("join");

  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      onError("Please enter your name");
      return;
    }

    setIsCreating(true);
    try {
      const response = await createRoom({
        roomName: roomName.trim() || undefined,
        createdBy: userName.trim(),
      });

      if (response.success) {
        // Store username in localStorage for future use
        localStorage.setItem("userName", userName.trim());
        onJoinCall(response.room.id, userName.trim());
      } else {
        onError(response.message || "Failed to create room");
      }
    } catch (error: any) {
      console.error("Error creating room:", error);
      onError(error.response?.data?.message || "Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      onError("Please enter a room ID");
      return;
    }

    if (!userName.trim()) {
      onError("Please enter your name");
      return;
    }

    setIsJoining(true);
    try {
      const response = await joinRoom(roomId.trim(), {
        userName: userName.trim(),
      });

      if (response.success) {
        // Store username in localStorage for future use
        localStorage.setItem("userName", userName.trim());
        onJoinCall(roomId.trim(), userName.trim());
      } else {
        onError(response.message || "Failed to join room");
      }
    } catch (error: any) {
      console.error("Error joining room:", error);
      onError(error.response?.data?.message || "Failed to join room");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)] border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
            <Video className="h-8 w-8 text-ai-primary" />
            <span className="bg-gradient-to-r from-ai-primary to-ai-secondary bg-clip-text text-transparent">IntelliMeet</span>
          </CardTitle>
          <p className="text-muted-foreground mt-2">Join or create a video call</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Tab Selection */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("join")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === "join"
                  ? "bg-card text-ai-primary shadow-sm border border-ai-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4 inline mr-1" />
              Join Room
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === "create"
                  ? "bg-card text-ai-primary shadow-sm border border-ai-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="h-4 w-4 inline mr-1" />
              Create Room
            </button>
          </div>

          {/* Your Name Input (common for both tabs) */}
          <div className="space-y-2">
            <Label htmlFor="userName">Your Name</Label>
            <Input
              id="userName"
              type="text"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>

          {/* Join Room Tab */}
          {activeTab === "join" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomId">Room ID</Label>
                <Input
                  id="roomId"
                  type="text"
                  placeholder="Enter room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                />
              </div>

              <Button
                onClick={handleJoinRoom}
                disabled={isJoining || !roomId.trim() || !userName.trim()}
                className="w-full"
              >
                {isJoining ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Joining...
                  </div>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Join Room
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Create Room Tab */}
          {activeTab === "create" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Room Name (Optional)</Label>
                <Input
                  id="roomName"
                  type="text"
                  placeholder="Enter room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreateRoom}
                disabled={isCreating || !userName.trim()}
                className="w-full"
              >
                {isCreating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Room
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Features */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-2">Features:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• HD Video & Audio calling</li>
              <li>• AI-powered transcription</li>
              <li>• Smart meeting summaries</li>
              <li>• Real-time collaboration</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinCall;