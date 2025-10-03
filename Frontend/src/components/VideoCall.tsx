import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff, 
  Phone, 
  PhoneOff,
  Users,
  Settings
} from "lucide-react";
import WebRTCService, { User } from ".././services/webrtcService";

interface VideoCallProps {
  roomId: string;
  userName: string;
  onLeaveCall: () => void;
}

interface RemoteVideo {
  userId: string;
  stream: MediaStream;
  user: User;
}

const VideoCall: React.FC<VideoCallProps> = ({ roomId, userName, onLeaveCall }) => {
  const [webrtcService] = useState(() => new WebRTCService());
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const initializeCall = async () => {
      try {
        // Configure WebRTC service callbacks
        webrtcService.options = {
          onUserJoined: (user: User) => {
            console.log("User joined:", user);
            setUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
          },
          onUserLeft: (userId: string) => {
            console.log("User left:", userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            setRemoteVideos(prev => prev.filter(rv => rv.userId !== userId));
          },
          onUserVideoToggled: (userId: string, enabled: boolean) => {
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isVideoEnabled: enabled } : u
            ));
          },
          onUserAudioToggled: (userId: string, enabled: boolean) => {
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isAudioEnabled: enabled } : u
            ));
          },
          onUserScreenShareToggled: (userId: string, sharing: boolean) => {
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isScreenSharing: sharing } : u
            ));
          },
          onRemoteStream: (userId: string, stream: MediaStream) => {
            console.log("Received remote stream from:", userId);
            // Use current users state instead of stale closure
            setUsers(currentUsers => {
              const user = currentUsers.find(u => u.id === userId);
              if (user) {
                setRemoteVideos(prev => {
                  const filtered = prev.filter(rv => rv.userId !== userId);
                  return [...filtered, { userId, stream, user }];
                });
              }
              return currentUsers;
            });
          },
          onError: (err: any) => {
            console.error("WebRTC Error:", err);
            setError(err.message || "An error occurred");
          }
        };

        // Connect to server
        console.log("Connecting to server...");
        await webrtcService.connect();
        console.log("Connected to server");
        
        // Join room
        console.log("Joining room:", roomId, "as:", userName);
        await webrtcService.joinRoom(roomId, userName);
        console.log("Joined room successfully");
        
        setIsConnected(true);
        console.log("VideoCall component initialized successfully");
      } catch (err: any) {
        console.error("Failed to initialize call:", err);
        setError(err.message || "Failed to join the call");
      }
    };

    initializeCall();

    return () => {
      webrtcService.disconnect();
    };
  }, [roomId, userName]);

  // Update remote video refs when remote videos change
  useEffect(() => {
    remoteVideos.forEach(({ userId, stream }) => {
      const videoElement = remoteVideoRefs.current.get(userId);
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteVideos]);

  // Handle local video stream display
  useEffect(() => {
    if (isConnected && localVideoRef.current) {
      const localStream = webrtcService.getLocalStream();
      if (localStream) {
        localVideoRef.current.srcObject = localStream;
        console.log("Local video stream set:", localStream);
      }
    }
  }, [isConnected]);

  const handleToggleVideo = () => {
    webrtcService.toggleVideo();
    setIsVideoEnabled(prev => !prev);
  };

  const handleToggleAudio = () => {
    webrtcService.toggleAudio();
    setIsAudioEnabled(prev => !prev);
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await webrtcService.stopScreenShare();
        // Revert to camera stream
        const localStream = webrtcService.getLocalStream();
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
        }
      } else {
        const screenStream = await webrtcService.startScreenShare();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
      }
      setIsScreenSharing(prev => !prev);
    } catch (err: any) {
      console.error("Screen share error:", err);
      setError("Failed to toggle screen sharing");
    }
  };

  const handleLeaveCall = () => {
    webrtcService.leaveRoom();
    onLeaveCall();
  };

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-red-600">Call Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={onLeaveCall} variant="outline" className="w-full">
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card className="w-full max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle>Connecting...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Joining room...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Room: {roomId.substring(0, 8)}</span>
          <span className="text-gray-400">({users.length + 1} participants)</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4">
        <div className={`grid gap-4 h-full ${remoteVideos.length === 0 ? 'grid-cols-1' : 
          remoteVideos.length === 1 ? 'grid-cols-2' : 
          remoteVideos.length <= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3 grid-rows-2'}`}>
          
          {/* Local Video */}
          <Card className="relative overflow-hidden bg-gray-800 border-gray-700">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
              You {!isVideoEnabled && "(Video Off)"} {!isAudioEnabled && "(Muted)"}
            </div>
            {isScreenSharing && (
              <div className="absolute top-2 right-2 bg-green-600 px-2 py-1 rounded text-xs">
                Sharing Screen
              </div>
            )}
          </Card>

          {/* Remote Videos */}
          {remoteVideos.map(({ userId, user }) => (
            <Card key={userId} className="relative overflow-hidden bg-gray-800 border-gray-700">
              <video
                ref={(el) => {
                  if (el) {
                    remoteVideoRefs.current.set(userId, el);
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                {user.name} 
                {!user.isVideoEnabled && " (Video Off)"} 
                {!user.isAudioEnabled && " (Muted)"}
              </div>
              {user.isScreenSharing && (
                <div className="absolute top-2 right-2 bg-green-600 px-2 py-1 rounded text-xs">
                  Sharing Screen
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4 p-6 bg-gray-800">
        <Button
          onClick={handleToggleVideo}
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full p-3"
        >
          {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>

        <Button
          onClick={handleToggleAudio}
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full p-3"
        >
          {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>

        <Button
          onClick={handleToggleScreenShare}
          variant={isScreenSharing ? "secondary" : "outline"}
          size="lg"
          className="rounded-full p-3"
        >
          {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
        </Button>

        <Button
          onClick={handleLeaveCall}
          variant="destructive"
          size="lg"
          className="rounded-full p-3"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};

export default VideoCall;