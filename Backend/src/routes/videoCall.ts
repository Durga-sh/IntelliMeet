import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import Room from "../models/Room";
import ChatMessage from "../models/ChatMessage";

const router = Router();

// Create a new room
router.post("/rooms", async (req: Request, res: Response) => {
  try {
    const { roomName, createdBy } = req.body;
    const roomId = uuidv4();

    const room = new Room({
      roomId,
      name: roomName || `Room ${roomId.substring(0, 8)}`,
      createdBy: createdBy || "Anonymous",
      isActive: true,
      participants: [],
    });

    await room.save();

    res.json({
      success: true,
      message: "Room created successfully",
      room: {
        id: room.roomId,
        name: room.name,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        isActive: room.isActive,
      },
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create room",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get room details
router.get("/rooms/:roomId", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.json({
      success: true,
      room: {
        id: room.roomId,
        name: room.name,
        isActive: room.isActive,
        createdAt: room.createdAt,
        participants: room.participants.filter((p) => !p.leftAt),
      },
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch room details",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// End a room
router.post("/rooms/:roomId/end", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId, isActive: true });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Active room not found",
      });
    }

    room.isActive = false;
    room.endedAt = new Date();
    await room.save();

    res.json({
      success: true,
      message: "Room ended successfully",
    });
  } catch (error) {
    console.error("Error ending room:", error);
    res.status(500).json({
      success: false,
      message: "Failed to end room",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get chat history for a room
router.get("/rooms/:roomId/messages", async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const messages = await ChatMessage.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json({
      success: true,
      messages: messages.reverse(),
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get active rooms
router.get("/rooms", async (req: Request, res: Response) => {
  try {
    const rooms = await Room.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      rooms: rooms.map((room) => ({
        id: room.roomId,
        name: room.name,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        participantCount: room.participants.filter((p) => !p.leftAt).length,
      })),
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rooms",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
