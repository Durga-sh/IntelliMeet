"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config/config"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const socketService_1 = __importDefault(require("./services/socketService"));
const recordingService_1 = __importDefault(require("./services/recordingService"));
dotenv_1.default.config();
const PORT = config_1.default.PORT || 5000;
// Create HTTP server
const server = (0, http_1.createServer)(app_1.default);
// Initialize Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://localhost:5173", // Your frontend URL
        methods: ["GET", "POST"],
        credentials: true,
    },
});
// Initialize Socket Service
new socketService_1.default(io);
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO server initialized`);
    console.log(`Upload queue service initialized`);
    // Retry any failed uploads from previous sessions
    try {
        await recordingService_1.default.retryFailedUploads();
        console.log(`Retried failed uploads from previous sessions`);
    }
    catch (error) {
        console.error(`Error retrying failed uploads:`, error);
    }
});
