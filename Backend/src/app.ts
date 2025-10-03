import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import passport from "passport";
import connectDB from "./config/db";
import path from "path";

// Import routes
import authRoutes from "./routes/auth";
import videoCallRoutes from "./routes/videoCall";

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

// Passport middleware
app.use(passport.initialize());
require("./config/passport");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/video", videoCallRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? {} : err,
  });
});

export default app;
