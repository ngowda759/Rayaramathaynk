"use client";

export default function ClientEnvDebug() {
  const vars = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "NOT SET",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "NOT SET",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "NOT SET",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "NOT SET",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "NOT SET",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "NOT SET",
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Client-Side Environment Variables Debug</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(vars, null, 2)}
      </pre>
    </div>
  );
}
