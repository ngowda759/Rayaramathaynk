"use client";

import { ReactNode, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";

interface GuestOnlyProps {
  children: ReactNode;
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-stone-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export default function GuestOnly({
  children,
}: GuestOnlyProps) {
  const { user, loading } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid synchronous state update during effect
    const timer = setTimeout(() => {
       
      setIsClient(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Show loading while auth is initializing
  if (loading || !isClient) {
    return <LoadingSpinner />;
  }

  // Allow access to everyone - both logged-in users and guests can see the form
  return <>{children}</>;
}
