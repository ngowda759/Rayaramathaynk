"use client";

import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

export function useAdminFetch() {
  const { user } = useAuth();

  const adminFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let token = "";
      if (user) {
        try {
          token = await user.getIdToken();
        } catch (error) {
          console.error("Failed to get ID token for adminFetch:", error);
        }
      }

      const headers = new Headers(init?.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return fetch(input, {
        ...init,
        headers,
      });
    },
    [user]
  );

  return adminFetch;
}
