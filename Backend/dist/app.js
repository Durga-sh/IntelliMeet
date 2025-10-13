"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
const db_1 = __importDefault(require("./config/db"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const videoCall_1 = __importDefault(require("./routes/videoCall"));
const recording_1 = __importDefault(require("./routes/recording"));
// Initialize app
const app = (0, express_1.default)();
// Connect to database
(0, db_1.default)();
// Middlewares
app.use((0, cors_1.default)({
    origin: "http://localhost:5173", // Your frontend URL
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// Request logging middleware - ADD THIS
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});
// Passport middleware
app.use(passport_1.default.initialize());
require("./config/passport");
// Health check endpoint - ADD THIS
app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString(),
    });
});
// Routes - Mount in correct order
app.use("/api/auth", auth_1.default);
app.use("/api/video", videoCall_1.default);
app.use("/api/recordings", recording_1.default);
// Test if routes are mounted - ADD THIS
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "API routes are working",
        routes: {
            auth: "/api/auth",
            video: "/api/video",
            recordings: "/api/recordings",
        },
    });
});
// 404 handler - ADD THIS AFTER ALL ROUTES
app.use((req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`,
        requestedPath: req.path,
        method: req.method,
    });
});
// Error handling middleware - Keep existing
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err);
    res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
});
exports.default = app;
