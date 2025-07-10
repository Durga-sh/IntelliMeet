// frontend/src/api/auth.js

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Register user (Step 1: Send OTP)
export const register = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Registration failed");
  }

  return data;
};

// Verify OTP (Step 2: Complete registration)
export const verifyOTP = async (otpData) => {
  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(otpData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "OTP verification failed");
  }

  return data;
};

// Resend OTP
export const resendOTP = async (tempUserId) => {
  const response = await fetch(`${API_BASE_URL}/auth/resend-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tempUserId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to resend OTP");
  }

  return data;
};

// Login user
export const login = async (credentials) => {
  try {
    console.log("Sending login request with credentials:", credentials);
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    console.log("Response status:", response.status);
    const data = await response.json();
    console.log("Response data:", data);

    if (!response.ok) {
      throw new Error(
        data.message || `Login failed with status ${response.status}`
      );
    }

    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// Forgot Password - Send reset OTP
export const forgotPassword = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to send reset OTP");
  }

  return data;
};

// Verify Password Reset OTP
export const verifyPasswordResetOTP = async (tempResetId, otp) => {
  const response = await fetch(
    `${API_BASE_URL}/auth/verify-password-reset-otp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tempResetId, otp }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "OTP verification failed");
  }

  return data;
};

// Reset Password
export const resetPassword = async (tempResetId, newPassword) => {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tempResetId, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to reset password");
  }

  return data;
};

// Google Login
export const googleLogin = async (credential) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/google/verify`, {
      credential,
    });
    return response.data;
  } catch (error) {
    console.error('Google login error:', error);
    throw error.response?.data || error;
  }
};

// Verify Token
export const verifyToken = async () => {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    localStorage.removeItem("token");
    return false;
  }
};

// Get current user
export const getCurrentUser = async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No token found");
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get user data");
  }

  return data;
};
