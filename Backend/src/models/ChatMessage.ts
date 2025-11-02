import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage extends Document {
  roomId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
  delivered: boolean;
  deliveredTo: string[];
  readBy: string[];
}

const ChatMessageSchema: Schema = new Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  delivered: {
    type: Boolean,
    default: false,
  },
  deliveredTo: [String],
  readBy: [String],
});

export default mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
