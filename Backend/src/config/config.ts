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
};

export default config;
