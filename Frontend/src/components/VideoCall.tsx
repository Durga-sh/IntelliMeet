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
import MediasoupWebRTCService, { MediasoupUser } from "../services/mediasoupWebRTCService";
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
  user: MediasoupUser;
}

const API_BASE_URL = 'http://localhost:5000';

// Helper function to determine grid layout based on number of participants
const getGridLayoutClass = (totalUsers: number): string => {
  console.log("🎛️ Grid layout for", totalUsers, "total participants");
  
  switch (totalUsers) {
    case 0:
    case 1:
      return 'grid-1';
    case 2:
      return 'grid-2';
    case 3:
    case 4:
      return 'grid-3-4';
    case 5:
    case 6:
      return 'grid-5-6';
    default:
      return 'grid-many';
  }
};

const VideoCall: React.FC<VideoCallProps> = ({ roomId, userName, onLeaveCall }) => {
  const [webrtcService] = useState(() => new MediasoupWebRTCService());
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [users, setUsers] = useState<MediasoupUser[]>([]);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>('not-started');
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const [isChatVisible, setIsChatVisible] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const initializeCall = async () => {
      try {
        // Set up event handlers
        webrtcService.setOptions({
          onRoomJoined: (_roomId: string, userId: string, allUsers: MediasoupUser[]) => {
            console.log("✅ Room joined. User ID:", userId, "All users:", allUsers);
            setCurrentUserId(userId);
            const otherUsers = allUsers.filter(u => u.id !== userId);
            setUsers(otherUsers);
          },
          onUserJoined: (user: MediasoupUser) => {
            console.log("👋 User joined:", user);
            setUsers(prev => {
              const filtered = prev.filter(u => u.id !== user.id);
              return [...filtered, user];
            });
          },
          onUserLeft: (userId: string) => {
            console.log("👋 User left:", userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            setRemoteVideos(prev => {
              const filtered = prev.filter(rv => rv.userId !== userId);
              // Clean up video element reference
              remoteVideoRefs.current.delete(userId);
              return filtered;
            });
          },
          onUserVideoToggled: (userId: string, enabled: boolean) => {
            console.log(`📹 User ${userId} video:`, enabled);
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isVideoEnabled: enabled } : u
            ));
          },
          onUserAudioToggled: (userId: string, enabled: boolean) => {
            console.log(`🎤 User ${userId} audio:`, enabled);
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isAudioEnabled: enabled } : u
            ));
          },
          onUserScreenShareToggled: (userId: string, sharing: boolean) => {
            console.log(`🖥️ User ${userId} screen sharing:`, sharing);
            setUsers(prev => prev.map(u => 
              u.id === userId ? { ...u, isScreenSharing: sharing } : u
            ));
          },
          onRemoteStream: (userId: string, stream: MediaStream) => {
            console.log("📺 Received remote stream from:", userId, "Tracks:", stream.getTracks().map(t => t.kind));
            setUsers(currentUsers => {
              const user = currentUsers.find(u => u.id === userId);
              if (user) {
                setRemoteVideos(prev => {
                  const existingIndex = prev.findIndex(rv => rv.userId === userId);
                  let finalStream = stream;
                  
                  if (existingIndex >= 0) {
                    // Merge tracks from new stream with existing stream
                    const existing = prev[existingIndex];
                    const existingTracks = existing.stream.getTracks();
                    const newTracks = stream.getTracks();
                    
                    // Create a new stream with all tracks
                    const mergedStream = new MediaStream();
                    existingTracks.forEach(track => mergedStream.addTrack(track));
                    newTracks.forEach(track => {
                      if (!mergedStream.getTracks().find(t => t.kind === track.kind)) {
                        mergedStream.addTrack(track);
                      }
                    });
                    
                    console.log("🔄 Merged stream for user:", userId, "Total tracks:", mergedStream.getTracks().length);
                    finalStream = mergedStream;
                    const updated = [...prev];
                    updated[existingIndex] = { ...existing, stream: finalStream };
                    
                    // Immediately assign stream to video element
                    setTimeout(() => {
                      const videoElement = remoteVideoRefs.current.get(userId);
                      if (videoElement && videoElement.srcObject !== finalStream) {
                        videoElement.srcObject = finalStream;
                        console.log("📺 Immediate stream assignment for user:", userId);
                        videoElement.play().catch(err => console.log("Auto-play blocked:", err));
                      }
                    }, 10);
                    
                    return updated;
                  } else {
                    console.log("📺 Adding new remote video for user:", userId);
                    
                    // Immediately assign stream to video element
                    setTimeout(() => {
                      const videoElement = remoteVideoRefs.current.get(userId);
                      if (videoElement && videoElement.srcObject !== finalStream) {
                        videoElement.srcObject = finalStream;
                        console.log("📺 Immediate stream assignment for user:", userId);
                        videoElement.play().catch(err => console.log("Auto-play blocked:", err));
                      }
                    }, 10);
                    
                    return [...prev, { userId, stream: finalStream, user }];
                  }
                });
              } else {
                console.warn("📺 User not found for remote stream:", userId);
              }
              return currentUsers;
            });
          },
          onRecordingStarted: (recordingId: string, startTime: Date) => {
            console.log("🔴 Recording started:", recordingId, startTime);
            setIsRecording(true);
            setRecordingStatus('recording');
          },
          onRecordingStopped: (recordingId: string, endTime: Date) => {
            console.log("⏹️ Recording stopped:", recordingId, endTime);
            setIsRecording(false);
            setRecordingStatus('processing');
          },
          onError: (err: any) => {
            console.error("❌ WebRTC Error:", err);
            setError(err.message || "An error occurred");
          }
        });

        // Connect to server
        console.log("🔌 Connecting to server...");
        await webrtcService.connect(API_BASE_URL);
        console.log("✅ Connected to server");

        // Join room
        console.log("🚪 Joining room:", roomId);
        await webrtcService.joinRoom(roomId, userName);
        
        // Wait a bit for router capabilities
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start local media
        console.log("🎥 Starting local media...");
        const localStream = await webrtcService.startLocalMedia(true, true);
        console.log("✅ Local media started, stream:", localStream);
        
        if (localVideoRef.current && localStream) {
          localVideoRef.current.srcObject = localStream;
          console.log("📹 Local video stream assigned to video element");
          
          // Force play the video
          try {
            await localVideoRef.current.play();
            console.log("📹 Local video started playing");
          } catch (playError) {
            console.log("📹 Auto-play blocked, will play on user interaction");
          }
        }

        setIsConnected(true);
      } catch (err: any) {
        console.error("❌ Failed to initialize call:", err);
        setError(err.message || "Failed to join the call");
      }
    };

    initializeCall();

    return () => {
      console.log("🧹 Cleaning up video call...");
      webrtcService.disconnect();
    };
  }, [roomId, userName]);

  // Removed updateRemoteVideoStreams useEffect - streams are now handled directly in video ref callbacks

  // Debug effect to check local video stream
  useEffect(() => {
    if (localVideoRef.current) {
      console.log("📹 Local video element:", {
        hasStream: !!localVideoRef.current.srcObject,
        isVideoEnabled,
        videoElement: localVideoRef.current
      });
    }
  }, [isVideoEnabled]);

  const handleToggleVideo = async () => {
    try {
      const newState = await webrtcService.toggleVideo();
      setIsVideoEnabled(newState);
      console.log("📹 Video toggled:", newState);
      
      // If enabling video, ensure the stream is properly set
      if (newState && localVideoRef.current) {
        const localStream = webrtcService.getLocalStream();
        if (localStream && localVideoRef.current.srcObject !== localStream) {
          console.log("🔄 Refreshing local video stream");
          localVideoRef.current.srcObject = localStream;
        }
      }
    } catch (err: any) {
      console.error("❌ Failed to toggle video:", err);
      setError("Failed to toggle video");
    }
  };

  const handleToggleAudio = async () => {
    try {
      const newState = await webrtcService.toggleAudio();
      setIsAudioEnabled(newState);
      console.log("🎤 Audio toggled:", newState);
    } catch (err: any) {
      console.error("❌ Failed to toggle audio:", err);
      setError("Failed to toggle audio");
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing - not implemented in mediasoupWebRTCService yet
        console.warn("⚠️ Screen sharing stop not implemented yet");
        setIsScreenSharing(false);
      } else {
        // Start screen sharing - not implemented in mediasoupWebRTCService yet
        console.warn("⚠️ Screen sharing not implemented yet");
      }
    } catch (err: any) {
      console.error("❌ Screen share error:", err);
      setError("Failed to toggle screen sharing");
    }
  };

  const startRecording = async () => {
    try {
      setRecordingError(null);
      console.log('🎬 Starting recording for room:', roomId);
      
      const participants = [currentUserId, ...users.map(u => u.id)];
      
      const url = `${API_BASE_URL}/api/recordings/start/${roomId}`;
      console.log('📡 Fetch URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ participants })
      });

      console.log('📥 Response status:', response.status);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned non-JSON response. Content-Type: ${contentType}`);
      }

      const data = await response.json();
      console.log('✅ Recording response:', data);
      
      if (data.success) {
        setIsRecording(true);
        setRecordingStatus('recording');
        console.log('✅ Recording started:', data.data);
      } else {
        throw new Error(data.message || 'Failed to start recording');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start recording';
      setRecordingError(errorMsg);
      console.error('❌ Recording start error:', error);
    }
  };

  const stopRecording = async () => {
    try {
      setRecordingError(null);
      console.log('🛑 Stopping recording for room:', roomId);
      
      const url = `${API_BASE_URL}/api/recordings/stop/${roomId}`;
      console.log('📡 Fetch URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned non-JSON response. Content-Type: ${contentType}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setIsRecording(false);
        setRecordingStatus('processing');
        console.log('✅ Recording stopped:', data.data);
        
        setTimeout(() => checkRecordingStatus(), 2000);
      } else {
        throw new Error(data.message || 'Failed to stop recording');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to stop recording';
      setRecordingError(errorMsg);
      console.error('❌ Recording stop error:', error);
    }
  };

  const checkRecordingStatus = async () => {
    try {
      const url = `${API_BASE_URL}/api/recordings/room/${roomId}`;
      const response = await fetch(url);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          if (data.success && data.data) {
            const recording = data.data;
            
            if (recording.status === 'recording') {
              setRecordingStatus('recording');
              setIsRecording(true);
            } else if (recording.status === 'processing') {
              setRecordingStatus('processing');
              setIsRecording(false);
            } else if (recording.status === 'completed' || recording.status === 'uploaded') {
              setRecordingStatus('completed');
              setIsRecording(false);
            } else if (recording.status === 'failed') {
              setRecordingStatus('failed');
              setIsRecording(false);
            }
          } else {
            setRecordingStatus('not-started');
            setIsRecording(false);
          }
        }
      } else if (response.status === 404) {
        setRecordingStatus('not-started');
        setIsRecording(false);
      }
    } catch (error: any) {
      console.error('❌ Status check error:', error);
    }
  };

  useEffect(() => {
    if (roomId) {
      checkRecordingStatus();
      
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
    <div className="flex flex-col h-screen bg-gray-900 text-white relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700 flex-shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-400" />
            <span className="font-semibold">Room: {roomId.substring(0, 8)}</span>
            <span className="text-gray-400 bg-gray-700 px-2 py-1 rounded text-sm">
              {users.length + 1} participant{users.length !== 0 ? 's' : ''}
            </span>
          </div>
          
          <RecordingIndicator 
            roomId={roomId}
            isRecording={isRecording}
            recordingStatus={recordingStatus}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="hover:bg-gray-700">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Video Area */}
      <div className={`flex-1 p-6 pb-28 transition-all duration-300 ${isChatVisible ? 'mr-80' : ''} min-h-0 overflow-hidden`}>
        <div className={`video-grid ${getGridLayoutClass(users.length + 1)}`} style={{ height: '100%', maxHeight: 'calc(100vh - 200px)' }}>
          
          {/* Local Video */}
          <div className="video-card">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="video-element"
              style={{ 
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain', // Show full video without cropping
                backgroundColor: '#374151',
                zIndex: isVideoEnabled ? 2 : 1
              }}
              onLoadedMetadata={() => console.log("📹 Local video metadata loaded")}
              onPlay={() => console.log("📹 Local video started playing")}
              onError={(e) => console.error("📹 Local video error:", e)}
            />
            {!isVideoEnabled && (
              <div className="video-placeholder" style={{ zIndex: 3 }}>
                <div className="text-center">
                  <VideoOff className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-400 font-medium">Camera Off</p>
                </div>
              </div>
            )}
            <div className="video-overlay" style={{ zIndex: 4 }}>
              You {!isVideoEnabled && "(Video Off)"} {!isAudioEnabled && "(Muted)"}
            </div>
            {isScreenSharing && (
              <div className="absolute top-2 right-2 bg-green-600 px-2 py-1 rounded text-xs font-medium">
                Sharing Screen
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {users.map((user) => {
            const remoteVideo = remoteVideos.find(rv => rv.userId === user.id);

            return (
              <div key={user.id} className="video-card">
                <video
                  ref={(el) => {
                    if (el) {
                      // Only set if it's actually different
                      const existing = remoteVideoRefs.current.get(user.id);
                      if (existing !== el) {
                        remoteVideoRefs.current.set(user.id, el);
                        // Immediately set stream if available
                        const stream = remoteVideo?.stream;
                        if (stream && el.srcObject !== stream) {
                          el.srcObject = stream;
                          el.play().catch(console.warn);
                        }
                      }
                    } else {
                      remoteVideoRefs.current.delete(user.id);
                    }
                  }}
                  autoPlay
                  playsInline
                  className="video-element"
                  style={{ 
                    display: user.isVideoEnabled && remoteVideo ? 'block' : 'none',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                  onPlay={() => console.log(`📹 Remote video started playing for ${user.id}`)}
                  onError={(e) => console.error(`📹 Remote video error for ${user.id}:`, e)}
                />
                {(!user.isVideoEnabled || !remoteVideo) && (
                  <div className="video-placeholder">
                    <div className="text-center">
                      <VideoOff className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-400 font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">
                        {!remoteVideo ? 'Connecting...' : 'Camera Off'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="video-overlay">
                  {user.name} 
                  {!user.isVideoEnabled && " (Video Off)"} 
                  {!user.isAudioEnabled && " (Muted)"}
                </div>
                {user.isScreenSharing && (
                  <div className="absolute top-2 right-2 bg-green-600 px-2 py-1 rounded text-xs font-medium">
                    Sharing Screen
                  </div>
                )}
              </div>
            );
          })}

          {/* Show placeholder for empty slots when only one participant */}
          {remoteVideos.length === 0 && (
            <div className="video-card">
              <div className="video-placeholder">
                <div className="text-center text-gray-400">
                  <Users className="h-16 w-16 mx-auto mb-3" />
                  <p className="text-lg font-medium">Waiting for others to join...</p>
                  <p className="text-sm text-gray-500 mt-1">Share the room link to invite participants</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls - Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-20">
        <div className={`flex items-center justify-center space-x-3 p-4 transition-all duration-300 ${isChatVisible ? 'mr-80' : ''}`}>
          <Button
            onClick={handleToggleVideo}
            variant={isVideoEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all hover:scale-105"
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoEnabled ? <Video className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>

          <Button
            onClick={handleToggleAudio}
            variant={isAudioEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all hover:scale-105"
            title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {isAudioEnabled ? <Mic className="h-5 w-5 sm:h-6 sm:w-6" /> : <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>

          <Button
            onClick={handleToggleScreenShare}
            variant={isScreenSharing ? "secondary" : "outline"}
            size="lg"
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14 transition-all hover:scale-105"
            title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Monitor className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>

          {!isRecording ? (
            <Button
              onClick={startRecording}
              variant="outline"
              size="lg"
              className="rounded-full w-12 h-12 sm:w-14 sm:h-14 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all hover:scale-105"
              title="Start Recording"
            >
              <Play className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              variant="destructive"
              size="lg"
              className="rounded-full w-12 h-12 sm:w-14 sm:h-14 animate-pulse transition-all hover:scale-105"
              title="Stop Recording"
            >
              <Square className="h-5 w-5 sm:h-6 sm:w-6" />
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
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14 bg-red-600 hover:bg-red-700 transition-all hover:scale-105"
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
      </div>

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

      {/* Chat Component */}
      {isChatVisible && (
        <div className="fixed right-0 top-0 bottom-0 w-80 z-30 bg-gray-800 border-l border-gray-700">
          <ChatComponent
            socket={webrtcService.getSocket()}
            currentUserId={currentUserId}
            currentUserName={userName}
            roomId={roomId}
            isVisible={isChatVisible}
            onToggle={() => setIsChatVisible(!isChatVisible)}
          />
        </div>
      )}
    </div>
  );
};

export default VideoCall;