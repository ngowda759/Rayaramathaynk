"use client";

export default function DebugPage() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  
  return (
    <div className="min-h-screen bg-stone-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Debug Info</h1>
      
      <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="font-medium min-w-48">NEXT_PUBLIC_CHATBOT_ID:</span>
            <span className={chatbotId ? "text-green-600" : "text-red-600"}>
              {chatbotId || "NOT SET"}
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
      
      <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Test Chatbase</h2>
        <button
          onClick={() => {
            if (!chatbotId) {
              alert("Chatbot ID not set!");
              return;
            }
            const script = document.createElement("script");
            script.src = "https://www.chatbase.co/embed.min.js";
            script.setAttribute("data-chatbot-id", chatbotId);
            script.defer = true;
            script.async = true;
            document.body.appendChild(script);
            alert("Chatbase script added! Check bottom-right corner.");
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          Manually Load Chatbase
        </button>
      </div>
      
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Browser Console</h2>
        <p className="text-stone-600">
          Press F12 and check the Console tab for chatbase-related messages.
        </p>
      </div>
    </div>
  );
}
