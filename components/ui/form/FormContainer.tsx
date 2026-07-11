"use client";

import { FormHTMLAttributes } from "react";
import clsx from "clsx";

export default function FormContainer({
  children,
  className,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      className={clsx(
        "space-y-8 max-w-5xl",
        className
      )}
      {...props}
    >
      {children}
    </form>
  );
}
