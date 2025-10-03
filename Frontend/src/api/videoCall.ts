import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export interface CreateRoomRequest {
  roomName?: string;
  createdBy?: string;
}

export interface CreateRoomResponse {
  success: boolean;
  message: string;
  room: {
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
    isActive: boolean;
  };
}

export interface JoinRoomRequest {
  userName?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  message: string;
  roomId: string;
  userName: string;
}

export interface RoomDetailsResponse {
  success: boolean;
  room: {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
  };
}

// Create a new video call room
export const createRoom = async (
  data: CreateRoomRequest
): Promise<CreateRoomResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/video/rooms`, data);
    return response.data;
  } catch (error) {
    console.error("Error creating room:", error);
    throw error;
  }
};

// Join an existing room
export const joinRoom = async (
  roomId: string,
  data: JoinRoomRequest
): Promise<JoinRoomResponse> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/video/rooms/${roomId}/join`,
      data
    );
    return response.data;
  } catch (error) {
    console.error("Error joining room:", error);
    throw error;
  }
};

// Get room details
export const getRoomDetails = async (
  roomId: string
): Promise<RoomDetailsResponse> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/rooms/${roomId}`);
    return response.data;
  } catch (error) {
    console.error("Error getting room details:", error);
    throw error;
  }
};

// End a room
export const endRoom = async (
  roomId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.put(`${API_BASE_URL}/rooms/${roomId}/end`);
    return response.data;
  } catch (error) {
    console.error("Error ending room:", error);
    throw error;
  }
};
