"use client";

import { ReactNode, Component, ReactElement } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactElement;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Error Boundary component to catch Firebase and other errors
export default class AdminPageWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Admin page error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            Something went wrong
          </h2>
          <p className="text-red-600 mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
