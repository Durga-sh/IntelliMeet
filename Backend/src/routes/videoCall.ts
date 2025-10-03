import express from "express";
import videoCallController from "../controllers/videoCallController";

const router = express.Router();

// Create a new room
router.post("/rooms", videoCallController.createRoom);

// Join a room
router.post("/rooms/:roomId/join", videoCallController.joinRoom);

// Get room details
router.get("/rooms/:roomId", videoCallController.getRoomDetails);

// End a room
router.put("/rooms/:roomId/end", videoCallController.endRoom);

export default router;
