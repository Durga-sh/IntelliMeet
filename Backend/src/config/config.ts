import dotenv from "dotenv";

dotenv.config();

interface Config {
  PORT: string | number;
  MONGO_URI: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  EMAIL_REFRESH_TOKEN: string;
  EMAIL_USER: string;
  EMAIL_PASS: string;
  // AWS Configuration
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
  // Mediasoup Configuration
  MEDIASOUP_LISTEN_IP: string;
  MEDIASOUP_ANNOUNCED_IP: string;
  MEDIASOUP_MIN_PORT: number;
  MEDIASOUP_MAX_PORT: number;
}

const config: Config = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI!,
  JWT_SECRET: process.env.JWT_SECRET!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL!,
  EMAIL_REFRESH_TOKEN: process.env.EMAIL_REFRESH_TOKEN!,
  EMAIL_USER: process.env.EMAIL_USER!,
  EMAIL_PASS: process.env.EMAIL_PASS!,
  // AWS Configuration
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
  AWS_REGION: process.env.AWS_REGION || "us-east-1",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET!,
  // Mediasoup Configuration
  MEDIASOUP_LISTEN_IP: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
  MEDIASOUP_ANNOUNCED_IP: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
  MEDIASOUP_MIN_PORT: parseInt(process.env.MEDIASOUP_MIN_PORT || "10000"),
  MEDIASOUP_MAX_PORT: parseInt(process.env.MEDIASOUP_MAX_PORT || "10100"),
};

export default config;