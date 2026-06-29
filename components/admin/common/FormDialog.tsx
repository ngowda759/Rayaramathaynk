"use client";

import { ReactNode } from "react";

interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function FormDialog({
  open,
  title,
  onClose,
  children,
}: FormDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-semibold">{title}</h2>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 hover:bg-muted"
          >
            ✕
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
