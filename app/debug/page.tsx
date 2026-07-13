"use client";

export default function DebugPage() {
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const aiProvider = process.env.AI_PROVIDER;
  
  return (
    <div className="min-h-screen bg-stone-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Debug Info</h1>
      
      <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="font-medium min-w-48">AI_PROVIDER:</span>
            <span className={aiProvider ? "text-green-600" : "text-red-600"}>
              {aiProvider || "NOT SET"}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="font-medium min-w-48">OPENAI_API_KEY:</span>
            <span className={openaiApiKey ? "text-green-600 truncate" : "text-red-600"}>
              {openaiApiKey ? `${openaiApiKey.substring(0, 20)}...` : "NOT SET"}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="font-medium min-w-48">NEXT_PUBLIC_FIREBASE_API_KEY:</span>
            <span className={firebaseApiKey ? "text-green-600 truncate" : "text-red-600"}>
              {firebaseApiKey ? `${firebaseApiKey.substring(0, 20)}...` : "NOT SET"}
            </span>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Browser Console</h2>
        <p className="text-stone-600">
          Press F12 and check the Console tab for Raya AI related messages.
        </p>
      </div>
    </div>
  );
}
