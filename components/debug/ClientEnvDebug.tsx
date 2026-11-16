"use client";

export default function ClientEnvDebug() {
  const vars = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET",
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "NOT SET",
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
