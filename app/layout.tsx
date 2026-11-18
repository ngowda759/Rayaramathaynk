import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "react-hot-toast";
import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";
import { AIChatProvider } from "@/components/ai/AIChatProvider";
import { ChatWidget } from "@/components/ai/ChatWidget";
import { A11yProvider, SkipLink, LiveRegion } from "@/components/common/A11yProvider";
import { ProfileProvider } from "@/context/ProfileContext";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_PREVIEW_IMAGE } from "@/lib/seo";

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
const notoSansKannada = localFont({
  src: [
    {
      path: "../public/fonts/NotoSansKannada-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/NotoSansKannada-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/NotoSansKannada-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/NotoSansKannada-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-kannada",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "Sri Raghavendra Swamy Temple",
    template: "%s | Sri Raghavendra Swamy Temple",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "Sri Raghavendra Swamy Matha – Official Website",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [SOCIAL_PREVIEW_IMAGE],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sri Raghavendra Swamy Matha – Official Website",
    description: SITE_DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE.url],
  },
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
