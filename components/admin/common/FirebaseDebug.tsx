"use client";

import { useEffect, useState } from "react";

export default function FirebaseDebug() {
  const [status, setStatus] = useState<string>("Checking...");
  const [envVars, setEnvVars] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const vars = {
      apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    setEnvVars(vars);

    const allPresent = Object.values(vars).every(Boolean);
    setStatus(allPresent ? "✅ All environment variables are set" : "❌ Missing environment variables");
  }, []);

  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
      <h3 className="font-semibold text-yellow-800 mb-4">🔧 Firebase Debug Info</h3>
      <p className="text-sm text-yellow-700 mb-4">{status}</p>
      <ul className="text-xs space-y-1">
        {Object.entries(envVars).map(([key, present]) => (
          <li key={key} className={present ? "text-green-700" : "text-red-700"}>
            {present ? "✅" : "❌"} {key}
          </li>
        ))}
      </ul>
    </div>
  );
}
