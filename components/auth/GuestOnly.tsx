"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

interface GuestOnlyProps {
  children: ReactNode;
}

export default function GuestOnly({
  children,
}: GuestOnlyProps) {
  const router = useRouter();

  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/admin");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}
