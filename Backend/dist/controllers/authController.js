"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.googleCallback = exports.login = exports.resetPassword = exports.verifyPasswordResetOTP = exports.forgotPassword = exports.resendOTP = exports.verifyOTP = exports.register = void 0;
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const nodemailer_1 = __importDefault(require("nodemailer"));
const crypto_1 = __importDefault(require("crypto"));
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
});
transporter.verify(function (error, success) {
    if (error) {
        console.error("Email transporter verification failed:", error);
    }
    else {
        console.log("Email server is ready to take our messages");
    }
});
const tempUsers = new Map();
// Store password reset OTPs (in production, use Redis or database)
const passwordResetOTPs = new Map();
// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "EventHub - Password Reset OTP",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8B5CF6;">EventHub - Password Reset</h2>
        <p>Your OTP for password reset is:</p>
        <h1 style="background: #8B5CF6; color: white; padding: 20px; text-align: center; border-radius: 8px; letter-spacing: 4px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
};
// Register a new user (Step 1: Send OTP)
const register = async (req, res) => {
    try {
        const { name, email, password, role, } = req.body;
        // Check if user already exists
        let existingUser = await User_1.default.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        // Generate OTP
        const otp = generateOTP();
        // Store temporary user data with OTP
        const tempUserId = crypto_1.default.randomUUID();
        tempUsers.set(tempUserId, {
            name,
            email,
            password,
            role,
            otp,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });
        // Send OTP email
        await sendOTPEmail(email, otp);
        res.status(200).json({
            success: true,
            message: "OTP sent to your email. Please verify to complete registration.",
            tempUserId,
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.register = register;
// Verify OTP and complete registration (Step 2)
const verifyOTP = async (req, res) => {
    try {
        const { tempUserId, otp } = req.body;
        // Get temporary user data
        const tempUserData = tempUsers.get(tempUserId);
        if (!tempUserData) {
            res
                .status(400)
                .json({ message: "Invalid or expired verification session" });
            return;
        }
        // Check if OTP is expired
        if (new Date() > tempUserData.expiresAt) {
            tempUsers.delete(tempUserId);
            res
                .status(400)
                .json({ message: "OTP has expired. Please register again." });
            return;
        }
        // Verify OTP
        if (tempUserData.otp !== otp) {
            res.status(400).json({ message: "Invalid OTP" });
            return;
        }
        // Create new user
        const user = new User_1.default({
            name: tempUserData.name,
            email: tempUserData.email,
            password: tempUserData.password,
            role: tempUserData.role,
            isEmailVerified: true,
        });
        await user.save();
        // Clean up temporary data
        tempUsers.delete(tempUserId);
        // Generate JWT token
        const token = (0, auth_1.generateToken)({
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
        });
        res.status(201).json({
            success: true,
            message: "Registration completed successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error("OTP verification error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.verifyOTP = verifyOTP;
// Resend OTP
const resendOTP = async (req, res) => {
    try {
        const { tempUserId } = req.body;
        // Get temporary user data
        const tempUserData = tempUsers.get(tempUserId);
        if (!tempUserData) {
            res.status(400).json({ message: "Invalid verification session" });
            return;
        }
        // Generate new OTP
        const newOTP = generateOTP();
        // Update temporary user data
        tempUsers.set(tempUserId, {
            ...tempUserData,
            otp: newOTP,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Reset expiry to 10 minutes
        });
        // Send new OTP email
        await sendOTPEmail(tempUserData.email, newOTP);
        res.status(200).json({
            success: true,
            message: "New OTP sent to your email",
        });
    }
    catch (error) {
        console.error("Resend OTP error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.resendOTP = resendOTP;
// Forgot Password - Send OTP
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        // Check if user exists
        const user = await User_1.default.findOne({ email });
        if (!user) {
            res.status(404).json({ message: "User not found with this email" });
            return;
        }
        // Check if user signed up with Google and doesn't have a password
        if (!user.password) {
            res.status(400).json({
                message: "This account was created with Google. Please login with Google.",
            });
            return;
        }
        // Generate OTP
        const otp = generateOTP();
        // Store OTP with expiry (10 minutes)
        const tempResetId = crypto_1.default.randomUUID();
        passwordResetOTPs.set(tempResetId, {
            userId: user._id.toString(),
            email: user.email,
            otp,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });
        // Send OTP email
        console.log("Sending OTP email for password reset to:", email, "OTP:", otp);
        await sendOTPEmail(email, otp);
        res.status(200).json({
            success: true,
            message: "Password reset OTP sent successfully",
            tempResetId,
        });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.forgotPassword = forgotPassword;
// Verify Password Reset OTP
const verifyPasswordResetOTP = async (req, res) => {
    try {
        const { tempResetId, otp } = req.body;
        // Get OTP data
        const otpData = passwordResetOTPs.get(tempResetId);
        if (!otpData) {
            res.status(400).json({ message: "Invalid or expired OTP session" });
            return;
        }
        // Check if OTP is expired
        if (new Date() > otpData.expiresAt) {
            passwordResetOTPs.delete(tempResetId);
            res
                .status(400)
                .json({ message: "OTP has expired. Please request a new one." });
            return;
        }
        // Verify OTP
        if (otpData.otp !== otp) {
            res.status(400).json({ message: "Invalid OTP" });
            return;
        }
        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            tempResetId,
            email: otpData.email,
        });
    }
    catch (error) {
        console.error("Verify password reset OTP error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.verifyPasswordResetOTP = verifyPasswordResetOTP;
// Reset Password
const resetPassword = async (req, res) => {
    try {
        const { tempResetId, newPassword, } = req.body;
        // Get OTP data
        const otpData = passwordResetOTPs.get(tempResetId);
        if (!otpData) {
            res.status(400).json({ message: "Invalid or expired OTP session" });
            return;
        }
        // Check if OTP is expired
        if (new Date() > otpData.expiresAt) {
            passwordResetOTPs.delete(tempResetId);
            res.status(400).json({
                message: "OTP has expired. Please request a new one.",
            });
            return;
        }
        // Find user and update password
        const user = await User_1.default.findById(otpData.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        // Update password
        user.password = newPassword;
        await user.save();
        // Clean up OTP data
        passwordResetOTPs.delete(tempResetId);
        res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });
    }
    catch (error) {
        console.error("Reset password error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.resetPassword = resetPassword;
// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Check if user exists
        const user = await User_1.default.findOne({ email });
        if (!user) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        }
        // If user signed up with Google and doesn't have a password
        if (!user.password) {
            res.status(400).json({ message: "Please login with Google" });
            return;
        }
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        }
        // Generate JWT token
        const token = (0, auth_1.generateToken)({
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
        });
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.login = login;
// Google OAuth callback
const googleCallback = (req, res) => {
    try {
        // Generate token for the authenticated user
        if (!req.user) {
            res.status(401).json({ message: "User not authenticated" });
            return;
        }
        const user = req.user; // Type assertion since passport user types are complex
        const token = (0, auth_1.generateToken)({
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
        });
        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL}/auth/google/callback?token=${token}`);
    }
    catch (error) {
        console.error("Google callback error:", error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
};
exports.googleCallback = googleCallback;
// Get current user
const getCurrentUser = async (req, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: "User not authenticated" });
            return;
        }
        const user = await User_1.default.findById(req.user.id).select("-password");
        res.json(user);
    }
    catch (error) {
        console.error("Get user error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ message: "Server error", error: errorMessage });
    }
};
exports.getCurrentUser = getCurrentUser;
