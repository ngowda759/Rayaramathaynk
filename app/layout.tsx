import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import RayaBot from "@/components/chat/RayaBot";
import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: {
    default: "Sri Raghavendra Swamy Temple",
    template: "%s | Sri Raghavendra Swamy Temple",
  },
  description:
    "Official website and Temple Management Portal of Sri Raghavendra Swamy Temple, Yelahanka New Town.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Hide chatbot by default until properly configured */}
        <style>{`
          /* Hide chatbase widget */
          .chatbase-hosted-container,
          #chatbase-hosted-container,
          [class*="chatbase"],
          [id*="chatbase"],
          iframe[src*="chatbase"],
          div[class*="cb"][style*="fixed"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `}</style>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Hide any chatbot elements that load before React
            (function() {
              var hideChatbot = function() {
                // Hide all possible chatbase elements
                var selectors = [
                  '.chatbase-hosted-container',
                  '#chatbase-hosted-container',
                  'div[class*="chatbase"]',
                  'div[id*="chatbase"]',
                  'iframe[src*="chatbase"]',
                  'div[class*="cb-"]',
                  '.cb-widget',
                  '.cb-launcher'
                ];
                selectors.forEach(function(sel) {
                  try {
                    var els = document.querySelectorAll(sel);
                    els.forEach(function(el) {
                      el.style.display = 'none';
                      el.style.visibility = 'hidden';
                    });
                  } catch(e) {}
                });
              };
              
              // Run immediately
              hideChatbot();
              
              // Run again after DOM changes
              if (typeof MutationObserver !== 'undefined') {
                var observer = new MutationObserver(hideChatbot);
                observer.observe(document.body, { childList: true, subtree: true });
              }
              
              // Run on load
              window.addEventListener('load', hideChatbot);
            })();
          `
        }} />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} antialiased bg-stone-50 text-stone-900 min-h-screen`}
      >
        <AuthProvider>
          {children}

          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: "12px",
                background: "#ffffff",
                color: "#1c1917",
                border: "1px solid #e7e5e4",
                boxShadow:
                  "0 10px 25px rgba(0,0,0,0.08)",
              },
              success: {
                iconTheme: {
                  primary: "#16a34a",
                  secondary: "#ffffff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#dc2626",
                  secondary: "#ffffff",
                },
              },
            }}
          />
        </AuthProvider>
        <RayaBot />
      </body>
    </html>
  );
}
