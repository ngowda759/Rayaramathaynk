"use client";

import Link from "next/link";
import { ReactNode } from "react";
import clsx from "clsx";

interface TempleButtonProps {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
}

export default function TempleButton({
  href,
  children,
  variant = "primary",
  className,
}: TempleButtonProps) {
  const styles = clsx(
    "inline-flex items-center justify-center rounded-2xl px-7 py-3.5 text-sm font-semibold transition-all duration-300",
    {
      "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg hover:scale-105 hover:shadow-xl":
        variant === "primary",

      "bg-white text-stone-900 shadow hover:bg-stone-100":
        variant === "secondary",

      "border border-amber-500 text-amber-700 hover:bg-amber-50":
        variant === "outline",
    },
    className
  );

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return <button className={styles}>{children}</button>;
}
