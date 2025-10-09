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
  Settings,
  Play,
  Square
} from "lucide-react";
import WebRTCService, { User } from ".././services/webrtcService";
// import RecordingStatusChecker from "./RecordingStatusChecker";
import RecordingIndicator from "./RecordingIndicator";
import ChatComponent from "./ChatComponent";
import ChatButton from "./ChatButton";

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
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>('not-started');
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Chat states
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    console.log("VideoCall component initializing with:", {
      roomId,
      userName,
      webrtcService
    });

    const initializeCall = async () => {
      try {
        // Configure WebRTC service callbacks
        webrtcService.setOptions({
          onRoomJoined: (_roomId: string, userId: string, allUsers: User[]) => {
            console.log("Room joined. All users:", allUsers);
            setCurrentUserId(userId);
            // Set all users except current user
            const otherUsers = allUsers.filter(u => u.id !== userId);
            setUsers(otherUsers);
          },
          onUserJoined: (user: User) => {
            console.log("User joined:", user);
            setUsers(prev => {
              const filtered = prev.filter(u => u.id !== user.id);
              return [...filtered, user];
            });
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
        });

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

  // Recording functions
  const startRecording = async () => {
    try {
      setRecordingError(null);
      
      // Temporarily disabled to fix chat issue
      console.log('Recording start disabled');
      setIsRecording(true);
      setRecordingStatus('recording');
      return;
      
      const participants = users.map(u => u.id);
      
      const response = await fetch(`/api/recording/start/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ participants })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsRecording(true);
        setRecordingStatus('recording');
        console.log('Recording started:', data.data);
      } else {
        setRecordingError(data.message || 'Failed to start recording');
      }
    } catch (error: any) {
      setRecordingError(error.message || 'Failed to start recording');
      console.error('Recording start error:', error);
    }
  };

  const stopRecording = async () => {
    try {
      setRecordingError(null);
      
      // Temporarily disabled to fix chat issue
      console.log('Recording stop disabled');
      setIsRecording(false);
      setRecordingStatus('completed');
      return;
      
      const response = await fetch(`/api/recording/stop/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setIsRecording(false);
        setRecordingStatus('processing');
        console.log('Recording stopped:', data.data);
        
        // Start checking status
        checkRecordingStatus();
      } else {
        setRecordingError(data.message || 'Failed to stop recording');
      }
    } catch (error: any) {
      setRecordingError(error.message || 'Failed to stop recording');
      console.error('Recording stop error:', error);
    }
  };

  const checkRecordingStatus = async () => {
    try {
      // Temporarily disabled to fix chat issue
      // TODO: Fix the API endpoint or authentication
      console.log('Recording status check disabled');
      return;
      
      // Use mock endpoint for testing
      const response = await fetch(`/api/recording/mock-status/${roomId}`);

      const data = await response.json();
      
      if (data.success) {
        const { progress, storage } = data.data;
        
        if (progress.isRecording) {
          setRecordingStatus('recording');
          setIsRecording(true);
        } else if (progress.isProcessing) {
          setRecordingStatus('processing');
          setIsRecording(false);
        } else if (progress.isCompleted && storage.isStored) {
          setRecordingStatus('completed');
          setIsRecording(false);
        } else if (progress.isFailed) {
          setRecordingStatus('failed');
          setIsRecording(false);
        }
        
        console.log('Recording status:', data.data);
      }
    } catch (error: any) {
      console.error('Status check error:', error);
    }
  };

  // Check recording status on component mount and periodically
  useEffect(() => {
    if (roomId) {
      checkRecordingStatus();
      
      // Check status every 5 seconds
      const interval = setInterval(checkRecordingStatus, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [roomId]);

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
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Room: {roomId.substring(0, 8)}</span>
            <span className="text-gray-400">({users.length + 1} participants)</span>
          </div>
          
          {/* Recording Status Indicator */}
          <RecordingIndicator 
            roomId={roomId}
            isRecording={isRecording}
            recordingStatus={recordingStatus}
          />
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

        {/* Recording Controls */}
        {!isRecording ? (
          <Button
            onClick={startRecording}
            variant="outline"
            size="lg"
            className="rounded-full p-3 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            title="Start Recording"
          >
            <Play className="h-6 w-6" />
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            variant="destructive"
            size="lg"
            className="rounded-full p-3 animate-pulse"
            title="Stop Recording"
          >
            <Square className="h-6 w-6" />
          </Button>
        )}

        <ChatButton
          onClick={() => setIsChatVisible(!isChatVisible)}
          isActive={isChatVisible}
        />

        <Button
          onClick={handleLeaveCall}
          variant="destructive"
          size="lg"
          className="rounded-full p-3"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>

      {/* Recording Error Display */}
      {recordingError && (
        <div className="px-4 py-2 bg-red-900 border-t border-red-700">
          <div className="text-red-200 text-sm">
            Recording Error: {recordingError}
            <button 
              onClick={() => setRecordingError(null)}
              className="ml-2 text-red-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Recording Status Panel */}
      <div className="p-4 bg-gray-100">
        {/* <RecordingStatusChecker roomId={roomId} /> */}
      </div>

      {/* Chat Component */}
      <ChatComponent
        socket={webrtcService.getSocket()}
        currentUserId={currentUserId}
        currentUserName={userName}
        roomId={roomId}
        isVisible={isChatVisible}
        onToggle={() => setIsChatVisible(!isChatVisible)}
      />
    </div>
  );
};

export default VideoCall;