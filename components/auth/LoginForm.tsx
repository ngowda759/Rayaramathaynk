"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/hooks/useAuth";

import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";

import LoginHeader from "./LoginHeader";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, login } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid synchronous state update during effect
    const timer = setTimeout(() => {
      setIsClient(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // If user is already logged in, redirect to home (middleware will handle admin redirect)
  // Only redirect if Firebase is configured and user is logged in
  useEffect(() => {
    if (!loading && isClient && user) {
      // User is logged in - redirect to home page
      // The middleware will handle protecting /admin routes
      router.replace("/");
    }
  }, [loading, user, isClient, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: LoginFormValues) {
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      // Use setTimeout to defer window.location modification
      setTimeout(() => {
        window.location.href = "/admin";
      }, 0);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      switch (err.code) {
        case "auth/invalid-credential":
          toast.error("Invalid email or password.");
          break;

        case "auth/user-not-found":
          toast.error("No account found.");
          break;

        case "auth/wrong-password":
          toast.error("Incorrect password.");
          break;

        case "auth/too-many-requests":
          toast.error("Too many login attempts.");
          break;

        default:
          toast.error(err.message || "Login failed.");
      }
    }
  }

  // Show loading spinner while checking auth
  if (loading || !isClient) {
    return (
      <Card className="w-full max-w-md rounded-b-3xl shadow-xl shadow-amber-500/10">
        <div className="p-12 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-stone-600 font-medium">Loading...</p>
        </div>
      </Card>
    );
  }

  // Don't show form if user is logged in (will redirect)
  if (user) {
    return (
      <Card className="w-full max-w-md rounded-b-3xl shadow-xl shadow-amber-500/10">
        <div className="p-12 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-stone-600 font-medium">Redirecting...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md rounded-b-3xl shadow-xl shadow-amber-500/10">
      <div className="p-8">
        <LoginHeader />

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

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              error={errors.password?.message}
              {...register("password")}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              className="absolute right-4 top-11 text-stone-500"
            >
              {showPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Remember me
            </label>

            <Link
              href="/forgot-password"
              className="text-orange-600 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            loading={isSubmitting}
          >
            Sign In
          </Button>

          <p className="text-center text-sm text-stone-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-orange-600 hover:underline"
            >
              Register
            </Link>
          </p>
        </form>
      </div>
    </Card>
  );
}
