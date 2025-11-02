import mongoose, { Schema, Document } from "mongoose";

export interface IRoom extends Document {
  roomId: string;
  name: string;
  createdBy: string;
  isActive: boolean;
  participants: Array<{
    userId: string;
    userName: string;
    joinedAt: Date;
    leftAt?: Date;
  }>;
  createdAt: Date;
  endedAt?: Date;
}

const RoomSchema: Schema = new Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  participants: [
    {
      userId: String,
      userName: String,
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      leftAt: Date,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: Date,
});

export default mongoose.model<IRoom>("Room", RoomSchema);
