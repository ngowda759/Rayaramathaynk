"use client";

import { useId, useState, type JSX } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip, type ChipTone } from "@/components/seva/ui/Chip";
import { Button } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { FestivalRequest } from "@/lib/seva/schemas";
import { SETTINGS_TEXT as T } from "@/lib/seva/strings/settings";
import { formatSevaDate } from "@/lib/seva/time";
import { cn } from "@/lib/utils";
import type { FestivalItem } from "@/types/seva-settings";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_HEAD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MAX_DATES = 60;

/** One dated entry of the website's festival calendar (data/calendar.ts). */
export interface CalendarFestival {
  date: string;
  festival: string;
}

export interface FestivalEditorProps {
  festivals: FestivalItem[];
  /** Today's IST business date. */
  today: string;
  /** Temple admins and super admins (settings.edit). */
  editable: boolean;
  /** The website's festival calendar, for "Copy from festival calendar". */
  calendar: readonly CalendarFestival[];
  onSave(festival: FestivalRequest): Promise<void>;
}

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** Groups sorted dates by month: [["2026-11-08","2026-11-09"], ["2026-12-01"]]. */
function byMonth(dates: readonly string[]): string[][] {
  const groups: string[][] = [];
  for (const date of [...dates].sort()) {
    const last = groups[groups.length - 1];
    if (last && last[0].slice(0, 7) === date.slice(0, 7)) last.push(date);
    else groups.push([date]);
  }
  return groups;
}

/** The quick chip in every date picker: "Deepavali 8 / 9 / 10 Nov" (months joined by " / "). */
export function festivalChipLabel(name: string, dates: readonly string[]): string {
  const text = byMonth(dates)
    .map((group) => `${group.map((d) => parts(d).d).join(" / ")} ${MONTHS[parts(group[0]).m - 1]}`)
    .join(" / ");
  return text ? `${name.trim()} ${text}` : name.trim();
}

/** The Dates column: "8, 9, 10 Nov 2026" (months separated by "; "). */
export function festivalDatesText(dates: readonly string[]): string {
  return byMonth(dates)
    .map((group) => {
      const { y, m } = parts(group[0]);
      return `${group.map((d) => parts(d).d).join(", ")} ${MONTHS[m - 1]} ${y}`;
    })
    .join("; ");
}

export type FestivalStatus = "showing" | "past" | "hidden" | "needs_dates";

/** A festival shows as a chip while it is active and its last date has not passed (DB §13.4). */
export function festivalStatus(festival: Pick<FestivalItem, "active" | "dates">, today: string): FestivalStatus {
  if (festival.dates.length === 0) return "needs_dates";
  if (!festival.active) return "hidden";
  return festival.dates.some((d) => d >= today) ? "showing" : "past";
}

const STATUS: Record<FestivalStatus, { text: string; tone: ChipTone }> = {
  showing: { text: T.chipShowing, tone: "ok" },
  past: { text: T.chipPast, tone: "neutral" },
  hidden: { text: T.chipHidden, tone: "neutral" },
  needs_dates: { text: T.chipNeedsDates, tone: "attention" },
};

interface Draft {
  id?: string;
  nameEn: string;
  nameKn: string;
  active: boolean;
  dates: string[];
}

function draftOf(festival: FestivalItem | null): Draft {
  return festival
    ? { id: festival.id, nameEn: festival.nameEn, nameKn: festival.nameKn ?? "", active: festival.active, dates: [...festival.dates].sort() }
    : { nameEn: "", nameKn: "", active: true, dates: [] };
}

