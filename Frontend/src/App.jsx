// In your App.js file, add this to debug
import React, { useEffect } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext.jsx";
import AppRoutes from "./Routes";

import "./App.css";

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Add this for debugging
  useEffect(() => {
    console.log("Google Client ID:", googleClientId);
  }, [googleClientId]);

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <Router>
          <div className="app">
            <main className="main-content">
              <AppRoutes />
            </main>
          </div>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
