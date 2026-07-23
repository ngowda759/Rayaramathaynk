"use client";

import { inject } from "@vercel/analytics";

export function VercelAnalytics() {
  inject();
  return null;
}
