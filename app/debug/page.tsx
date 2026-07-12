export const dynamic = 'force-dynamic';

export default function DebugPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Info</h1>
      <div className="bg-gray-100 p-4 rounded-lg">
        <p><strong>NEXT_PUBLIC_CHATBOT_ID:</strong> {process.env.NEXT_PUBLIC_CHATBOT_ID || 'NOT SET'}</p>
        <p><strong>NEXT_PUBLIC_CHATBASE_HOST:</strong> {process.env.NEXT_PUBLIC_CHATBASE_HOST || 'NOT SET'}</p>
        <p><strong>NEXT_PUBLIC_CHATBOT_LANGUAGE:</strong> {process.env.NEXT_PUBLIC_CHATBOT_LANGUAGE || 'NOT SET'}</p>
      </div>
    </div>
  );
}
