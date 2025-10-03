import React, { useState } from "react";
import JoinCall from "../components/JoinCall";
import VideoCall from "../components/VideoCall";
import { Alert, AlertDescription } from "../components/ui/alert";
import { AlertTriangle } from "lucide-react";

const VideoCallPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<"join" | "call">("join");
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleJoinCall = (joinRoomId: string, joinUserName: string) => {
    setRoomId(joinRoomId);
    setUserName(joinUserName);
    setCurrentView("call");
    setError(null);
  };

  const handleLeaveCall = () => {
    setCurrentView("join");
    setRoomId("");
    setUserName("");
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  return (
    <div className="min-h-screen">
      {/* Error Alert */}
      {error && (
        <div className="fixed top-4 right-4 z-50 w-full max-w-md">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      {currentView === "join" ? (
        <JoinCall onJoinCall={handleJoinCall} onError={handleError} />
      ) : (
        <VideoCall
          roomId={roomId}
          userName={userName}
          onLeaveCall={handleLeaveCall}
        />
      )}
    </div>
  );
};

export default VideoCallPage;