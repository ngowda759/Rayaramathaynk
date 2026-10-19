"use client";

import type { JSX } from "react";
import { m } from "framer-motion";

import type { SkeletonVariant } from "@/lib/seva/motion";
import { SHELL } from "@/lib/seva/strings/shell";
import { cn } from "@/lib/utils";

/** One placeholder block on the module tokens, with a soft light sweeping across it (a transform; still under reduced motion). */
function Block({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn("relative overflow-hidden rounded-[12px] bg-(--muted)", className)}>
      <m.span
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-r from-transparent via-(--card)/70 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function Heading(): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <Block className="h-7 w-56 max-w-[70%]" />
      <Block className="h-4 w-80 max-w-[90%]" />
    </div>
  );
}

function DashboardShape(): JSX.Element {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading />
        <Block className="h-11 w-72 max-w-full rounded-[14px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} className="h-24 rounded-[18px]" />
        ))}
      </div>
      <Block className="h-72 rounded-[18px]" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Block className="h-56 rounded-[18px]" />
        <Block className="h-56 rounded-[18px]" />
      </div>
    </>
  );
}

function ListShape(): JSX.Element {
  return (
    <>
      <Heading />
      <div className="flex flex-wrap gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} className="h-11 w-40 rounded-(--radius-control)" />
        ))}
      </div>
      <RowBlocks rows={8} />
    </>
  );
}

function RowBlocks({ rows }: { rows: number }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-[18px] border border-(--border) bg-(--card) p-3">
      {Array.from({ length: rows }, (_, i) => (
        <Block key={i} className="h-11" />
      ))}
    </div>
  );
}

function FormShape(): JSX.Element {
  return (
    <>
      <Heading />
      <div className="flex max-w-2xl flex-col gap-5 rounded-[18px] border border-(--border) bg-(--card) p-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Block className="h-4 w-32" />
            <Block className="h-[46px] rounded-(--radius-control)" />
          </div>
        ))}
        <Block className="h-11 w-40 self-end rounded-(--radius-control)" />
      </div>
    </>
  );
}

function DetailShape(): JSX.Element {
  return (
    <>
      <Heading />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--card) p-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} className={i === 0 ? "h-8 w-2/3" : "h-5"} />
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--card) p-6">
          {[0, 1, 2].map((i) => (
            <Block key={i} className="h-10" />
          ))}
        </div>
      </div>
    </>
  );
}

function CounterShape(): JSX.Element {
  return (
    <>
      <Block className="h-16 rounded-[18px]" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <Block key={i} className="h-9 w-32 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Block key={i} className="h-24 rounded-[16px]" />
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--card) p-5">
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} className="h-6" />
          ))}
          <Block className="mt-2 h-12 rounded-(--radius-control)" />
        </div>
      </div>
    </>
  );
}

const SHAPES: Record<SkeletonVariant, () => JSX.Element> = {
  dashboard: DashboardShape,
  list: ListShape,
  form: FormShape,
  detail: DetailShape,
  counter: CounterShape,
};

export interface PageSkeletonProps {
  variant: SkeletonVariant;
}

/**
 * The outline of a seva screen while it loads (loading.tsx files, and the receipts template while a link is pending):
 * placeholder blocks shaped like the screen, on the module tokens. Announced once as "Loading...".
 */
export function PageSkeleton({ variant }: PageSkeletonProps): JSX.Element {
  const Shape = SHAPES[variant];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={SHELL.loading.en}
      data-page-skeleton={variant}
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6"
    >
      <Shape />
    </div>
  );
}

export interface SkeletonRowsProps {
  /** How many placeholder rows. Default 8. */
  rows?: number;
  /** Accessible name, from the screen's strings. Default "Loading...". */
  label?: string;
  className?: string;
  "data-testid"?: string;
}

/**
 * Only the rows of the list outline (plan A4P-3): for a list whose page is already on screen (heading and filters
 * drawn) while its first rows load. The same blocks as PageSkeleton "list", announced once.
 */
export function SkeletonRows({ rows = 8, label = SHELL.loading.en, className, ...props }: SkeletonRowsProps): JSX.Element {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className} {...props}>
      <RowBlocks rows={rows} />
    </div>
  );
}

export default PageSkeleton;
