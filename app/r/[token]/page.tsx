import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { JSX } from "react";

import { PrasadamShortcut } from "@/components/seva/receipt/PrasadamShortcut";
import { PublicReceiptView } from "@/components/seva/receipt/PublicReceiptView";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { getPublicReceiptByToken } from "@/lib/seva/server/public-receipt";
import { rateLimit } from "@/lib/seva/server/rate-limit";
import { RECEIPT } from "@/lib/seva/strings/receipt";

/**
 * `/r/<token>` - the page a phone camera opens from the slip's QR (DB §10.3, C-50). No sign-in: it shows the slip's
 * own details, Valid or Cancelled, and whether prasadam was given; never the phone. 30 requests a minute per IP (DB
 * §15.1; best effort, per server instance). An unknown token is a 404 with "This receipt was not found." (not-found.tsx).
 * A signed-in person who may give prasadam also sees "Open in the prasadam counter" (a client island).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seva receipt",
  robots: { index: false, follow: false },
};

const PER_IP = { limit: 30, windowMs: 60_000 };

/** The caller's IP as the proxy reports it (first x-forwarded-for entry); best effort. */
function clientIp(h: { get(name: string): string | null }): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

export default async function PublicReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<JSX.Element> {
  const { token } = await params;
  const value = token.trim();

  if (!rateLimit(`r:${clientIp(await headers())}`, PER_IP)) {
    return (
      <div role="alert" className="mx-auto max-w-md text-center">
        <Bilingual as="div" en={RECEIPT.tooMany.en} kn={RECEIPT.tooMany.kn} />
      </div>
    );
  }

  const receipt = await getPublicReceiptByToken(value);
  if (!receipt) notFound();

  return (
    <PublicReceiptView receipt={receipt}>
      <PrasadamShortcut token={value} />
    </PublicReceiptView>
  );
}
