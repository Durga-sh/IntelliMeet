"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const ChatMessageSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    roomId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    message: { type: String, required: true },
    messageType: {
        type: String,
        enum: ["text", "file", "system"],
        default: "text",
    },
    timestamp: { type: Date, default: Date.now, index: true },
    deliveredTo: [
        {
            userId: { type: String, required: true },
            deliveredAt: { type: Date, default: Date.now },
        },
    ],
    readBy: [
        {
            userId: { type: String, required: true },
            readAt: { type: Date, default: Date.now },
        },
    ],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    replyTo: { type: String },
    reactions: [
        {
            userId: { type: String, required: true },
            emoji: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    fileInfo: {
        fileName: { type: String },
        fileSize: { type: Number },
        fileType: { type: String },
        fileUrl: { type: String },
    },
}, {
    timestamps: true,
});
// Indexes for better performance
ChatMessageSchema.index({ roomId: 1, timestamp: -1 });
ChatMessageSchema.index({ userId: 1, timestamp: -1 });
exports.default = mongoose_1.default.model("ChatMessage", ChatMessageSchema);
