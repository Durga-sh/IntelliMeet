import React from 'react';
import CameraTest from '../components/CameraTest';

const CameraTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Camera Test</h1>
        <CameraTest />
      </div>
    </div>
  );
};

export default CameraTestPage;