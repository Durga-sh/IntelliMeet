# Recording Status API Guide

This guide explains how to check if a recording is done and if it's stored properly.

## API Endpoints

### 1. Get Recording Status
**GET** `/api/recording/status/:roomId`

Returns comprehensive recording status including progress and storage information.

**Response:**
```json
{
  "success": true,
  "data": {
    "recording": {
      "id": "recording_id",
      "roomId": "room_123",
      "status": "completed", // "recording", "processing", "completed", "failed"
      "startTime": "2024-01-01T10:00:00Z",
      "endTime": "2024-01-01T10:30:00Z",
      "duration": 1800000, // in milliseconds
      "participants": ["user1", "user2"]
    },
    "storage": {
      "isStored": true,
      "s3Url": "https://s3.amazonaws.com/bucket/recordings/room_123.mp4",
      "s3Key": "recordings/room_123.mp4",
      "fileSize": 52428800 // in bytes
    },
    "progress": {
      "isRecording": false,
      "isProcessing": false,
      "isCompleted": true,
      "isFailed": false,
      "canDownload": true
    }
  }
}
```

### 2. Check Storage Status
**GET** `/api/recording/storage/:roomId`

Specifically checks if the recording file is stored in cloud storage.

**Response:**
```json
{
  "success": true,
  "data": {
    "isStored": true,
    "s3Key": "recordings/room_123.mp4",
    "s3Url": "https://s3.amazonaws.com/bucket/recordings/room_123.mp4",
    "fileSize": 52428800,
    "lastModified": "2024-01-01T10:35:00Z"
  }
}
```

### 3. Get Recording Progress
**GET** `/api/recording/progress/:roomId`

Returns detailed progress information about the recording process.

**Response:**
```json
{
  "success": true,
  "data": {
    "roomId": "room_123",
    "status": "completed",
    "progressPercentage": 100,
    "currentStep": "Recording completed",
    "startTime": "2024-01-01T10:00:00Z",
    "endTime": "2024-01-01T10:30:00Z",
    "duration": 1800000,
    "participants": 2,
    "isRecording": false,
    "isProcessing": false,
    "isCompleted": true,
    "isFailed": false
  }
}
```

## Recording States

### 1. **recording**
- Recording is actively in progress
- Status: `progressPercentage: 25`
- Action: Wait for recording to stop

### 2. **processing** 
- Recording stopped, FFmpeg is converting to MP4
- Status: `progressPercentage: 75`
- Action: Wait for processing to complete

### 3. **completed**
- Recording is done and file is ready
- Status: `progressPercentage: 100`
- Action: Check if stored, then download

### 4. **failed**
- Recording failed due to error
- Status: `progressPercentage: 0`
- Action: Retry or check logs

## How to Know When Recording is Done

### Method 1: Polling Status API
```javascript
const checkRecordingStatus = async (roomId) => {
  const response = await fetch(`/api/recording/status/${roomId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    const { recording, storage, progress } = data.data;
    
    // Check if recording is done
    if (progress.isCompleted && storage.isStored) {
      console.log('✅ Recording is DONE and STORED');
      console.log(`File size: ${storage.fileSize} bytes`);
      console.log(`Download URL: ${storage.s3Url}`);
      return true;
    } else if (progress.isProcessing) {
      console.log('🔄 Recording is still processing...');
      return false;
    } else if (progress.isRecording) {
      console.log('🔴 Recording is still in progress...');
      return false;
    }
  }
  
  return false;
};

// Poll every 3 seconds
const pollRecordingStatus = (roomId) => {
  const interval = setInterval(async () => {
    const isDone = await checkRecordingStatus(roomId);
    
    if (isDone) {
      clearInterval(interval);
      console.log('Recording process completed!');
    }
  }, 3000);
};
```

### Method 2: Check Storage Specifically
```javascript
const checkIfStored = async (roomId) => {
  const response = await fetch(`/api/recording/storage/${roomId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success && data.data.isStored) {
    console.log('✅ Recording is stored in cloud');
    console.log(`File size: ${data.data.fileSize} bytes`);
    return true;
  } else {
    console.log('❌ Recording not yet stored');
    return false;
  }
};
```

### Method 3: Real-time with Socket.IO (if implemented)
```javascript
// Listen for recording events
socket.on('recording-completed', (data) => {
  console.log('✅ Recording completed:', data);
});

socket.on('recording-stored', (data) => {
  console.log('✅ Recording stored:', data);
});

socket.on('recording-failed', (data) => {
  console.log('❌ Recording failed:', data);
});
```

## Frontend React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const RecordingStatus = ({ roomId }) => {
  const [status, setStatus] = useState(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/recording/status/${roomId}`);
        const data = await response.json();
        
        if (data.success) {
          setStatus(data.data);
          
          // Check if recording is done and stored
          const isComplete = data.data.progress.isCompleted && data.data.storage.isStored;
          setIsDone(isComplete);
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    // Check immediately
    checkStatus();

    // Poll every 3 seconds if not done
    const interval = setInterval(() => {
      if (!isDone) {
        checkStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [roomId, isDone]);

  if (!status) return <div>Loading...</div>;

  return (
    <div className="recording-status">
      <h3>Recording Status for Room: {roomId}</h3>
      
      <div className={`status-badge ${status.recording.status}`}>
        Status: {status.recording.status.toUpperCase()}
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ 
            width: `${
              status.progress.isRecording ? '25%' : 
              status.progress.isProcessing ? '75%' : 
              status.progress.isCompleted ? '100%' : '0%'
            }` 
          }}
        />
      </div>
      
      <div className="storage-status">
        Storage: {status.storage.isStored ? '✅ Stored' : '❌ Not Stored'}
        {status.storage.fileSize > 0 && (
          <span> ({Math.round(status.storage.fileSize / 1024 / 1024)}MB)</span>
        )}
      </div>
      
      {isDone && (
        <div className="completion-notice">
          🎉 Recording is DONE and STORED!
          <button onClick={() => window.open(status.storage.s3Url)}>
            Download Recording
          </button>
        </div>
      )}
    </div>
  );
};
```

## Summary

**To know if recording is done and stored:**

1. **Call** `/api/recording/status/:roomId`
2. **Check** `progress.isCompleted === true`
3. **Check** `storage.isStored === true`
4. **If both true** → Recording is DONE and STORED ✅
5. **Use** `storage.s3Url` to download the file

**Status Flow:**
`recording` (25%) → `processing` (75%) → `completed` (100%) + `isStored: true` = **DONE** ✅