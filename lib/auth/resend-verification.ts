import { createClient } from "@/lib/supabase/client";

export async function resendVerification(user: { email?: string | null }): Promise<void> {
  if (!user.email) {
    throw new Error("No email address to verify");
  }
  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });
  if (error) {
    throw error;
  }
}
