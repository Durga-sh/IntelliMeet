import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";


// Protected Route Component


const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Routes>
  );
};

export default AppRoutes;
