import React, { useState, ChangeEvent, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../../api/auth";
import { useAuth } from "../../hooks/useAuth";

interface LoginFormData {
  email: string;
  password: string;
}

const LoginForm: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");
  const navigate = useNavigate();
  const { loginUser, setError } = useAuth();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError("");

    try {
      const { user, token } = await login(formData);
      loginUser(user, token);
      navigate("/"); 
    } catch (err: any) {
      console.error("Login error:", err);
      setFormError(err.message || "Failed to login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {formError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md mb-6">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-group">
          <label htmlFor="email" className="block text-foreground mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full bg-input border border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ai-primary focus:border-transparent transition-colors"
            placeholder="your.email@example.com"
          />
        </div>

        <div className="form-group">
          <div className="flex justify-between mb-2">
            <label htmlFor="password" className="text-foreground">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-ai-accent hover:text-ai-primary text-sm transition-colors"
            >
              Forgot Password?
            </Link>
          </div>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full bg-input border border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ai-primary focus:border-transparent transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-ai-primary to-ai-secondary hover:from-ai-primary/90 hover:to-ai-secondary/90 text-white py-3 rounded-md transition-all duration-200 flex items-center justify-center font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-muted-foreground">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="text-ai-accent hover:text-ai-primary transition-colors"
        >
          Register
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;