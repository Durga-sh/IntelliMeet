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
const register = async (req, res) => {
    try {
        const { name, email, password, role, } = req.body;
        let existingUser = await User_1.default.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }
        const otp = generateOTP();
        const tempUserId = crypto_1.default.randomUUID();
        tempUsers.set(tempUserId, {
            name,
            email,
            password,
            role,
            otp,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
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
const verifyOTP = async (req, res) => {
    try {
        const { tempUserId, otp } = req.body;
        const tempUserData = tempUsers.get(tempUserId);
        if (!tempUserData) {
            res
                .status(400)
                .json({ message: "Invalid or expired verification session" });
            return;
        }
        if (new Date() > tempUserData.expiresAt) {
            tempUsers.delete(tempUserId);
            res
                .status(400)
                .json({ message: "OTP has expired. Please register again." });
            return;
        }
        if (tempUserData.otp !== otp) {
            res.status(400).json({ message: "Invalid OTP" });
            return;
        }
        const user = new User_1.default({
            name: tempUserData.name,
            email: tempUserData.email,
            password: tempUserData.password,
            role: tempUserData.role,
            isEmailVerified: true,
        });
        await user.save();
        tempUsers.delete(tempUserId);
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
const resendOTP = async (req, res) => {
    try {
        const { tempUserId } = req.body;
        const tempUserData = tempUsers.get(tempUserId);
        if (!tempUserData) {
            res.status(400).json({ message: "Invalid verification session" });
            return;
        }
        const newOTP = generateOTP();
        tempUsers.set(tempUserId, {
            ...tempUserData,
            otp: newOTP,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
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
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User_1.default.findOne({ email });
        if (!user) {
            res.status(404).json({ message: "User not found with this email" });
            return;
        }
        if (!user.password) {
            res.status(400).json({
                message: "This account was created with Google. Please login with Google.",
            });
            return;
        }
        const otp = generateOTP();
        const tempResetId = crypto_1.default.randomUUID();
        passwordResetOTPs.set(tempResetId, {
            userId: user._id.toString(),
            email: user.email,
            otp,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
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
const verifyPasswordResetOTP = async (req, res) => {
    try {
        const { tempResetId, otp } = req.body;
        const otpData = passwordResetOTPs.get(tempResetId);
        if (!otpData) {
            res.status(400).json({ message: "Invalid or expired OTP session" });
            return;
        }
        if (new Date() > otpData.expiresAt) {
            passwordResetOTPs.delete(tempResetId);
            res
                .status(400)
                .json({ message: "OTP has expired. Please request a new one." });
            return;
        }
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
const resetPassword = async (req, res) => {
    try {
        const { tempResetId, newPassword, } = req.body;
        const otpData = passwordResetOTPs.get(tempResetId);
        if (!otpData) {
            res.status(400).json({ message: "Invalid or expired OTP session" });
            return;
        }
        if (new Date() > otpData.expiresAt) {
            passwordResetOTPs.delete(tempResetId);
            res.status(400).json({
                message: "OTP has expired. Please request a new one.",
            });
            return;
        }
        const user = await User_1.default.findById(otpData.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        user.password = newPassword;
        await user.save();
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
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.default.findOne({ email });
        if (!user) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        }
        if (!user.password) {
            res.status(400).json({ message: "Please login with Google" });
            return;
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        }
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
const googleCallback = (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "User not authenticated" });
            return;
        }
        const user = req.user;
        const token = (0, auth_1.generateToken)({
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
        });
        res.redirect(`${process.env.FRONTEND_URL}/auth/google/callback?token=${token}`);
    }
    catch (error) {
        console.error("Google callback error:", error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
};
exports.googleCallback = googleCallback;
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
