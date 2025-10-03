import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const CameraTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const startCamera = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Requesting camera access...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      console.log('Camera access granted:', mediaStream);
      console.log('Video tracks:', mediaStream.getVideoTracks());
      console.log('Audio tracks:', mediaStream.getAudioTracks());
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log('Video element updated with stream');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(`Failed to access camera: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Camera Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={startCamera} 
            disabled={isLoading || !!stream}
          >
            {isLoading ? 'Starting...' : 'Start Camera'}
          </Button>
          <Button 
            onClick={stopCamera} 
            disabled={!stream}
            variant="destructive"
          >
            Stop Camera
          </Button>
        </div>
        
        {error && (
          <div className="text-red-500 p-2 bg-red-50 rounded">
            {error}
          </div>
        )}
        
        <div className="aspect-video bg-gray-100 rounded overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} // Mirror effect
          />
        </div>
        
        {stream && (
          <div className="text-sm text-gray-600">
            <p>Stream active with {stream.getVideoTracks().length} video tracks and {stream.getAudioTracks().length} audio tracks</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CameraTest;