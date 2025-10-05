# IntelliMeet - Video Conferencing Platform

A modern video conferencing platform built with React, Node.js, and mediasoup for real-time communication with recording capabilities.

## Features

- Real-time video and audio communication
- Screen sharing capabilities  
- SFU (Selective Forwarding Unit) architecture using mediasoup
- **Recording functionality with status tracking**
- **Cloud storage integration (AWS S3)**
- **Real-time recording progress monitoring**
- JWT-based authentication
- Responsive design with Tailwind CSS
- TypeScript for type safety

## Recording Status Tracking

### How to Know if Recording is Done and Stored

This project includes comprehensive recording status tracking to answer the question: **"How can I know if recording is done or not and it is stored or not?"**

#### API Endpoints

1. **Get Recording Status**: `GET /api/recording/status/:roomId`
   - Returns complete recording status including progress and storage info

2. **Check Storage Status**: `GET /api/recording/storage/:roomId`  
   - Specifically checks if recording file is stored in cloud storage

3. **Get Recording Progress**: `GET /api/recording/progress/:roomId`
   - Returns detailed progress information about the recording process

#### Recording States

- **recording** (25% progress) - Recording is actively in progress
- **processing** (75% progress) - Recording stopped, FFmpeg is converting to MP4  
- **completed** (100% progress) - Recording is done and file is ready
- **failed** (0% progress) - Recording failed due to error

#### Quick Status Check Example

```javascript
// Check if recording is done and stored
const checkRecordingStatus = async (roomId) => {
  const response = await fetch(`/api/recording/status/${roomId}`);
  const data = await response.json();
  
  if (data.success) {
    const { progress, storage } = data.data;
    
    if (progress.isCompleted && storage.isStored) {
      console.log('✅ Recording is DONE and STORED');
      return true; // Ready for download
    } else if (progress.isProcessing) {
      console.log('🔄 Still processing...');
    } else if (progress.isRecording) {
      console.log('🔴 Still recording...');
    }
  }
  return false;
};
```

#### Frontend Component

The project includes a `RecordingStatusChecker` component that:
- Automatically polls recording status every 3 seconds
- Shows real-time progress updates
- Displays storage status
- Provides download button when ready
- Shows visual indicators for each state

#### File Location

- **Backend API**: `Backend/src/routes/recording.ts` - Status endpoints
- **Frontend Component**: `Frontend/src/components/RecordingStatusChecker.tsx`
- **Detailed Guide**: `RECORDING_STATUS_GUIDE.md`

## Architecture

```
Browser → SFU (mediasoup) → FFmpeg → AWS S3 Storage
    ↓
Recording Status API ← Real-time Status Updates
```

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- mediasoup (WebRTC SFU)
- FFmpeg (Video processing)
- AWS S3 (Cloud storage)
- MongoDB (Recording metadata)
- Socket.IO (Real-time communication)

### Frontend  
- React + TypeScript
- Tailwind CSS
- mediasoup-client
- WebRTC APIs

## Getting Started

### Prerequisites
- Node.js 16+
- MongoDB
- AWS S3 account
- FFmpeg installed

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```bash
   cd Backend
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd Frontend  
   npm install
   ```

4. Configure environment variables (see `.env.example`)

5. Build and start:
   ```bash
   # Backend
   cd Backend
   npm run build
   npm start
   
   # Frontend
   cd Frontend
   npm run dev
   ```

## Recording Status Integration

### In Video Call Component

The recording status is integrated directly into the video call interface:

```jsx
import RecordingStatusChecker from './RecordingStatusChecker';

// In your VideoCall component
<div className="video-call">
  {/* Video streams */}
  
  {/* Recording Status Panel */}
  <RecordingStatusChecker roomId={roomId} />
</div>
```

### Real-time Status Updates

The system provides real-time updates through:
- **Polling**: Frontend polls status API every 3 seconds during active recording
- **Visual Indicators**: Progress bars, status badges, and completion notifications
- **Storage Verification**: Checks cloud storage to confirm file availability

## Summary

**To know if recording is done and stored:**

1. Call `/api/recording/status/:roomId`
2. Check `progress.isCompleted === true` AND `storage.isStored === true`
3. If both are true → Recording is **DONE and STORED** ✅
4. Use `storage.s3Url` to download the file

The system provides complete visibility into the recording process from start to finish, ensuring you always know the exact status of your recordings.