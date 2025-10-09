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
// Passport middleware
app.use(passport_1.default.initialize());
require("./config/passport");
// Routes
app.use("/api/auth", auth_1.default);
app.use("/api/video", videoCall_1.default);
app.use("/api/recordings", recording_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: "Internal Server Error",
        error: process.env.NODE_ENV === "production" ? {} : err,
    });
});
exports.default = app;
