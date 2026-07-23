import type { Metadata } from "next";
import { Inter, Playfair_Display, Noto_Sans_Kannada } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";
import { AIChatProvider } from "@/components/ai/AIChatProvider";
import { ChatWidget } from "@/components/ai/ChatWidget";
import { A11yProvider, SkipLink, LiveRegion } from "@/components/common/A11yProvider";
import { ProfileProvider } from "@/context/ProfileContext";

// Primary fonts - Inter for general use, Kannada will be handled via CSS font-stack
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

// Dedicated Kannada font for proper rendering
const notoSansKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kannada",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sri Raghavendra Swamy Temple",
    template: "%s | Sri Raghavendra Swamy Temple",
  },
  description:
    "Official website and Temple Management Portal of Sri Raghavendra Swamy Temple, Yelahanka New Town.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/images/logos/ynk_matha_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} ${notoSansKannada.variable} antialiased bg-stone-50 text-stone-900 min-h-screen`}
      >
        <A11yProvider>
          <SkipLink targetId="main-content" />
          <LiveRegion />
          <AuthProvider>
            <ProfileProvider>
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
            </ProfileProvider>
          </AuthProvider>
        </A11yProvider>
      </body>
    </html>
  );
}
