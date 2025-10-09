import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import JoinCall from "../components/JoinCall";
import VideoCall from "../components/VideoCall";
import { Alert, AlertDescription } from "../components/ui/alert";
import { AlertTriangle } from "lucide-react";

const VideoCallPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<"join" | "call">("join");
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const roomFromUrl = urlParams.get("room");
    
    if (urlParams.get("active") === "true" && roomFromUrl) {
      setRoomId(roomFromUrl);
      // We'll need the username too - let's get it from localStorage or use a default
      const storedUserName = localStorage.getItem("userName") || "Anonymous User";
      setUserName(storedUserName);
      setCurrentView("call");
    }
  }, [location.search]);

  const handleJoinCall = (joinRoomId: string, joinUserName: string) => {
    setRoomId(joinRoomId);
    setUserName(joinUserName);
    setCurrentView("call");
    setError(null);
    navigate(`/video-call?active=true&room=${joinRoomId}`, { replace: true });
  };

  const handleLeaveCall = () => {
    setCurrentView("join");
    setRoomId("");
    setUserName("");
    setError(null);
    navigate("/video-call", { replace: true });
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  return (
    <div className={currentView === "call" ? "min-h-screen" : ""}>
      {error && (
        <div className="fixed top-4 right-4 z-50 w-full max-w-md">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
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