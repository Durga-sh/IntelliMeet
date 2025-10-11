import app from "./app";
import config from "./config/config";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import SocketService from "./services/socketService";
import uploadQueueService from "./services/uploadQueueService";
import recordingService from "./services/recordingService";

dotenv.config();
const PORT: string | number = config.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Socket Service
new SocketService(io);

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server initialized`);
  console.log(`Upload queue service initialized`);

  // Retry any failed uploads from previous sessions
  try {
    await recordingService.retryFailedUploads();
    console.log(`Retried failed uploads from previous sessions`);
  } catch (error) {
    console.error(`Error retrying failed uploads:`, error);
  }
});
