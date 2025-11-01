import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import passport from "passport";
import connectDB from "./config/db";
import path from "path";

// Import routes safely with error handling
let authRoutes: any;
let videoCallRoutes: any;
let recordingRoutes: any;

try {
  authRoutes = require("./routes/auth").default;
} catch (error) {
  authRoutes = express.Router();
}

try {
  videoCallRoutes = require("./routes/videoCall").default;
} catch (error) {
  videoCallRoutes = express.Router();
}

try {
  recordingRoutes = require("./routes/recording").default;
} catch (error) {
  recordingRoutes = express.Router();
}

// Initialize app
const app: Application = express();

// Connect to database
connectDB();

// Middlewares
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://intelli-meet-three.vercel.app",
      "https://intellimeet-lqb0.onrender.com"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  const skipLogging =
    process.env.NODE_ENV === "production" &&
    (req.path === "/health" || req.path === "/favicon.ico" || req.path === "/");

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
  });

  next();
});

// Passport middleware
try {
  app.use(passport.initialize());
  require("./config/passport");
} catch (error) {}

// Root route
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "IntelliMeet API Server",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      root: "/",
      health: "/health",
      auth: "/api/auth",
      video: "/api/video",
      recordings: "/api/recordings",
      test: "/api/test"
    }
  });
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Routes
try {
  app.use("/api/auth", authRoutes);
} catch (error) {}

try {
  app.use("/api/video", videoCallRoutes);
} catch (error) {}

try {
  app.use("/api/recordings", recordingRoutes);
} catch (error) {}

// Test route
app.get("/api/test", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API routes are working",
    routes: {
      auth: "/api/auth",
      video: "/api/video",
      recordings: "/api/recordings"
    }
  });
});

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: "Route not found",
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      availableEndpoints: {
        root: "/",
        health: "/health",
        auth: "/api/auth/*",
        video: "/api/video/*",
        recordings: "/api/recordings/*",
        test: "/api/test"
      }
    });
  } else {
    next();
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const isDevelopment = process.env.NODE_ENV !== "production";

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    timestamp: new Date().toISOString(),
    ...(isDevelopment && {
      error: err.message,
      stack: err.stack
    })
  });
});

export default app;
