"use client";

import { useEffect, useState, type JSX } from "react";
import type { User } from "firebase/auth";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { resendVerification } from "@/lib/auth";
import { SHELL } from "@/lib/seva/strings/shell";

/** After a send the button rests this long, so nobody fires a stream of emails (Firebase also limits them). */
export const VERIFY_RESEND_COOLDOWN_MS = 60_000;

export interface VerifyEmailNoticeProps {
  /** The signed-in Firebase user whose email is not verified. */
  user: User;
}

/**
 * On the /seva no-access screen, for a signed-in person whose email is not verified: only a verified website account
 * can be linked as staff (onboarding answers `unverified_account`), so this sends the website's own verification email
 * again (lib/auth.ts resendVerification). After a send the button says what to do next and rests for a minute; a
 * failure shows a fixed message, never the provider's error text.
 */
export function VerifyEmailNotice({ user }: VerifyEmailNoticeProps): JSX.Element {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), VERIFY_RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [sent]);

  async function send(): Promise<void> {
    if (sending || sent) return;
    setSending(true);
    setFailed(false);
    try {
      await resendVerification(user);
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  const label = sent ? SHELL.verifySent : SHELL.verifySend;
  return (
    <div className="mt-2 flex w-full flex-col items-center gap-3 rounded-(--radius-control) bg-(--attn-soft) p-4">
      <Bilingual as="div" en={SHELL.verifyNotice.en} kn={SHELL.verifyNotice.kn} className="text-(--foreground)" />
      <PendingButton
        variant="seva-secondary"
        className="h-auto whitespace-normal py-2"
        pending={sending}
        pendingLabel={SHELL.verifySending.en}
        disabled={sent}
        onClick={() => void send()}
      >
        <Bilingual en={label.en} kn={label.kn} />
      </PendingButton>
      {failed ? (
        <p role="alert" className="text-(--destructive)">
          <Bilingual en={SHELL.verifyFailed.en} kn={SHELL.verifyFailed.kn} />
        </p>
      ) : null}
    </div>
  );
}

export default VerifyEmailNotice;
