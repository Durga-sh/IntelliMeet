# IntelliMeet - Real-time Video & Audio Chat

A complete WebRTC video conferencing application with real-time chat using Mediasoup (SFU) and Socket.io.

## Features

### 🎥 Real-time Video & Audio Chat
- **WebRTC Implementation**: Peer-to-peer communication using Mediasoup SFU (Selective Forwarding Unit)
- **Multi-user Calls**: Support for multiple participants in a single room
- **HD Video Quality**: Up to 1280x720 video resolution
- **Audio/Video Controls**: Mute/unmute audio and video during calls
- **Screen Sharing**: Share your screen with other participants

### 💬 Live Chat with WebSocket
- **Socket.io Integration**: Real-time messaging in meetings
- **Message Delivery Receipts**: See when messages are delivered
- **Typing Indicators**: Know when others are typing
- **Chat History**: Persistent message storage in MongoDB
- **Read Receipts**: Track who has read your messages

## Architecture

### Backend Stack
- **Node.js + TypeScript + Express**: API server
- **Mediasoup**: SFU for video/audio streaming
- **Socket.io**: Real-time bidirectional communication
- **MongoDB + Mongoose**: Data persistence
- **JWT**: Authentication

### Frontend Stack
- **React + TypeScript**: UI framework
- **Mediasoup Client**: WebRTC client library
- **Socket.io Client**: Real-time communication
- **Tailwind CSS + shadcn/ui**: Styling
- **React Router**: Navigation

## Setup Instructions

### Prerequisites
- Node.js >= 16.x
- MongoDB running locally or remote connection
- Modern web browser with WebRTC support

### Backend Setup

1. Navigate to Backend directory:
```bash
cd Backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Configure `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/intellimeet
JWT_SECRET=your_secret_key_here
MEDIASOUP_ANNOUNCED_IP=127.0.0.1  # Use your public IP for production
FRONTEND_URL=http://localhost:5173
```

5. Start the development server:
```bash
npm run dev
```

The backend server will start on `http://localhost:5000`

### Frontend Setup

1. Navigate to Frontend directory:
```bash
cd Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Configure `.env` file:
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

5. Start the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

## Usage

### Creating a Room

1. Navigate to the application homepage
2. Click "Create Room" or use the API:
```bash
curl -X POST http://localhost:5000/api/video/rooms \
  -H "Content-Type: application/json" \
  -d '{"roomName": "My Meeting", "createdBy": "John Doe"}'
```

3. You'll receive a room ID - share this with participants

### Joining a Room

1. Navigate to `/room/:roomId` in your browser
2. Enter your name when prompted
3. Allow camera and microphone permissions
4. You'll automatically join the video call

### Video Call Controls

- **Microphone**: Click the mic icon to mute/unmute
- **Camera**: Click the camera icon to turn video on/off
- **Screen Share**: Click the screen icon to share your screen
- **Chat**: Click the chat icon to open the chat panel
- **End Call**: Click the red phone icon to leave the call

### Chat Features

- **Send Messages**: Type in the chat input and press Enter or click Send
- **Typing Indicators**: See when others are typing
- **Message Receipts**: ✓✓ indicates message was delivered
- **Scroll History**: Scroll up to view older messages

## API Endpoints

### Rooms

#### Create Room
```http
POST /api/video/rooms
Content-Type: application/json

