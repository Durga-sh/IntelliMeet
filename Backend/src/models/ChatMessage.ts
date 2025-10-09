import mongoose, { Document, Schema } from "mongoose";

export interface IChatMessage extends Document {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  messageType: "text" | "file" | "system";
  timestamp: Date;
  deliveredTo: Array<{
    userId: string;
    deliveredAt: Date;
  }>;
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  isEdited: boolean;
  editedAt?: Date;
  replyTo?: string; // ID of message being replied to
  reactions: Array<{
    userId: string;
    emoji: string;
    timestamp: Date;
  }>;
  fileInfo?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  };
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
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
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
ChatMessageSchema.index({ roomId: 1, timestamp: -1 });
ChatMessageSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
