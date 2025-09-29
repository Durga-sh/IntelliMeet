import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

// Interface for User document
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  avatar?: string;
  role: "user" | "admin";
  createdAt: Date;
  comparePassword(enteredPassword: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  googleId: {
    type: String,
  },
  avatar: {
    type: String,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre<IUser>("save", async function (next) {
  if (this.password && this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model<IUser>("User", UserSchema);

export default User;
