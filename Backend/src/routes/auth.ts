import express, { Request, Response, Router } from "express";
import passport from "passport";
import { OAuth2Client } from "google-auth-library";
import { isAuthenticated, generateToken } from "../middleware/auth";
import config from "../config/config";

// Import controllers and models using require for now (until they're fully converted)
const authController = require("../controllers/authController");
const User = require("../models/User");

const router: Router = express.Router();

// Initialize the Google OAuth client
const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);

// Interface for Google payload
interface GooglePayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

// Interface for Google verification request
interface GoogleVerifyRequest extends Request {
  body: {
    credential: string;
  };
}

// Register route (Step 1: Send OTP)
router.post("/register", authController.register);

// Verify OTP route (Step 2: Complete registration)
router.post("/verify-otp", authController.verifyOTP);

// Resend OTP route
router.post("/resend-otp", authController.resendOTP);

// Login route
router.post("/login", authController.login);

// Forgot Password routes
router.post("/forgot-password", authController.forgotPassword);
router.post(
  "/verify-password-reset-otp",
  authController.verifyPasswordResetOTP
);
router.post("/reset-password", authController.resetPassword);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  authController.googleCallback
);

// Google One-Tap/Sign-in with Google Button verification
router.post(
  "/google/verify",
  async (req: GoogleVerifyRequest, res: Response): Promise<void> => {
    try {
      console.log("Google verification request received");
      const { credential } = req.body;

      if (!credential) {
        console.log("No credential provided");
        res.status(400).json({ message: "logging No credential provided" });
        return;
      }

      console.log("Verifying Google token");

      // Verify the Google credential token
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload() as GooglePayload;

      if (!payload) {
        console.log("Failed to get payload from Google token");
        res.status(400).json({ message: "Invalid Google token" });
        return;
      }

      console.log("Google payload received:", {
        email: payload.email,
        name: payload.name,
      });

      // Check if user exists in the database
      let user = await User.findOne({ email: payload.email });

      if (!user) {
        // Create new user from Google data
        console.log("Creating new user from Google data");
        user = new User({
          googleId: payload.sub,
          email: payload.email,
          name: payload.name,
          avatar: payload.picture,
          isEmailVerified: true, // Google has already verified the email
        });

        await user.save();
      } else if (!user.googleId) {
        // Link Google account to existing user
        console.log("Linking Google account to existing user");
        user.googleId = payload.sub;
        user.avatar = user.avatar || payload.picture;
        if (!user.isEmailVerified) user.isEmailVerified = true;

        await user.save();
      }

      // Generate JWT token
      const token = generateToken(user);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error("Google verification error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Server error", error: errorMessage });
    }
  }
);

// Get current user
router.get("/me", isAuthenticated as any, authController.getCurrentUser);

export default router;