/** A month grid; tapping a day picks it or takes it off. */
function MonthPicker({
  month,
  picked,
  today,
  disabled,
  onMonth,
  onToggle,
}: {
  month: string;
  picked: ReadonlySet<string>;
  today: string;
  disabled: boolean;
  onMonth(next: string): void;
  onToggle(date: string): void;
}): JSX.Element {
  const { y, m } = parts(month);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: days }, (_, i) => iso(y, m, i + 1)),
  ];
  const title = `${new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)))} ${y}`;

  return (
    <div className="flex flex-col gap-2" data-testid="festival-calendar">
      <div className="flex items-center justify-between">
        <Button type="button" variant="seva-ghost" size="icon-sm" aria-label={T.prevMonth} onClick={() => onMonth(iso(y, m - 1, 1))}>
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <strong aria-live="polite">{title}</strong>
        <Button type="button" variant="seva-ghost" size="icon-sm" aria-label={T.nextMonth} onClick={() => onMonth(iso(y, m + 1, 1))}>
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEAD.map((d) => (
          <span key={d} aria-hidden="true" className="text-(length:--text-meta) text-(--muted-foreground)">
            {d}
          </span>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <span key={`blank-${i}`} aria-hidden="true" />
          ) : (
            <button
              key={date}
              type="button"
              aria-pressed={picked.has(date)}
              aria-label={formatSevaDate(date)}
              disabled={disabled}
              onClick={() => onToggle(date)}
              className={cn(
                "h-9 rounded-[10px] text-(length:--text-ui) tabular-nums disabled:cursor-not-allowed",
                picked.has(date)
                  ? "bg-(--primary) font-semibold text-(--primary-ink)"
                  : "hover:bg-(--secondary)",
                date === today && !picked.has(date) && "border border-(--border-strong)",
              )}
            >
              {parts(date).d}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Festival days (DB §13.4, mockup `#festival-days`): named festivals with one or more dates, English and Kannada
 * names. They show as quick chips in every date picker (counter and website) until their last date passes. "Copy
 * from festival calendar" offers the dates the website's festival calendar (data/calendar.ts) already knows.
 */
export function FestivalEditor({ festivals, today, editable, calendar, onSave }: FestivalEditorProps): JSX.Element {
  const id = useId();
  const [editing, setEditing] = useState<FestivalItem | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftOf(null));
  const [month, setMonth] = useState(today.slice(0, 8) + "01");
  const [copyOpen, setCopyOpen] = useState(false);
  /** Calendar entries chosen to copy, keyed `${date}|${festival}` so two entries on one date toggle apart. */
  const [copyPicked, setCopyPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const disabled = !editable || busy;
  const picked = new Set(draft.dates);
  const upcoming = calendar.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nameOk = draft.nameEn.trim().length >= 1 && draft.nameEn.trim().length <= 80 && draft.nameKn.trim().length <= 80;
  const copyDates = [...new Set([...copyPicked].map((k) => k.slice(0, k.indexOf("|"))))];
  const datesOk = draft.dates.length >= 1 && draft.dates.length <= MAX_DATES;

  function open(target: FestivalItem | "new"): void {
    const next = draftOf(target === "new" ? null : target);
    setEditing(target);
    setDraft(next);
    setMonth((next.dates.find((d) => d >= today) ?? next.dates[0] ?? today).slice(0, 8) + "01");
    setCopyOpen(false);
    setCopyPicked(new Set());
    setError(null);
    setSavedNote(false);
  }

  function toggleDate(date: string): void {
    setDraft((d) => ({
      ...d,
      dates: d.dates.includes(date) ? d.dates.filter((x) => x !== date) : [...d.dates, date].sort(),
    }));
  }

  function applyCopied(): void {
    setDraft((d) => ({ ...d, dates: [...new Set([...d.dates, ...copyDates])].sort() }));
    setCopyOpen(false);
    setCopyPicked(new Set());
  }

  async function save(): Promise<void> {
    if (disabled) return;
    if (!nameOk) {
      setError(T.festivalNeedsName);
      return;
    }
    if (!datesOk) {
      setError(draft.dates.length === 0 ? T.festivalNeedsDate : T.festivalTooMany);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const request: FestivalRequest = {
        nameEn: draft.nameEn.trim(),
        nameKn: draft.nameKn.trim() === "" ? null : draft.nameKn.trim(),
        active: draft.active,
        dates: draft.dates,
      };
      if (draft.id) request.id = draft.id;
      await onSave(request);
      setEditing(null);
      setSavedNote(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : T.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...festivals].sort((a, b) => {
    const order: Record<FestivalStatus, number> = { showing: 0, needs_dates: 1, hidden: 2, past: 3 };
    const diff = order[festivalStatus(a, today)] - order[festivalStatus(b, today)];
    return diff !== 0 ? diff : (a.dates[0] ?? "9999").localeCompare(b.dates[0] ?? "9999");
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-(length:--text-meta) text-(--muted-foreground)">{editable ? T.festivalsMeta : T.viewOnly}</p>
        {editable ? (
          <Button variant="seva-primary" disabled={busy} onClick={() => open("new")}>
            <Bilingual en={T.addFestival.en} kn={T.addFestival.kn} />
          </Button>
        ) : null}
      </div>
      {savedNote ? (
        <p role="status" className="text-(--ok)">
          {T.festivalSaved}
        </p>
      ) : null}

      <div className={cn("grid grid-cols-1 gap-5", editing && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="overflow-x-auto rounded-(--radius-surface) border border-(--border) bg-(--card)">
            <table className="w-full border-collapse text-(length:--text-ui)" data-testid="festival-table">
              <thead className="border-b border-(--border)">
                <tr>
                  <Bilingual as="th" en={T.colFestival.en} kn={T.colFestival.kn} className="px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground)" />
                  <Bilingual as="th" en={T.colDates.en} kn={T.colDates.kn} className="px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground)" />
                  <Bilingual as="th" en={T.colChip.en} kn={T.colChip.kn} className="px-3 py-2.5 text-left text-(length:--text-meta) font-semibold text-(--muted-foreground)" />
                  <th className="px-3 py-2.5">
                    <span className="sr-only">{T.edit}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-(--muted-foreground)">
                      {T.festivalsEmpty}
                    </td>
                  </tr>
                ) : (
                  sorted.map((f) => {
                    const status = festivalStatus(f, today);
                    return (
                      <tr
                        key={f.id}
                        data-testid={`festival-row-${f.id}`}
                        className={cn(
                          "border-b border-(--border) last:border-b-0",
                          status === "past" && "text-(--muted-foreground)",
                          editing !== null && editing !== "new" && editing.id === f.id && "bg-(--primary-soft)",
                        )}
                      >
                        <td className="px-3 py-3 align-top">
                          <Bilingual en={f.nameEn} kn={f.nameKn} className="font-semibold" />
                        </td>
                        <td className="px-3 py-3 align-top tabular-nums">
                          {f.dates.length === 0 ? <span className="text-(--muted-foreground)">{T.notSetYet}</span> : festivalDatesText(f.dates)}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Chip tone={STATUS[status].tone}>{STATUS[status].text}</Chip>
                        </td>
                        <td className="px-3 py-3 text-right align-top">
                          <Button variant="seva-ghost" size="sm" aria-label={`${editable ? T.edit : T.view} ${f.nameEn}`} onClick={() => open(f)}>
                            {editable ? T.edit : T.view}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.aradhaneSample}</p>
        </div>

        {editing ? (
          <form
            aria-labelledby={`${id}-title`}
            className="flex flex-col gap-4 rounded-(--radius-surface) border border-(--border) bg-(--card) p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`${id}-title`} className="text-(length:--text-h3) font-semibold">
                {editing === "new" ? T.newFestival : T.editFestival(editing.nameEn)}
              </h3>
              {editable ? (
                <Button type="button" variant="seva-ghost" size="sm" aria-expanded={copyOpen} onClick={() => setCopyOpen((o) => !o)}>
                  {T.copyFromCalendar}
                </Button>
              ) : null}
            </div>

            {copyOpen ? (
              <div className="flex flex-col gap-2 rounded-(--radius-control) bg-(--secondary) p-4" data-testid="festival-copy">
                <strong>{T.copyTitle}</strong>
                {upcoming.length === 0 ? (
                  <p className="text-(--muted-foreground)">{T.copyEmpty}</p>
                ) : (
                  <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                    {upcoming.map((c) => {
                      const pickKey = `${c.date}|${c.festival}`;
                      const on = copyPicked.has(pickKey);
                      return (
                        <button
                          key={`${c.date}-${c.festival}`}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setCopyPicked((s) => {
                              const next = new Set(s);
                              if (on) next.delete(pickKey);
                              else next.add(pickKey);
                              return next;
                            })
                          }
                          className={cn(
                            "rounded-full border px-3 py-1 text-(length:--text-meta)",
                            on ? "border-(--primary-press) bg-(--primary) font-semibold text-(--primary-ink)" : "border-(--border-strong) bg-(--card)",
                          )}
                        >
                          {`${c.festival}, ${formatSevaDate(c.date).replace(/ \d{4}$/, "")}`}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Button type="button" variant="seva-secondary" size="sm" className="self-start" disabled={copyDates.length === 0} onClick={applyCopied}>
                  {T.copyUse(copyDates.length)}
                </Button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Bilingual as="label" htmlFor={`${id}-en`} en={T.festivalName.en} kn={T.festivalName.kn} className="text-(length:--text-meta) font-semibold" />
                <input
                  id={`${id}-en`}
                  className={sevaControlClass}
                  value={draft.nameEn}
                  maxLength={80}
                  disabled={disabled}
                  onChange={(e) => setDraft((d) => ({ ...d, nameEn: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Bilingual as="label" htmlFor={`${id}-kn`} en={T.festivalNameKn.en} kn={T.festivalNameKn.kn} className="text-(length:--text-meta) font-semibold" />
                <input
                  id={`${id}-kn`}
                  lang="kn"
                  className={sevaControlClass}
                  value={draft.nameKn}
                  maxLength={80}
                  disabled={disabled}
                  onChange={(e) => setDraft((d) => ({ ...d, nameKn: e.target.value }))}
                />
              </div>
            </div>

            <p className="text-(length:--text-meta) text-(--muted-foreground)">{T.pickDatesHint}</p>
            <MonthPicker month={month} picked={picked} today={today} disabled={disabled} onMonth={setMonth} onToggle={toggleDate} />

            <div className="flex flex-col gap-2">
              <span className="text-(length:--text-meta) font-semibold" data-testid="festival-count">
                {T.datesPicked(draft.dates.length)}
              </span>
              <div className="flex flex-wrap gap-2">
                {draft.dates.map((date) => (
                  <span key={date} className="inline-flex items-center gap-1 rounded-full bg-(--secondary) py-1 pr-1 pl-3 text-(length:--text-meta)">
                    {formatSevaDate(date)}
                    {editable ? (
                      <button
                        type="button"
                        aria-label={T.removeDate(formatSevaDate(date))}
                        disabled={disabled}
                        onClick={() => toggleDate(date)}
                        className="rounded-full p-1 hover:bg-(--card)"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Bilingual en={T.chipPreview.en} kn={T.chipPreview.kn} className="text-(length:--text-meta) font-semibold" />
              <div>
                <span
                  data-testid="festival-chip-preview"
                  className="inline-flex rounded-full border border-(--border-strong) bg-(--card) px-3 py-1 text-(length:--text-meta) font-semibold"
                >
                  {festivalChipLabel(draft.nameEn || T.newFestival, draft.dates)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Bilingual en={T.showAsChip.en} kn={T.showAsChip.kn} className="font-semibold" />
              <Switch
                variant="seva"
                aria-label={T.showAsChip.en}
                checked={draft.active}
                disabled={disabled}
                aria-disabled={disabled}
                onCheckedChange={(next) => setDraft((d) => ({ ...d, active: next }))}
              />
            </div>

            {error ? (
              <p role="alert" className="text-(--destructive)">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {editable ? (
                <Button type="submit" variant="seva-primary" disabled={busy} aria-busy={busy}>
                  {busy ? T.saving : T.save}
                </Button>
              ) : null}
              <Button type="button" variant="seva-ghost" onClick={() => setEditing(null)}>
                {editable ? T.cancel : T.close}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export default FestivalEditor;
