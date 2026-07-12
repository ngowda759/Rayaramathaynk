export const dynamic = 'force-dynamic';

export default function DebugPage() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const chatbaseHost = process.env.NEXT_PUBLIC_CHATBASE_HOST || 'https://www.chatbase.co';
  const language = process.env.NEXT_PUBLIC_CHATBOT_LANGUAGE || 'en';
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Chatbot Debug Info</h1>
      <div className="bg-gray-100 p-4 rounded-lg space-y-2">
        <p><strong>NEXT_PUBLIC_CHATBOT_ID:</strong> {chatbotId || 'NOT SET'}</p>
        <p><strong>NEXT_PUBLIC_CHATBASE_HOST:</strong> {chatbaseHost}</p>
        <p><strong>NEXT_PUBLIC_CHATBOT_LANGUAGE:</strong> {language}</p>
      </div>
      
      <h2 className="text-xl font-bold mt-6 mb-4">Chatbase Script</h2>
      <div className="bg-gray-100 p-4 rounded-lg">
        <p>Script URL: <code>{chatbaseHost.replace(/\/$/, '')}/embed.min.js</code></p>
        <p>Data Attribute: <code>data-chatbot-id="{chatbotId}"</code></p>
      </div>
      
      <h2 className="text-xl font-bold mt-6 mb-4">Manual Test</h2>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="mb-4">Click the button below to manually open the Chatbase widget if it's loaded:</p>
        <button 
          onClick={() => {
            if ((window as any).chatbase) {
              (window as any).chatbase('open');
              console.log('Chatbase opened manually');
            } else {
              console.log('Chatbase not loaded yet');
              alert('Chatbase not loaded. Check console for errors.');
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Test Chatbase
        </button>
      </div>
    </div>
  );
}
