import { Route, Routes } from "react-router-dom";
import Index from "./pages/page";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFound from "./pages/NotFound";
import VideoCallPage from "./pages/VideoCallPage";
import CameraTestPage from "./pages/CameraTestPage";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/video-call" element={<VideoCallPage />} />
      <Route path="/camera-test" element={<CameraTestPage />} />
      <Route path="/auth/google/callback" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
