import React, { useState, ChangeEvent, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, verifyOTP, resendOTP } from "../../api/auth";
import { useAuth } from "../../hooks/useAuth";

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}

interface OTPFormData {
  otp: string;
  tempUserId: string;
}

const RegisterForm: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "user",
  });
  const [otpData, setOtpData] = useState<OTPFormData>({
    otp: "",
    tempUserId: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleOTPChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6); // Only digits, max 6
    setOtpData({
      ...otpData,
      otp: value,
    });
  };

  const validateForm = (): boolean => {
    if (formData.password !== formData.confirmPassword) {
      setFormError("Passwords do not match");
      return false;
    }

    if (formData.password.length < 6) {
      setFormError("Password must be at least 6 characters long");
      return false;
    }

    return true;
  };

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setFormError("");
    setSuccessMessage("");

    const userData = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    };

    console.log("Sending registration data:", userData);

    try {
      const response = await register(userData);
      console.log("Registration response:", response);

      if (response.success && response.tempUserId) {
        setOtpData({
          ...otpData,
          tempUserId: response.tempUserId,
        });
        setStep(2);
        setSuccessMessage("OTP sent to your email! Please check your inbox.");
        startCountdown();
      } else {
        setFormError("Invalid response from server");
      }
    } catch (err: any) {
      console.error("Registration error details:", err);
      setFormError(err.message || "Failed to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (otpData.otp.length !== 6) {
      setFormError("Please enter a valid 6-digit OTP");
      return;
    }

    setIsLoading(true);
    setFormError("");

    try {
      const response = await verifyOTP({
        tempUserId: otpData.tempUserId,
        otp: otpData.otp,
      });

      console.log("OTP verification response:", response);

      if (response.success && response.user && response.token) {
        loginUser(response.user, response.token);
        navigate("/");
      } else {
        setFormError("Invalid response from server");
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setFormError(err.message || "Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    setFormError("");
    setSuccessMessage("");

    try {
      const response = await resendOTP(otpData.tempUserId);

      if (response.success) {
        setSuccessMessage("New OTP sent to your email!");
        startCountdown();
      }
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      setFormError(err.message || "Failed to resend OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-ai-primary to-ai-secondary bg-clip-text text-transparent mb-6 text-center">
          Verify Your Email
        </h2>
        <p className="text-muted-foreground text-center mb-6">
          We've sent a 6-digit OTP to <strong className="text-foreground">{formData.email}</strong>
        </p>

        {formError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md mb-6">
            {formError}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-md mb-6">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleOTPSubmit} className="space-y-6">
          <div className="form-group">
            <label
              htmlFor="otp"
              className="block text-foreground mb-2 text-center"
            >
              Enter OTP
            </label>
            <input
              type="text"
              id="otp"
              name="otp"
              value={otpData.otp}
              onChange={handleOTPChange}
              required
              maxLength={6}
              className="w-full bg-input border border-border rounded-md px-4 py-3 text-foreground text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ai-primary focus:border-transparent transition-colors"
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-ai-primary to-ai-secondary hover:from-ai-primary/90 hover:to-ai-secondary/90 text-white py-3 rounded-md transition-all duration-200 flex items-center justify-center font-medium"
            disabled={isLoading || otpData.otp.length !== 6}
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
                Verifying...
              </>
            ) : (
              "Verify OTP"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-muted-foreground mb-2">Didn't receive the OTP?</p>
          <button
            onClick={handleResendOTP}
            disabled={countdown > 0 || isLoading}
            className={`text-purple-400 hover:text-purple-300 transition-colors ${
              countdown > 0 || isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => setStep(1)}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            ← Back to registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {formError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md mb-6">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-group">
          <label htmlFor="name" className="block text-foreground mb-2">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full bg-input border border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ai-primary focus:border-transparent transition-colors"
            placeholder="John Doe"
          />
        </div>

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
          <label htmlFor="password" className="block text-foreground mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            className="w-full bg-input border border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ai-primary focus:border-transparent transition-colors"
            placeholder="••••••••"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword" className="block text-foreground mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className="w-full bg-input border border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ai-primary focus:border-transparent transition-colors"
            placeholder="••••••••"
          />
        </div>

        <div className="form-group">
          <label htmlFor="role" className="block text-foreground mb-2">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full bg-input border border-border rounded-md px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ai-primary focus:border-transparent transition-colors"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="organizer">Organizer</option>
          </select>
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
              Sending OTP...
            </>
          ) : (
            "Send OTP"
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-ai-accent hover:text-ai-primary transition-colors"
        >
          Login
        </Link>
      </div>
    </div>
  );
};

export default RegisterForm;