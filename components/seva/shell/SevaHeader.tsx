"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { SevaLink } from "@/components/seva/motion/SevaLink";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import type { SevaNavColumn } from "@/components/admin/layout/navigation";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import { SEVA_ROUTES, signInPath } from "@/lib/seva/routes";
import type { Bi } from "@/lib/seva/strings/common";
import { SHELL_FRAME, SHELL_NAV } from "@/lib/seva/strings/shell";
import { STAFF_ROLE_LABEL, staffNoText } from "@/lib/seva/strings/staff";
import { cn } from "@/lib/utils";

import { frameColumn, WEBSITE_ADMIN_COLUMNS, type SevaSection } from "./sections";

export interface SevaHeaderProps {
  /** `desk`: the module header on the card colour; `focus`: the counter's maroon header. */
  variant: "desk" | "focus";
  /** The person's sections; a person with exactly one gets a link to it in the desk header. */
  sections: SevaSection[];
}

const COUNTER_LINK_COLUMNS: readonly SevaNavColumn[] = ["R", "TA", "SA"];
/**
 * Who gets "Seva Entry menu" in the counter header: everyone with sections beyond the counter - temple admins,
 * view-only ones too, and super admins - so the full-screen counter never traps them (owner's check 2026-10-20). A
 * receptionist's Seva Entry is the counter, so they get no such link.
 */
const BACK_TO_DESK_COLUMNS: readonly SevaNavColumn[] = ["TA", "TV", "SA"];

const PILL =
  "inline-flex min-h-11 items-center justify-center rounded-(--radius-pill) border px-3 py-1.5 text-center text-(length:--text-meta) leading-tight font-semibold whitespace-nowrap no-underline";

function pillClass(variant: SevaHeaderProps["variant"], emphasis = false): string {
  if (variant === "focus") {
    return cn(PILL, "border-white/55 bg-transparent text-white hover:bg-white/10");
  }
  return cn(
    PILL,
    emphasis
      ? "border-(--primary-press) bg-(--primary-soft) text-(--foreground)"
      : "border-(--border-strong) bg-(--secondary) text-(--foreground)",
  );
}

interface HeaderLink {
  key: string;
  href: string;
  label: Bi;
  /** Leaves the module (plain next/link) instead of a seva navigation. */
  leaves?: boolean;
  emphasis?: boolean;
}

function HeaderLinkView({ link, variant }: { link: HeaderLink; variant: SevaHeaderProps["variant"] }): JSX.Element {
  const content: ReactNode = <Bilingual en={link.label.en} kn={link.label.kn} />;
  const className = pillClass(variant, link.emphasis);
  return link.leaves ? (
    <Link href={link.href} className={className}>
      {content}
    </Link>
  ) : (
    <SevaLink href={link.href} className={className}>
      {content}
    </SevaLink>
  );
}

function headerLinks(variant: SevaHeaderProps["variant"], column: SevaNavColumn | null, sections: SevaSection[]): HeaderLink[] {
  if (column === null) return [];
  if (variant === "focus") {
    const links: HeaderLink[] = [];
    if (COUNTER_LINK_COLUMNS.includes(column)) {
      links.push({ key: "today", href: SEVA_ROUTES.today, label: SHELL_NAV.todayReceipts });
      links.push({ key: "dayClose", href: SEVA_ROUTES.dayClose, label: SHELL_NAV.closeDay });
    }
    if (BACK_TO_DESK_COLUMNS.includes(column)) {
      links.push({ key: "desk", href: SEVA_ROUTES.dashboard, label: SHELL_NAV.sevaEntryMenu, emphasis: true });
    }
    return links;
  }
  const links: HeaderLink[] = [];
  if (sections.length === 1) {
    const only = sections[0];
    links.push({ key: only.id, href: only.href, label: only.label, leaves: only.leavesModule === true });
  }
  if (WEBSITE_ADMIN_COLUMNS.includes(column)) {
    links.push({ key: "websiteAdmin", href: SEVA_ROUTES.websiteAdmin, label: SHELL_FRAME.websiteAdmin, leaves: true, emphasis: true });
  }
  return links;
}

/**
 * Seva Entry's own header (plan A4S-2): the temple's logo and name, who is signed in, the few links the person needs
 * and Sign out, which is always there - while the profile loads, after it fails, and for a person with no seva role.
 * The desk header sits on the card colour; the counter's is maroon with white text. Hidden when printing.
 */
export function SevaHeader({ variant, sections }: SevaHeaderProps): JSX.Element {
  const router = useRouter();
  const { logout, sevaRole } = useAuth();
  const { me } = useSevaMe();
  const column = frameColumn(me, sevaRole);
  const focus = variant === "focus";
  const links = headerLinks(variant, column, sections);

  const subtitle = focus
    ? {
        en: me?.counter ? `${SHELL_FRAME.counterTitle.en} · ${me.counter.name}` : SHELL_FRAME.counterTitle.en,
        kn: SHELL_FRAME.counterTitle.kn,
      }
    : SHELL_NAV.sevaEntry;

  return (
    <header
      data-seva-header=""
      data-variant={variant}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 print:hidden",
        focus
          ? "bg-(--maroon) text-white [&_.kn]:text-white/80"
          : "border-b border-(--border) bg-(--card) text-(--foreground)",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Image
          src="/images/logos/ynk_matha_logo.png"
          alt=""
          width={34}
          height={34}
          className="size-[34px] shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 leading-tight">
          <p className="font-bold">{SHELL_FRAME.templeName.en}</p>
          <p
            className={cn(
              "text-(length:--text-micro) font-semibold tracking-wide uppercase",
              focus ? "text-(--gold-light)" : "text-(--primary-strong)",
            )}
          >
            {subtitle.en}
            <span className="kn inline normal-case" lang="kn">
              {" · "}
              {subtitle.kn}
            </span>
          </p>
        </div>
      </div>

      <div className="flex-1" />

      {me ? (
        <div className="text-right text-(length:--text-meta) leading-tight">
          <p className="font-bold">
            {me.name} · {staffNoText(me.staffNo)}
          </p>
          <Bilingual en={STAFF_ROLE_LABEL[me.role].en} kn={STAFF_ROLE_LABEL[me.role].kn} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <HeaderLinkView key={link.key} link={link} variant={variant} />
        ))}
        <PendingButton
          variant="seva-ghost"
          pendingLabel={<Bilingual en={SHELL_FRAME.signingOut.en} kn={SHELL_FRAME.signingOut.kn} />}
          action={async () => {
            await logout();
            router.replace(signInPath(SEVA_ROUTES.dashboard));
          }}
          className={cn(
            PILL,
            "h-auto",
            focus
              ? "border-white bg-transparent text-white hover:bg-white/10"
              : "border-(--maroon) bg-(--card) text-(--maroon) hover:bg-(--secondary)",
          )}
        >
          <Bilingual en={SHELL_FRAME.signOut.en} kn={SHELL_FRAME.signOut.kn} />
        </PendingButton>
      </div>
    </header>
  );
}

export default SevaHeader;
