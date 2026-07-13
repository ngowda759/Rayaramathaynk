import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";
import { AIChatProvider } from "@/components/ai/AIChatProvider";
import { ChatWidget } from "@/components/ai/ChatWidget";

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
      <body
        className={`${inter.variable} ${playfair.variable} antialiased bg-stone-50 text-stone-900 min-h-screen`}
      >
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-amber-600 focus:px-4 focus:py-2 focus:text-white focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <AIChatProvider>
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
            <ChatWidget />
          </AIChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
