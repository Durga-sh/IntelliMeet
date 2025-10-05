import React, { useState, useEffect } from 'react';

interface RecordingIndicatorProps {
  roomId: string;
  isRecording: boolean;
  recordingStatus: string;
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  roomId,
  isRecording,
  recordingStatus
}) => {
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Update duration every second when recording
  useEffect(() => {
    let interval: number;
    
    if (isRecording) {
      if (!startTime) {
        setStartTime(new Date());
      }
      
      interval = setInterval(() => {
        if (startTime) {
          const now = new Date();
          const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          setDuration(diff);
        }
      }, 1000);
    } else {
      if (recordingStatus === 'not-started' || recordingStatus === 'completed') {
        setDuration(0);
        setStartTime(null);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, startTime, recordingStatus]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const getStatusDisplay = () => {
    switch (recordingStatus) {
      case 'recording':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-500/30',
          icon: '🔴',
          text: 'RECORDING',
          showDuration: true
        };
      case 'processing':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-500/30',
          icon: '⚙️',
          text: 'PROCESSING',
          showDuration: false
        };
      case 'completed':
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-500/30',
          icon: '✅',
          text: 'READY',
          showDuration: false
        };
      case 'failed':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-500/30',
          icon: '❌',
          text: 'FAILED',
          showDuration: false
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusDisplay();

  if (!statusInfo) return null;

  return (
    <div className={`flex items-center space-x-3 px-4 py-2 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
      <div className="flex items-center space-x-2">
        <span className="text-lg">{statusInfo.icon}</span>
        <span className={`font-semibold text-sm ${statusInfo.color}`}>
          {statusInfo.text}
        </span>
      </div>
      
      {statusInfo.showDuration && (
        <div className={`font-mono text-sm ${statusInfo.color}`}>
          {formatDuration(duration)}
        </div>
      )}
      
      <div className="text-xs text-gray-400">
        Room: {roomId.substring(0, 8)}
      </div>
    </div>
  );
};

export default RecordingIndicator;