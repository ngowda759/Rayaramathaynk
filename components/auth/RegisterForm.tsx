"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";

const schema = z
  .object({
    name: z
      .string()
      .min(2, "Please enter your full name"),
    email: z.email("Please enter a valid email address"),
    phone: z
      .string()
      .min(8, "Please enter your phone number")
      .max(20, "Please enter a valid phone number"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof schema>;

export default function RegisterForm() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: RegisterFormValues) {
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      toast.success(
        "Account created. Please verify your email and sign in."
      );
      router.push("/login");
    } catch (error: any) {
      switch (error.code) {
        case "auth/email-already-in-use":
          toast.error("This email is already registered.");
          break;
        case "auth/weak-password":
          toast.error("Please choose a stronger password.");
          break;
        default:
          toast.error(error.message || "Registration failed.");
      }
    }
  }

  return (
    <Card className="w-full max-w-md">
      <div className="p-8">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-bold font-heading">
            Create Your Account
          </h2>
          <p className="text-stone-600">
            Register as a devotee to book sevas and manage your temple requests.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-8 space-y-5"
        >
          <Input
            label="Full Name"
            type="text"
            placeholder="Enter your full name"
            error={errors.name?.message}
            {...register("name")}
          />

          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="Phone"
            type="tel"
            placeholder="Enter your phone number"
            error={errors.phone?.message}
            {...register("phone")}
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              error={errors.password?.message}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-11 text-stone-500"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <Input
            label="Confirm Password"
            type={showPassword ? "text" : "password"}
            placeholder="Repeat your password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <Button
            type="submit"
            loading={isSubmitting}
          >
            Register
          </Button>

          <p className="text-center text-sm text-stone-600">
            Already have an account?{' '}
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
