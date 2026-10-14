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
          // Return a synthetic 401 response instead of crashing the client
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: "Failed to retrieve authentication token." })
          } as unknown as Response;
        }
      } else {
        // Return synthetic 401 instead of throwing to prevent unhandled promise rejections on initial mount
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: "No authenticated user found." })
        } as unknown as Response;
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
