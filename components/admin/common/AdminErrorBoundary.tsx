"use client";

import React from "react";

type State = { hasError: boolean; error?: Error };

export default class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Log to console for debugging; this will also show in Vercel function logs
    console.error("Admin runtime error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8">
          <h2 className="text-2xl font-bold text-red-600">An error occurred</h2>
          <p className="mt-2 text-sm text-stone-600">
            The admin interface encountered an error while loading. Details are
            shown below — please share this with the developer if you need help.
          </p>

          <div className="mt-4 rounded-md border bg-white p-4">
            <pre className="whitespace-pre-wrap text-sm text-stone-800">{String(
              this.state.error?.message || "Unknown error"
            )}

{this.state.error?.stack}</pre>
          </div>

          <div className="mt-4">
            <button
              className="rounded-md bg-amber-600 px-4 py-2 text-white"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
