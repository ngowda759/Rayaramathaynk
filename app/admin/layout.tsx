import { ReactNode } from "react";
import AdminShell from "@/components/admin/layout/AdminShell";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";
import { GoUpButton } from "@/components/ui/GoUpButton";

const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
const chatbaseHost = process.env.NEXT_PUBLIC_CHATBASE_HOST || "https://www.chatbase.co";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  const cleanChatbaseHost = chatbaseHost?.replace(/\/$/, '') || 'https://www.chatbase.co';
  
  return (
    <AdminAuthGuard>
      <AdminShell>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        
        {/* Chatbase configuration for admin */}
        {chatbotId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.chatbaseConfig = {
                  chatbotId: "${chatbotId}",
                };
              `,
            }}
          />
        )}
        
        {/* Chatbase Widget Script for admin */}
        {chatbotId && (
          <script
            src={`${cleanChatbaseHost}/embed.min.js`}
            data-chatbot-id={chatbotId}
            strategy="lazyOnload"
          />
        )}
        
        <GoUpButton />
      </AdminShell>
    </AdminAuthGuard>
  );
}
