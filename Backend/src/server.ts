import app from "./app";
import config from "./config/config";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import mediasoupService from "./services/mediasoupService";
import socketService from "./services/socketService";

dotenv.config();
const PORT: string | number = config.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173", // Local development
      "https://intelli-meet-three.vercel.app", // Deployed frontend
      "https://intellimeet-lqb0.onrender.com" // Backend URL
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize services
const initializeServices = async () => {
  try {
    console.log("Initializing Mediasoup...");
    await mediasoupService.initialize();
    console.log("Mediasoup initialized successfully");

    console.log("Initializing Socket.io service...");
    socketService.initialize(io);
    console.log("Socket.io service initialized successfully");
  } catch (error) {
    console.error("Error initializing services:", error);
    process.exit(1);
  }
};

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeServices();
});