{
  "roomName": "Meeting Room",
  "createdBy": "User Name"
}
```

#### Get Room Details
```http
GET /api/video/rooms/:roomId
```

#### Get Active Rooms
```http
GET /api/video/rooms
```

#### End Room
```http
POST /api/video/rooms/:roomId/end
```

#### Get Chat History
```http
GET /api/video/rooms/:roomId/messages?limit=50
```

## WebSocket Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `join-room` | `{roomId, userName, userId}` | Join a video call room |
| `create-transport` | `{roomId, direction}` | Create WebRTC transport |
| `connect-transport` | `{transportId, dtlsParameters}` | Connect transport |
| `produce` | `{transportId, kind, rtpParameters, appData}` | Produce audio/video |
| `consume` | `{transportId, producerId, rtpCapabilities}` | Consume remote stream |
| `pause-producer` | `{producerId}` | Pause producer |
| `resume-producer` | `{producerId}` | Resume producer |
| `close-producer` | `{producerId}` | Close producer |
| `send-message` | `{roomId, message, userName, userId}` | Send chat message |
| `typing-start` | `{roomId, userName, userId}` | Start typing |
| `typing-stop` | `{roomId, userId}` | Stop typing |
| `message-read` | `{messageId, userId}` | Mark message as read |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `router-rtp-capabilities` | `rtpCapabilities` | Router capabilities |
| `transport-created` | `{direction, transport}` | Transport created |
| `produced` | `{producerId}` | Producer created |
| `consumed` | Consumer data | Consumer created |
| `user-joined` | `{userId, userName}` | User joined room |
| `user-left` | `{userId, userName}` | User left room |
| `new-producer` | `{producerId, peerId, kind}` | New producer available |
| `producer-paused` | `{producerId, peerId}` | Producer paused |
| `producer-resumed` | `{producerId, peerId}` | Producer resumed |
| `new-message` | Message object | New chat message |
| `user-typing` | `{userId, userName}` | User is typing |
| `user-stopped-typing` | `{userId}` | User stopped typing |
| `message-delivered` | `{messageId, deliveredTo}` | Message delivered |
| `message-read-receipt` | `{messageId, userId}` | Message read |

## Project Structure

```
IntelliMeet/
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── config.ts
│   │   │   ├── db.ts
│   │   │   └── mediasoup.ts          # Mediasoup configuration
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Room.ts               # Room model
│   │   │   └── ChatMessage.ts        # Chat message model
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── videoCall.ts          # Video call routes
│   │   ├── services/
│   │   │   ├── mediasoupService.ts   # Mediasoup service
│   │   │   └── socketService.ts      # Socket.io service
│   │   ├── app.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoCallRoom.tsx     # Main video call component
│   │   │   ├── SimpleChat.tsx        # Chat component
│   │   │   └── ui/                   # UI components
│   │   ├── utils/
│   │   │   └── mediasoupClient.ts    # Mediasoup client wrapper
│   │   ├── App.tsx
│   │   └── Routes.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Technologies Used

### Mediasoup
- **SFU Architecture**: Selective Forwarding Unit for efficient multi-party video calls
- **Multiple Codecs**: VP8, VP9, H.264 support
- **Adaptive Bitrate**: Automatic quality adjustment
- **Simulcast Support**: Multiple quality streams

### Socket.io
- **Bidirectional Communication**: Real-time messaging
- **Automatic Reconnection**: Handles network interruptions
- **Room Support**: Logical grouping of connections
- **Event-based**: Clean API for real-time events

## Performance Optimizations

1. **SFU Architecture**: Better bandwidth utilization than mesh topology
2. **Worker Pool**: Multiple Mediasoup workers for load balancing
3. **Message Pagination**: Chat history with limits
4. **Lazy Loading**: Components loaded on demand
5. **Stream Cleanup**: Proper resource cleanup on disconnect

## Security Considerations

1. **JWT Authentication**: Secure user authentication
2. **CORS Configuration**: Restricted cross-origin requests
3. **Environment Variables**: Sensitive data in .env files
4. **Input Validation**: Sanitize user inputs
5. **Rate Limiting**: Prevent abuse (recommended for production)

## Troubleshooting

### Camera/Microphone Not Working
- Check browser permissions
- Ensure HTTPS in production (required for getUserMedia)
- Verify device is not in use by another application

### Connection Issues
- Check firewall settings
- Verify WebSocket connections are allowed
- Ensure MongoDB is running
- Check MEDIASOUP_ANNOUNCED_IP configuration

### Poor Video Quality
- Check network bandwidth
- Reduce video resolution in getUserMedia constraints
- Adjust Mediasoup bitrate settings

## Production Deployment

1. **Set MEDIASOUP_ANNOUNCED_IP**: Use your server's public IP
2. **Enable HTTPS**: Required for WebRTC
3. **Configure Firewall**: Open UDP ports 10000-10100
4. **Use Production MongoDB**: Don't use local MongoDB
5. **Set Strong JWT_SECRET**: Use a secure random string
6. **Enable Rate Limiting**: Prevent abuse
7. **Monitor Resources**: Use PM2 or similar for process management

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for learning and commercial purposes.

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review WebRTC/Mediasoup documentation

## Credits

Built with:
- [Mediasoup](https://mediasoup.org/)
- [Socket.io](https://socket.io/)
- [React](https://react.dev/)
- [Express](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
