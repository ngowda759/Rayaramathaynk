"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";

const schema = z.object({
  email: z.email("Please enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof schema>;

export default function ForgotPasswordForm() {
  const router = useRouter();
  const { forgotPassword } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: ForgotPasswordValues) {
    try {
      await forgotPassword(data.email);
      toast.success(
        "If this email is registered, a password reset link has been sent."
      );
      router.push("/login");
    } catch (error: any) {
      toast.error(error.message || "Unable to send reset email.");
    }
  }

  return (
    <Card className="w-full max-w-md">
      <div className="p-8">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-bold font-heading">
            Reset Your Password
          </h2>
          <p className="text-stone-600">
            Enter the email address associated with your account.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-8 space-y-5"
        >
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Button
            type="submit"
            loading={isSubmitting}
          >
            Send reset link
          </Button>

          <p className="text-center text-sm text-stone-600">
            Remembered your password?{' '}
            <Link
              href="/login"
              className="font-medium text-orange-600 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </Card>
  );
}
