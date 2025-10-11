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
const RecordingSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    roomId: {
        type: String,
        required: true,
        index: true,
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
    },
    duration: {
        type: Number, // in milliseconds
    },
    localPath: {
        type: String,
    },
    s3Url: {
        type: String,
    },
    s3Key: {
        type: String,
        index: true,
    },
    status: {
        type: String,
        enum: [
            "recording",
            "processing",
            "completed",
            "failed",
            "local",
            "uploading",
            "uploaded",
        ],
        default: "recording",
        index: true,
    },
    uploadStatus: {
        type: String,
        enum: ["pending", "queued", "uploading", "uploaded", "failed"],
        default: "pending",
        index: true,
    },
    uploadAttempts: {
        type: Number,
        default: 0,
    },
    uploadError: {
        type: String,
    },
    participants: [
        {
            type: String,
        },
    ],
    fileSize: {
        type: Number, // in bytes
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
}, {
    timestamps: true,
});
// Indexes for better query performance
RecordingSchema.index({ roomId: 1, startTime: -1 });
RecordingSchema.index({ status: 1, createdAt: -1 });
RecordingSchema.index({ uploadStatus: 1, createdAt: -1 });
RecordingSchema.index({ s3Key: 1 });
// Virtual for recording duration in human-readable format
RecordingSchema.virtual("formattedDuration").get(function () {
    if (!this.duration || typeof this.duration !== "number")
        return null;
    const seconds = Math.floor(this.duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    else {
        return `${seconds}s`;
    }
});
// Virtual for file size in human-readable format
RecordingSchema.virtual("formattedFileSize").get(function () {
    if (!this.fileSize || typeof this.fileSize !== "number")
        return null;
    const sizes = ["B", "KB", "MB", "GB"];
    let size = this.fileSize;
    let unit = 0;
    while (size >= 1024 && unit < sizes.length - 1) {
        size /= 1024;
        unit++;
    }
    return `${size.toFixed(2)} ${sizes[unit]}`;
});
// Method to check if recording is active
RecordingSchema.methods.isActive = function () {
    return this.status === "recording";
};
// Method to check if recording is completed
RecordingSchema.methods.isCompleted = function () {
    return this.status === "completed";
};
// Method to check if recording failed
RecordingSchema.methods.isFailed = function () {
    return this.status === "failed";
};
// Static method to find recordings by room
RecordingSchema.statics.findByRoom = function (roomId) {
    return this.find({ roomId }).sort({ startTime: -1 });
};
// Static method to find active recordings
RecordingSchema.statics.findActive = function () {
    return this.find({ status: "recording" });
};
// Static method to find completed recordings
RecordingSchema.statics.findCompleted = function () {
    return this.find({
        status: { $in: ["completed", "local", "uploaded"] },
    }).sort({ endTime: -1 });
};
// Static method to find recordings ready for upload
RecordingSchema.statics.findReadyForUpload = function () {
    return this.find({
        status: "local",
        uploadStatus: { $in: ["pending", "failed"] },
        localPath: { $exists: true },
    }).sort({ createdAt: 1 });
};
// Static method to cleanup old recordings
RecordingSchema.statics.cleanupOld = function (daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    return this.deleteMany({
        endTime: { $lt: cutoffDate },
        status: "completed",
    });
};
exports.default = mongoose_1.default.model("Recording", RecordingSchema);
