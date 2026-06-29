"use client";

import { FormHTMLAttributes } from "react";
import clsx from "clsx";

interface FormContainerProps
  extends FormHTMLAttributes<HTMLFormElement> {}

export default function FormContainer({
  children,
  className,
  ...props
}: FormContainerProps) {
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
