import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import passport from "passport";
import connectDB from "./config/db";
import path from "path";

// Import routes
import authRoutes from "./routes/auth";
import videoCallRoutes from "./routes/videoCall";
import recordingRoutes from "./routes/recording";

// Initialize app
const app: Application = express();

// Connect to database
connectDB();

// Middlewares
app.use(
  cors({
    origin: "http://localhost:5173", // Your frontend URL
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware - ADD THIS
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Passport middleware
app.use(passport.initialize());
require("./config/passport");

// Health check endpoint - ADD THIS
app.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Routes - Mount in correct order
app.use("/api/auth", authRoutes);
app.use("/api/video", videoCallRoutes);
app.use("/api/recordings", recordingRoutes);

// Test if routes are mounted - ADD THIS
app.get("/api/test", (req: Request, res: Response) => {
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
app.use((req: Request, res: Response) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    requestedPath: req.path,
    method: req.method,
  });
});

// Error handling middleware - Keep existing
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

export default app;
