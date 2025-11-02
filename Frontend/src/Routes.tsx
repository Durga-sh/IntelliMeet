import { Route, Routes } from "react-router-dom";
import Index from "./pages/page";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFound from "./pages/NotFound";
import VideoCallRoom from "./components/VideoCallRoom";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/room/:roomId" element={<VideoCallRoom />} />
      <Route path="/auth/google/callback" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
