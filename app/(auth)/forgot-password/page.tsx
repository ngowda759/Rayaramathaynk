import GuestOnly from "@/components/auth/GuestOnly";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <GuestOnly>
      <ForgotPasswordForm />
    </GuestOnly>
  );
}
