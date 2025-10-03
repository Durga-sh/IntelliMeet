"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const videoCallController_1 = __importDefault(require("../controllers/videoCallController"));
const router = express_1.default.Router();
// Create a new room
router.post("/rooms", videoCallController_1.default.createRoom);
// Join a room
router.post("/rooms/:roomId/join", videoCallController_1.default.joinRoom);
// Get room details
router.get("/rooms/:roomId", videoCallController_1.default.getRoomDetails);
// End a room
router.put("/rooms/:roomId/end", videoCallController_1.default.endRoom);
exports.default = router;
