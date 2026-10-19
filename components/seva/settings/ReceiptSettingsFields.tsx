import type { JSX, ReactNode } from "react";

import { Reveal } from "@/components/seva/motion/Reveal";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { sevaControlClass } from "@/components/ui/input";
import type { Bi } from "@/lib/seva/strings/common";
import { SevaClientError } from "@/services/seva/http";

/**
 * Small building blocks shared by the Receipts, Counters and Counter rules settings pages (plan A4-10): a titled card,
 * a bilingual text field and a status line. Every label is English with Kannada under it (C-49).
 */

export function SettingsCard({
  title,
  hint,
  aside,
  children,
  testId,
}: {
  title: Bi;
  hint?: Bi;
  aside?: ReactNode;
  children: ReactNode;
  testId?: string;
}): JSX.Element {
  return (
    <section
      data-testid={testId}
      className="flex min-w-0 flex-col gap-4 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 shadow-(--shadow-card) sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Bilingual as="h3" en={title.en} kn={title.kn} />
          {hint ? <Bilingual as="div" en={hint.en} kn={hint.kn} className="meta" /> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export interface TextFieldProps {
  id: string;
  label: Bi;
  hint?: Bi;
  value: string;
  onChange(value: string): void;
  readOnly?: boolean;
  error?: string | null;
  inputMode?: "text" | "numeric" | "decimal";
  lang?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  className?: string;
}

export function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  readOnly = false,
  error = null,
  inputMode = "text",
  lang,
  placeholder,
  maxLength,
  multiline = false,
  className,
}: TextFieldProps): JSX.Element {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    value,
    readOnly,
    lang,
    placeholder,
    maxLength,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  };
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <Bilingual as="label" htmlFor={id} en={label.en} kn={label.kn} className="text-(length:--text-meta) font-semibold" />
      {hint ? (
        <span id={hintId} className="meta">
          {hint.en}
        </span>
      ) : null}
      {multiline ? (
        <textarea
          {...shared}
          className={`${sevaControlClass} h-auto min-h-[72px] py-3`}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...shared}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          className={`${sevaControlClass} ${inputMode === "text" ? "" : "tabular-nums"}`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error ? (
        <p id={errorId} className="m-0 text-(length:--text-meta) font-semibold text-(--destructive)">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A result line: a status for success (it pops in, plan A4P-4), an alert for a failure (shown at once). */
export function Notice({ kind, text }: { kind: "ok" | "error"; text: Bi | string }): JSX.Element {
  const bi = typeof text === "string" ? { en: text, kn: "" } : text;
  return kind === "ok" ? (
    <SavedLine>
      <div role="status" aria-live="polite" className="text-(length:--text-meta) font-semibold text-(--ok)">
        <Bilingual en={bi.en} kn={bi.kn} />
      </div>
    </SavedLine>
  ) : (
    <div role="alert" className="text-(length:--text-meta) font-semibold text-(--destructive)">
      <Bilingual en={bi.en} kn={bi.kn} />
    </div>
  );
}

/** The short success line after a save: it pops in with the module spring (plan A4P-4). */
export function SavedLine({ children }: { children: ReactNode }): JSX.Element {
  return <Reveal data-testid="saved-line">{children}</Reveal>;
}

/** The API's plain message when there is one, else the page's own fallback. */
export function errorText(err: unknown, fallback: Bi): string {
  return err instanceof SevaClientError ? err.message : fallback.en;
}
