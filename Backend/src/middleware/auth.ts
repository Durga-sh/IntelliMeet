import { Request, Response, NextFunction } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import config from "../config/config";

// Interface for User object
interface User {
  _id: string;
  email: string;
  role: string;
  name?: string;
}

// Extended Request interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: User;
}

// Authentication middleware
export const authenticate = passport.authenticate("jwt", { session: false });

// Generate JWT token
export const generateToken = (user: User): string => {
  if (!config.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    config.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Check if user is authenticated
export const isAuthenticated = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: Error | null, user: User | false) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        res
          .status(401)
          .json({ message: "Unauthorized access - please log in" });
        return;
      }
      req.user = user;
      next();
    }
  )(req, res, next);
};
