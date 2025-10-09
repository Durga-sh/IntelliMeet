import mongoose, { Document, Schema } from "mongoose";

export interface IRecording extends Document {
  id: string;
  roomId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  localPath?: string;
  s3Url?: string;
  s3Key?: string;
  status: "recording" | "processing" | "completed" | "failed";
  participants: string[];
  fileSize?: number; // in bytes
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RecordingSchema: Schema = new Schema(
  {
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
      enum: ["recording", "processing", "completed", "failed"],
      default: "recording",
      index: true,
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
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
RecordingSchema.index({ roomId: 1, startTime: -1 });
RecordingSchema.index({ status: 1, createdAt: -1 });
RecordingSchema.index({ s3Key: 1 });

// Virtual for recording duration in human-readable format
RecordingSchema.virtual("formattedDuration").get(function (this: IRecording) {
  if (!this.duration || typeof this.duration !== "number") return null;

  const seconds = Math.floor(this.duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
});

// Virtual for file size in human-readable format
RecordingSchema.virtual("formattedFileSize").get(function (this: IRecording) {
  if (!this.fileSize || typeof this.fileSize !== "number") return null;

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
RecordingSchema.methods.isActive = function (): boolean {
  return this.status === "recording";
};

// Method to check if recording is completed
RecordingSchema.methods.isCompleted = function (): boolean {
  return this.status === "completed";
};

// Method to check if recording failed
RecordingSchema.methods.isFailed = function (): boolean {
  return this.status === "failed";
};

// Static method to find recordings by room
RecordingSchema.statics.findByRoom = function (roomId: string) {
  return this.find({ roomId }).sort({ startTime: -1 });
};

// Static method to find active recordings
RecordingSchema.statics.findActive = function () {
  return this.find({ status: "recording" });
};

// Static method to find completed recordings
RecordingSchema.statics.findCompleted = function () {
  return this.find({ status: "completed" }).sort({ endTime: -1 });
};

// Static method to cleanup old recordings
RecordingSchema.statics.cleanupOld = function (daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    endTime: { $lt: cutoffDate },
    status: "completed",
  });
};

export default mongoose.model<IRecording>("Recording", RecordingSchema);
