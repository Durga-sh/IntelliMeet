import React, { useState, useEffect } from 'react';

interface RecordingStatusProps {
  roomId: string;
}

interface RecordingStatus {
  recording: {
    id: string;
    roomId: string;
    status: 'recording' | 'processing' | 'completed' | 'failed';
    startTime: string;
    endTime?: string;
    duration?: number;
    participants: string[];
  };
  storage: {
    isStored: boolean;
    s3Url?: string;
    s3Key?: string;
    fileSize: number;
  };
  progress: {
    isRecording: boolean;
    isProcessing: boolean;
    isCompleted: boolean;
    isFailed: boolean;
    canDownload: boolean;
  };
}

const RecordingStatusChecker: React.FC<RecordingStatusProps> = ({ roomId }) => {
  const [status, setStatus] = useState<RecordingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch recording status
  const fetchRecordingStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/recording/status/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recording status');
      }

      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to check storage status
  const checkStorageStatus = async () => {
    try {
      const response = await fetch(`/api/recording/storage/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check storage status');
      }

      const data = await response.json();
      console.log('Storage Status:', data.data);
      return data.data;
    } catch (err: any) {
      console.error('Storage check error:', err.message);
      return null;
    }
  };

  // Function to get recording progress
  const fetchRecordingProgress = async () => {
    try {
      const response = await fetch(`/api/recording/progress/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recording progress');
      }

      const data = await response.json();
      console.log('Recording Progress:', data.data);
      return data.data;
    } catch (err: any) {
      console.error('Progress fetch error:', err.message);
      return null;
    }
  };

  // Auto-refresh when recording is active
  useEffect(() => {
    fetchRecordingStatus();

    const interval = setInterval(() => {
      if (status?.progress.isRecording || status?.progress.isProcessing) {
        fetchRecordingStatus();
      }
    }, 3000); // Check every 3 seconds when recording/processing

    return () => clearInterval(interval);
  }, [roomId, status?.progress.isRecording, status?.progress.isProcessing]);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'recording': return 'text-red-600 bg-red-100';
      case 'processing': return 'text-yellow-600 bg-yellow-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Download recording
  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/recording/download/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      if (data.success) {
        window.open(data.data.downloadUrl, '_blank');
      } else {
        alert('Failed to get download URL: ' + data.message);
      }
    } catch (err: any) {
      alert('Download error: ' + err.message);
    }
  };

  if (loading && !status) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium">Error</h3>
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchRecordingStatus}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">No recording found for room: {roomId}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Recording Status</h2>
        <button
          onClick={fetchRecordingStatus}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.recording.status)}`}>
          {status.recording.status.toUpperCase()}
          {status.progress.isRecording && (
            <span className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          )}
        </span>
      </div>

      {/* Progress Information */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-600">Room ID:</span>
          <span className="font-medium">{status.recording.roomId}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Participants:</span>
          <span className="font-medium">{status.recording.participants.length}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Started:</span>
          <span className="font-medium">
            {new Date(status.recording.startTime).toLocaleString()}
          </span>
        </div>

        {status.recording.endTime && (
          <div className="flex justify-between">
            <span className="text-gray-600">Ended:</span>
            <span className="font-medium">
              {new Date(status.recording.endTime).toLocaleString()}
            </span>
          </div>
        )}

        {status.recording.duration && (
          <div className="flex justify-between">
            <span className="text-gray-600">Duration:</span>
            <span className="font-medium">{formatDuration(status.recording.duration)}</span>
          </div>
        )}
      </div>

      {/* Storage Status */}
      <div className="border-t pt-4 mb-6">
        <h3 className="text-lg font-medium mb-3">Storage Status</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Stored in Cloud:</span>
            <span className={`font-medium ${status.storage.isStored ? 'text-green-600' : 'text-red-600'}`}>
              {status.storage.isStored ? '✅ Yes' : '❌ No'}
            </span>
          </div>
          
          {status.storage.fileSize > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">File Size:</span>
              <span className="font-medium">{formatFileSize(status.storage.fileSize)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {status.progress.canDownload && (
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            📥 Download Recording
          </button>
        )}
        
        <button
          onClick={checkStorageStatus}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          🔍 Check Storage
        </button>
        
        <button
          onClick={fetchRecordingProgress}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          📊 Check Progress
        </button>
      </div>

      {/* Status Guide */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">How to know if recording is done:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>RECORDING:</strong> Recording is actively in progress</li>
          <li>• <strong>PROCESSING:</strong> Recording stopped, converting to MP4</li>
          <li>• <strong>COMPLETED:</strong> Recording is done and ready</li>
          <li>• <strong>Cloud Storage:</strong> ✅ means file is stored and accessible</li>
          <li>• <strong>Download:</strong> Button appears when recording is complete and stored</li>
        </ul>
      </div>
    </div>
  );
};

export default RecordingStatusChecker;