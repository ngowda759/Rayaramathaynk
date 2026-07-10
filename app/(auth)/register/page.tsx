import GuestOnly from "@/components/auth/GuestOnly";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <GuestOnly>
      <RegisterForm />
    </GuestOnly>
  );
}
