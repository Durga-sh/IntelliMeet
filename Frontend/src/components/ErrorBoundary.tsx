import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-[200px] p-4">
          <div className="text-center">
            <div className="bg-red-900/30 border border-red-500 text-red-200 p-4 rounded-md">
              <h3 className="font-semibold mb-2">Something went wrong</h3>
              <p className="text-sm">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;