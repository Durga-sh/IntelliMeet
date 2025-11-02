import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import mediasoupClient, { Participant, ChatMessage } from "../utils/mediasoupClient";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  MessageSquare,
  Users,
} from "lucide-react";
import SimpleChat from "./SimpleChat";

interface RemotePeer {
  id: string;
  userName: string;
  audioStream?: MediaStream;
  videoStream?: MediaStream;
  screenStream?: MediaStream;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

const VideoCallRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    init();

    return () => {
      cleanup();
    };
  }, [roomId]);

  useEffect(() => {
    console.log("🔄 State changed:", {
      hasLocalStream: !!localStream,
      isVideoEnabled,
      isAudioEnabled,
      videoTracks: localStream?.getVideoTracks().length || 0,
      audioTracks: localStream?.getAudioTracks().length || 0
    });
  }, [localStream, isVideoEnabled, isAudioEnabled]);

  // Attach stream to video element when localStream changes
  useEffect(() => {
    if (localStream && localVideoRef.current && isVideoEnabled) {
      console.log("🎥 Attaching stream to video element...");
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => {
        console.warn("Video play failed:", err);
      });
      console.log("✅ Stream attached to video element");
    }
  }, [localStream, isVideoEnabled]);

  const init = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Get username from localStorage or prompt
      const storedName = localStorage.getItem("userName");
      const userName = storedName || prompt("Enter your name:") || "Anonymous";
      const userId = `user_${Date.now()}`;

      if (!storedName) {
        localStorage.setItem("userName", userName);
      }

      // Connect to server first
      // Socket.io runs on root path, not /api
      const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
      console.log("Connecting to server:", socketUrl);
      await mediasoupClient.connect(socketUrl, roomId!, userName, userId);

      // Setup event listeners first
      setupEventListeners();

      // Get chat history
      mediasoupClient.getChatHistory();

      // Try to get user media
      try {
        console.log("🎥 Step 1: Checking browser support...");
        
        // Check if mediaDevices is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser doesn't support camera/microphone access. Please use Chrome, Firefox, or Edge.");
        }
        console.log("✓ Browser supports getUserMedia");

        // Check current permission state
        console.log("🎥 Step 2: Checking permissions...");
        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log("Camera permission:", cameraPermission.state);
          console.log("Microphone permission:", micPermission.state);
          
          if (cameraPermission.state === 'denied' || micPermission.state === 'denied') {
            throw new Error("❌ BLOCKED! Click the 🔒 lock/camera icon in your address bar → Click 'Camera' and 'Microphone' → Select 'Allow' → Refresh page");
          }
        } catch (permErr) {
          console.log("Permission query not supported, will try getUserMedia anyway");
        }

        console.log("🎥 Step 3: Requesting camera & microphone...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        console.log("✅ SUCCESS! Media stream obtained:", {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoLabel: stream.getVideoTracks()[0]?.label,
          audioLabel: stream.getAudioTracks()[0]?.label,
          videoEnabled: stream.getVideoTracks()[0]?.enabled,
          audioEnabled: stream.getAudioTracks()[0]?.enabled
        });

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          // Explicitly play the video
          localVideoRef.current.play().catch(err => {
            console.warn("Video play failed:", err);
          });
        }

        // Produce audio and video
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        console.log("🔵 Starting to produce media tracks...");
        
        if (audioTrack) {
          console.log("🔵 Producing audio track...");
          await mediasoupClient.produce(audioTrack, { audio: true });
          console.log("✅ Audio producer created");
        }

        if (videoTrack) {
          console.log("🔵 Producing video track...");
          await mediasoupClient.produce(videoTrack, { video: true });
          console.log("✅ Video producer created");
        }

        console.log("✅ Media setup complete!");
        console.log("📊 Current state:", {
          localStream: !!localStream,
          isVideoEnabled,
          isAudioEnabled,
          isConnecting
        });
        setIsConnecting(false);
      } catch (mediaError: any) {
        console.error("❌ Media Error Details:", {
          name: mediaError.name,
          message: mediaError.message,
          constraint: mediaError.constraint
        });
        
        // Provide specific error messages
        let mediaErrorMessage = "";
        if (mediaError.name === "NotAllowedError" || mediaError.name === "PermissionDeniedError") {
          mediaErrorMessage = "🚫 PERMISSION DENIED! You must click 'Allow' when the browser asks. If you don't see a popup:\n1. Click the 🔒 lock icon or camera icon in your browser's address bar\n2. Find 'Camera' and 'Microphone'\n3. Change both to 'Allow'\n4. Refresh the page (F5)";
        } else if (mediaError.name === "NotFoundError") {
          mediaErrorMessage = "📷 No camera or microphone detected. Please connect a device and refresh.";
        } else if (mediaError.name === "NotReadableError") {
          mediaErrorMessage = "⚠️ Camera/microphone is in use. Close Zoom, Teams, Skype, or other video apps, then refresh.";
        } else {
          mediaErrorMessage = `Media access failed: ${mediaError.message}`;
        }
        
        setError(mediaErrorMessage);
        
        // User can still join the call without camera/mic
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
      }

      setIsConnecting(false);
    } catch (error: any) {
      console.error("Error initializing:", error);
      setError(`Failed to join the call: ${error.message || "Unknown error"}`);
      setIsConnecting(false);
      
      // Redirect back after 3 seconds
      setTimeout(() => {
        navigate("/");
      }, 3000);
    }
  };

  const setupEventListeners = () => {
    mediasoupClient.onNewParticipant((participant: Participant) => {
      setRemotePeers((prev) => {
        const newPeers = new Map(prev);
        newPeers.set(participant.id, {
          id: participant.id,
          userName: participant.userName,
        });
        return newPeers;
      });
    });

    mediasoupClient.onParticipantLeft((participantId: string) => {
      setRemotePeers((prev) => {
        const newPeers = new Map(prev);
        newPeers.delete(participantId);
        return newPeers;
      });
    });

    mediasoupClient.onNewConsumer((consumer: any, peerId: string) => {
      const stream = new MediaStream([consumer.track]);

      setRemotePeers((prev) => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(peerId) || {
          id: peerId,
          userName: "Unknown",
        };

        if (consumer.kind === "audio") {
          peer.audioStream = stream;
        } else {
          // Check if it's screen share from appData
          if (consumer.appData.screen) {
            peer.screenStream = stream;
          } else {
            peer.videoStream = stream;
          }
        }

        newPeers.set(peerId, peer);
        return newPeers;
      });
    });

    mediasoupClient.onNewMessage((message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      if (!isChatOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    mediasoupClient.onTyping((userId: string, userName: string) => {
      setTypingUsers((prev) => new Set(prev).add(`${userId}:${userName}`));
    });

    mediasoupClient.onStoppedTyping((userId: string) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        Array.from(newSet).forEach((entry) => {
          if (entry.startsWith(userId)) {
            newSet.delete(entry);
          }
        });
        return newSet;
      });
    });

    mediasoupClient.onProducerPaused((_producerId: string, peerId: string) => {
      setRemotePeers((prev) => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(peerId);
        if (peer) {
          // You can track which producer is paused if needed
          newPeers.set(peerId, peer);
        }
        return newPeers;
      });
    });

    mediasoupClient.onProducerResumed((_producerId: string, peerId: string) => {
      setRemotePeers((prev) => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(peerId);
        if (peer) {
          newPeers.set(peerId, peer);
        }
        return newPeers;
      });
    });
  };

  const toggleAudio = async () => {
    if (!localStream) {
      alert("No audio stream available. Please refresh and allow microphone access.");
      return;
    }
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const newState = !isAudioEnabled;
      audioTrack.enabled = newState;
      setIsAudioEnabled(newState);

      if (newState) {
        await mediasoupClient.resumeProducer("audio");
      } else {
        await mediasoupClient.pauseProducer("audio");
      }
    }
  };

  const toggleVideo = async () => {
    if (!localStream) {
      alert("No video stream available. Please refresh and allow camera access.");
      return;
    }
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const newState = !isVideoEnabled;
      videoTrack.enabled = newState;
      setIsVideoEnabled(newState);

      if (newState) {
        await mediasoupClient.resumeProducer("video");
      } else {
        await mediasoupClient.pauseProducer("video");
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        setScreenStream(stream);

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        const track = stream.getVideoTracks()[0];
        await mediasoupClient.produce(track, { screen: true });

        track.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (error) {
        console.error("Error sharing screen:", error);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  };

  const endCall = () => {
    cleanup();
    navigate("/");
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    mediasoupClient.disconnect();
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen) {
      setUnreadCount(0);
    }
  };

  const retryMediaAccess = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      if (audioTrack) {
        await mediasoupClient.produce(audioTrack, { audio: true });
      }

      if (videoTrack) {
        await mediasoupClient.produce(videoTrack, { video: true });
      }

      setError("✅ Camera and microphone connected!");
      setTimeout(() => setError(null), 3000);
    } catch (err: any) {
      setError(`Failed to access media: ${err.message}. Please check browser permissions.`);
    }
  };

  // Show loading state
  if (isConnecting) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-white text-xl font-semibold">Connecting to room...</h2>
          <p className="text-gray-400 mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Error Banner */}
      {error && (
        <div className={`${error.includes("✅") ? "bg-green-600" : "bg-yellow-600"} text-white px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2 flex-1">
            {!error.includes("✅") && (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-sm">{error}</span>
          </div>
          <div className="flex items-center gap-2">
            {!localStream && !error.includes("✅") && (
              <button 
                onClick={retryMediaAccess}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition"
              >
                Retry
              </button>
            )}
            <button onClick={() => setError(null)} className="text-white hover:text-gray-200">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="text-white">
          <h1 className="text-xl font-bold">IntelliMeet</h1>
          <p className="text-sm text-gray-400">Room: {roomId}</p>
        </div>
        <div className="flex items-center gap-2 text-white">
          <Users className="w-5 h-5" />
          <span>{remotePeers.size + 1} participants</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
          {/* Local Video */}
          <Card className="relative bg-gray-800 aspect-video">
            {localStream && isVideoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700 rounded">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-2">
                    {(localStorage.getItem("userName") || "U").charAt(0).toUpperCase()}
                  </div>
                  <p className="text-gray-400 text-sm">
                    {!localStream ? "No Camera" : "Camera Off"}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              You {!isVideoEnabled && "(Video Off)"} {!isAudioEnabled && "(Muted)"}
            </div>
          </Card>

          {/* Screen Share */}
          {screenStream && (
            <Card className="relative bg-gray-800 aspect-video col-span-2">
              <video
                ref={screenVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain rounded"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                Your Screen
              </div>
            </Card>
          )}

          {/* Remote Peers */}
          {Array.from(remotePeers.values()).map((peer) => (
            <RemotePeerVideo key={peer.id} peer={peer} />
          ))}
        </div>

        {/* Chat Panel */}
        {isChatOpen && (
          <div className="w-80 border-l border-gray-700">
            <SimpleChat
              messages={messages}
              onSendMessage={(msg: string) => mediasoupClient.sendMessage(msg)}
              onTyping={() => mediasoupClient.startTyping()}
              onStopTyping={() => mediasoupClient.stopTyping()}
              typingUsers={Array.from(typingUsers).map((u) => u.split(":")[1])}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 flex justify-center items-center gap-4">
        <Button
          onClick={toggleAudio}
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-14 h-14"
        >
          {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </Button>

        <Button
          onClick={toggleVideo}
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-14 h-14"
        >
          {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </Button>

        <Button
          onClick={toggleScreenShare}
          variant={isScreenSharing ? "secondary" : "default"}
          size="lg"
          className="rounded-full w-14 h-14"
        >
          <MonitorUp className="w-6 h-6" />
        </Button>

        <Button
          onClick={toggleChat}
          variant="default"
          size="lg"
          className="rounded-full w-14 h-14 relative"
        >
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>

        <Button
          onClick={endCall}
          variant="destructive"
          size="lg"
          className="rounded-full w-14 h-14"
        >
          <Phone className="w-6 h-6 transform rotate-135" />
        </Button>
      </div>
    </div>
  );
};

// Remote Peer Video Component
const RemotePeerVideo: React.FC<{ peer: RemotePeer }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.videoStream) {
      videoRef.current.srcObject = peer.videoStream;
    }
  }, [peer.videoStream]);

  useEffect(() => {
    if (audioRef.current && peer.audioStream) {
      audioRef.current.srcObject = peer.audioStream;
    }
  }, [peer.audioStream]);

  useEffect(() => {
    if (screenRef.current && peer.screenStream) {
      screenRef.current.srcObject = peer.screenStream;
    }
  }, [peer.screenStream]);

  return (
    <>
      <Card className="relative bg-gray-800 aspect-video">
        {peer.videoStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-700 rounded">
            <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {peer.userName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        <audio ref={audioRef} autoPlay />
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
          {peer.userName}
        </div>
      </Card>

      {peer.screenStream && (
        <Card className="relative bg-gray-800 aspect-video col-span-2">
          <video
            ref={screenRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain rounded"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
            {peer.userName}'s Screen
          </div>
        </Card>
      )}
    </>
  );
};

export default VideoCallRoom;
