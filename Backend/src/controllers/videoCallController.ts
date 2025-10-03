import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

class VideoCallController {
  // Create a new room
  public createRoom = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomName, createdBy } = req.body;

      const roomId = uuidv4();

      // In a real application, you might want to save room details to database
      const roomData = {
        id: roomId,
        name: roomName || `Room ${roomId.substring(0, 8)}`,
        createdBy: createdBy || "Anonymous",
        createdAt: new Date(),
        isActive: true,
      };

      res.status(201).json({
        success: true,
        message: "Room created successfully",
        room: roomData,
      });
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create room",
        error: process.env.NODE_ENV === "development" ? error : {},
      });
    }
  };

  // Join an existing room
  public joinRoom = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomId } = req.params;
      const { userName } = req.body;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: "Room ID is required",
        });
        return;
      }

      // In a real application, you might want to validate if room exists in database
      res.status(200).json({
        success: true,
        message: "Ready to join room",
        roomId,
        userName: userName || "Anonymous",
      });
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(500).json({
        success: false,
        message: "Failed to join room",
        error: process.env.NODE_ENV === "development" ? error : {},
      });
    }
  };

  // Get room details
  public getRoomDetails = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { roomId } = req.params;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: "Room ID is required",
        });
        return;
      }

      // In a real application, fetch from database
      const roomData = {
        id: roomId,
        name: `Room ${roomId.substring(0, 8)}`,
        isActive: true,
        createdAt: new Date(),
      };

      res.status(200).json({
        success: true,
        room: roomData,
      });
    } catch (error) {
      console.error("Error getting room details:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get room details",
        error: process.env.NODE_ENV === "development" ? error : {},
      });
    }
  };

  // End a room (only creator can do this)
  public endRoom = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomId } = req.params;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: "Room ID is required",
        });
        return;
      }

      // In a real application, update database and notify all users
      res.status(200).json({
        success: true,
        message: "Room ended successfully",
      });
    } catch (error) {
      console.error("Error ending room:", error);
      res.status(500).json({
        success: false,
        message: "Failed to end room",
        error: process.env.NODE_ENV === "development" ? error : {},
      });
    }
  };
}

export default new VideoCallController();
