import React from "react";
import clsx from "clsx";

interface BaseProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: BaseProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-stone-200 bg-white shadow-lg",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: BaseProps) {
  return (
    <div className={clsx("border-b border-stone-200 p-6", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: BaseProps) {
  return (
    <h2 className={clsx("text-xl font-semibold text-stone-900", className)}>
      {children}
    </h2>
  );
}

export function CardDescription({ children, className }: BaseProps) {
  return (
    <p className={clsx("mt-2 text-sm text-stone-500", className)}>
      {children}
    </p>
  );
}

export function CardContent({ children, className }: BaseProps) {
  return <div className={clsx("p-6", className)}>{children}</div>;
}

export function CardFooter({ children, className }: BaseProps) {
  return (
    <div
      className={clsx(
        "flex justify-end border-t border-stone-200 p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export default Card;
