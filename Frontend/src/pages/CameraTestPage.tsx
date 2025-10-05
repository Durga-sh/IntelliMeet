import React from 'react';
import CameraTest from '../components/CameraTest';

const CameraTestPage: React.FC = () => {
  return (
    <div className="bg-background py-8 min-h-[calc(100vh-160px)]">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-ai-primary to-ai-secondary bg-clip-text text-transparent">Camera Test</h1>
        <CameraTest />
      </div>
    </div>
  );
};

export default CameraTestPage;