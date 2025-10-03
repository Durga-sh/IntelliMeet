import { io, Socket } from "socket.io-client";

export interface User {
  id: string;
  socketId: string;
  name: string;
  roomId: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
}

export interface WebRTCServiceOptions {
  onUserJoined?: (user: User) => void;
  onUserLeft?: (userId: string) => void;
  onUserVideoToggled?: (userId: string, isVideoEnabled: boolean) => void;
  onUserAudioToggled?: (userId: string, isAudioEnabled: boolean) => void;
  onUserScreenShareToggled?: (userId: string, isScreenSharing: boolean) => void;
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onError?: (error: any) => void;
}

class WebRTCService {
  private socket: Socket | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private options: WebRTCServiceOptions = {};
  private currentUser: User | null = null;
  private roomId: string | null = null;

  // ICE servers configuration
  private iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  constructor(options: WebRTCServiceOptions = {}) {
    this.options = options;
  }

  // Initialize connection
  public async connect(
    serverUrl: string = "http://localhost:5000"
  ): Promise<void> {
    try {
      this.socket = io(serverUrl, {
        withCredentials: true,
      });

      this.setupSocketListeners();
    } catch (error) {
      console.error("Failed to connect to server:", error);
      this.options.onError?.(error);
    }
  }

  // Join a room
  public async joinRoom(roomId: string, userName: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }

    this.roomId = roomId;

    try {
      // Get user media first
      await this.getUserMedia();

      // Join the room
      this.socket.emit("join-room", {
        roomId,
        user: { name: userName },
      });
    } catch (error) {
      console.error("Failed to join room:", error);
      this.options.onError?.(error);
      throw error;
    }
  }

  // Get user media (camera and microphone)
  public async getUserMedia(
    constraints: MediaStreamConstraints = {
      video: true,
      audio: true,
    }
  ): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error("Failed to get user media:", error);
      this.options.onError?.(error);
      throw error;
    }
  }

  // Start screen sharing
  public async startScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Replace video track in all peer connections
      for (const [userId, peerConnection] of this.peerConnections) {
        const videoTrack = this.screenStream.getVideoTracks()[0];
        const sender = peerConnection
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      }

      // Handle screen share end
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      this.socket?.emit("toggle-screen-share", { isScreenSharing: true });
      return this.screenStream;
    } catch (error) {
      console.error("Failed to start screen share:", error);
      this.options.onError?.(error);
      throw error;
    }
  }

  // Stop screen sharing
  public async stopScreenShare(): Promise<void> {
    try {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => track.stop());
        this.screenStream = null;
      }

      // Revert to camera stream
      if (this.localStream) {
        for (const [userId, peerConnection] of this.peerConnections) {
          const videoTrack = this.localStream.getVideoTracks()[0];
          const sender = peerConnection
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");

          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }

      this.socket?.emit("toggle-screen-share", { isScreenSharing: false });
    } catch (error) {
      console.error("Failed to stop screen share:", error);
      this.options.onError?.(error);
    }
  }

  // Toggle video
  public toggleVideo(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.socket?.emit("toggle-video", {
          isVideoEnabled: videoTrack.enabled,
        });
      }
    }
  }

  // Toggle audio
  public toggleAudio(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.socket?.emit("toggle-audio", {
          isAudioEnabled: audioTrack.enabled,
        });
      }
    }
  }

  // Leave room
  public leaveRoom(): void {
    // Close all peer connections
    for (const [userId, peerConnection] of this.peerConnections) {
      peerConnection.close();
    }
    this.peerConnections.clear();

    // Stop local streams
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.screenStream?.getTracks().forEach((track) => track.stop());

    this.socket?.emit("leave-room");
    this.currentUser = null;
    this.roomId = null;
  }

  // Disconnect
  public disconnect(): void {
    this.leaveRoom();
    this.socket?.disconnect();
    this.socket = null;
  }

  // Get local stream
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get screen stream
  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on("joined-room", ({ roomId, userId, users }) => {
      console.log("Joined room:", roomId);
      this.currentUser = users.find((u: User) => u.id === userId);

      // Create peer connections for existing users
      users.forEach((user: User) => {
        if (user.id !== userId) {
          this.createPeerConnection(user.id, true);
        }
      });
    });

    this.socket.on("user-joined", ({ user, users }) => {
      console.log("User joined:", user);
      this.options.onUserJoined?.(user);
      this.createPeerConnection(user.id, false);
    });

    this.socket.on("user-left", ({ userId, users }) => {
      console.log("User left:", userId);
      this.options.onUserLeft?.(userId);
      this.closePeerConnection(userId);
    });

    this.socket.on("webrtc-offer", async ({ fromUserId, offer }) => {
      const peerConnection = this.peerConnections.get(fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        this.socket?.emit("webrtc-answer", {
          targetUserId: fromUserId,
          answer,
        });
      }
    });

    this.socket.on("webrtc-answer", async ({ fromUserId, answer }) => {
      const peerConnection = this.peerConnections.get(fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    });

    this.socket.on(
      "webrtc-ice-candidate",
      async ({ fromUserId, candidate }) => {
        const peerConnection = this.peerConnections.get(fromUserId);
        if (peerConnection) {
          await peerConnection.addIceCandidate(candidate);
        }
      }
    );

    this.socket.on("user-video-toggled", ({ userId, isVideoEnabled }) => {
      this.options.onUserVideoToggled?.(userId, isVideoEnabled);
    });

    this.socket.on("user-audio-toggled", ({ userId, isAudioEnabled }) => {
      this.options.onUserAudioToggled?.(userId, isAudioEnabled);
    });

    this.socket.on(
      "user-screen-share-toggled",
      ({ userId, isScreenSharing }) => {
        this.options.onUserScreenShareToggled?.(userId, isScreenSharing);
      }
    );

    this.socket.on("error", (error) => {
      console.error("Socket error:", error);
      this.options.onError?.(error);
    });
  }

  // Create peer connection
  private async createPeerConnection(
    userId: string,
    shouldCreateOffer: boolean
  ): Promise<void> {
    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
      });

      // Add local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, this.localStream!);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log("Received remote stream from:", userId);
        this.options.onRemoteStream?.(userId, event.streams[0]);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket?.emit("webrtc-ice-candidate", {
            targetUserId: userId,
            candidate: event.candidate,
          });
        }
      };

      this.peerConnections.set(userId, peerConnection);

      // Create offer if needed
      if (shouldCreateOffer) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        this.socket?.emit("webrtc-offer", {
          targetUserId: userId,
          offer,
        });
      }
    } catch (error) {
      console.error("Failed to create peer connection:", error);
      this.options.onError?.(error);
    }
  }

  // Close peer connection
  private closePeerConnection(userId: string): void {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
    }
  }
}

export default WebRTCService;
