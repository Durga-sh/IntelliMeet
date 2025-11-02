"use client";
import { Link } from "react-router-dom";
import RegisterForm from "../components/auth/RegisterForm";


const RegisterPage = () => {
  return (
    <div className="bg-background min-h-[calc(100vh-160px)] flex items-center justify-center px-4 py-12">
      <div className="bg-card rounded-xl shadow-[var(--shadow-card)] border border-border/50 p-8 w-full max-w-md backdrop-blur-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-ai-primary to-ai-secondary bg-clip-text text-transparent">
              IntelliMeet
            </h1>
          </Link>
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>

        <RegisterForm />

        <div className="mt-6 relative flex items-center justify-center">
          <div className="border-t border-border absolute w-full"></div>
          <div className="bg-card px-4 relative z-10 text-muted-foreground text-sm">
            OR
          </div>
        </div>

        <div className="mt-6">

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;