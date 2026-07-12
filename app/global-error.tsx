"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
          <div className="text-center p-8">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-stone-900 mb-2">Something went wrong</h1>
              <p className="text-stone-600 max-w-md">
                We encountered an error loading this page. Our team has been notified.
              </p>
              {process.env.NODE_ENV === "development" && (
                <details className="mt-4 p-4 bg-stone-200 rounded-lg text-left text-sm">
                  <summary className="font-semibold cursor-pointer">Error Details</summary>
                  <pre className="mt-2 text-red-600 overflow-auto">{error.message}</pre>
                  <pre className="mt-2 text-stone-600 overflow-auto">{error.stack}</pre>
                </details>
              )}
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                <path d="M21 3v5h-5"></path>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                <path d="M8 16H3v5"></path>
              </svg>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
