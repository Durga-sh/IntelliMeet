import React, { createContext, useState, useEffect, ReactNode } from "react";
import { verifyToken, User } from "../api/auth";
import { setToken, removeToken, setAuthHeader } from "../utils/tokenManager";
import axios from "axios";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  loginUser: (user: User, token: string) => void;
  logoutUser: () => void;
  setError: (error: string | null) => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        // Set auth header for axios on initial load
        setAuthHeader(axios);

        const data = await verifyToken();
        if (data) {
          setUser(data);
        }
      } catch (err) {
        console.error("Auth verification error:", err);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();

    // Check for Google OAuth callback
    const handleGoogleAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (token && window.location.pathname.includes("/auth/google/callback")) {
        // Set token
        setToken(token);
        setAuthHeader(axios);

        try {
          // Get user info with the token
          const data = await verifyToken();
          if (data) {
            setUser(data);
            // Clean up URL
            window.history.replaceState({}, document.title, "/");
          }
        } catch (err) {
          console.error("Error processing Google OAuth callback:", err);
          setError("Failed to complete Google authentication");
        }
      }
    };

    handleGoogleAuth();
  }, []);

  const loginUser = (userData: User, token: string) => {
    setUser(userData);
    setToken(token);
    setAuthHeader(axios);
    setError(null);
  };

  const logoutUser = () => {
    setUser(null);
    removeToken();
    setError(null);
    // Remove auth header
    delete axios.defaults.headers.common["Authorization"];
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    error,
    loginUser,
    logoutUser,
    setError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};