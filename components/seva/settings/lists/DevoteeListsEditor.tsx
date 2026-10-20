"use client";

import { useCallback, useId, useMemo, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { m } from "framer-motion";

import { PendingButton } from "@/components/seva/motion/PendingButton";
import { Pressable } from "@/components/seva/motion/Pressable";
import { Reveal } from "@/components/seva/motion/Reveal";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { Chip } from "@/components/seva/ui/Chip";
import { buttonVariants } from "@/components/ui/button";
import { sevaControlClass } from "@/components/ui/input";
import type { ListItemSaveRequest } from "@/lib/seva/schemas";
import { LIST_TABS, LISTS_TEXT as T } from "@/lib/seva/strings/lists";
import { cn } from "@/lib/utils";
import { SevaClientError } from "@/services/seva/http";
import type { SevaListItem, SevaListKind, SevaLists } from "@/types/seva";

import { Notice } from "../ReceiptSettingsFields";
import { ListItemDialog, type ListDialogTarget } from "./ListItemDialog";

const LIST_OF: Record<SevaListKind, keyof SevaLists> = { gotra: "gotras", nakshatra: "nakshatras", rashi: "rashis" };

export interface DevoteeListsEditorProps {
  lists: SevaLists;
  /** settings.edit: add, change and hide. View-only temple admins see the lists with nothing to change. */
  editable: boolean;
  /** Saves one change and answers with the saved item (POST /api/seva/settings/lists). */
  onSave(input: ListItemSaveRequest): Promise<{ kind: SevaListKind; item: SevaListItem }>;
}

/** A Kannada name nobody has saved yet: the temple's proof-reading still has to look at it (O-03). */
function unchecked(item: SevaListItem): boolean {
  return item.nameKn !== null && !item.knChecked;
}

function fold(text: string): string {
  return text.normalize("NFC").trim().toLowerCase();
}

function sorted(items: readonly SevaListItem[]): SevaListItem[] {
  return [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
}

function Tabs({
  kind,
  counts,
  onChange,
  idFor,
}: {
  kind: SevaListKind;
  counts: Record<SevaListKind, number>;
  onChange(kind: SevaListKind): void;
  idFor(kind: SevaListKind, part: "tab" | "panel"): string;
}): JSX.Element {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const indicatorId = `${idFor("gotra", "tab")}-indicator`;

  function move(e: KeyboardEvent<HTMLButtonElement>, i: number): void {
    const n = LIST_TABS.length;
    let to: number | null = null;
    if (e.key === "ArrowRight") to = (i + 1) % n;
    else if (e.key === "ArrowLeft") to = (i - 1 + n) % n;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = n - 1;
    if (to === null) return;
    e.preventDefault();
    refs.current[to]?.focus();
    onChange(LIST_TABS[to].kind);
  }

  return (
    <div role="tablist" aria-label={T.tabsLabel} className="flex flex-wrap gap-1 border-b border-(--border)">
      {LIST_TABS.map((tab, i) => {
        const selected = tab.kind === kind;
        const count = counts[tab.kind];
        return (
          <Pressable
            key={tab.kind}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={idFor(tab.kind, "tab")}
            aria-selected={selected}
            aria-controls={idFor(tab.kind, "panel")}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.kind)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "relative flex items-start gap-2 px-4 py-2.5 text-left text-(length:--text-ui) font-semibold",
              selected ? "text-(--foreground)" : "text-(--muted-foreground) hover:text-(--foreground)",
            )}
          >
            <Bilingual en={tab.label.en} kn={tab.label.kn} />
            {count > 0 ? (
              <span
                className="num mt-0.5 inline-flex min-w-6 justify-center rounded-full bg-(--attn-soft) px-2 py-0.5 text-(length:--text-micro) text-(--accent-foreground)"
                title={T.uncheckedCount(count)}
              >
                <span data-testid={`unchecked-count-${tab.kind}`} aria-hidden="true">
                  {count}
                </span>
                <span className="sr-only">{T.uncheckedCount(count)}</span>
              </span>
            ) : (
              <span data-testid={`unchecked-count-${tab.kind}`} hidden>
                0
              </span>
            )}
            {selected ? (
              <m.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-(--primary-press)"
              />
            ) : null}
          </Pressable>
        );
      })}
    </div>
  );
}

function Row({
  kind,
  item,
  editable,
  onEdit,
  onToggle,
}: {
  kind: SevaListKind;
  item: SevaListItem;
  editable: boolean;
  onEdit(item: SevaListItem): void;
  onToggle(item: SevaListItem): Promise<void>;
}): JSX.Element {
  const isGotra = kind === "gotra";
  return (
    <tr className={cn("border-t border-(--border) align-top", !item.active && "text-(--muted-foreground)")}>
      <td className="num px-3 py-3 text-(length:--text-meta)">{item.id}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <Bilingual en={item.nameEn} kn={item.nameKn} className="font-semibold" />
          {unchecked(item) ? (
            <Chip tone="attention">
              <Bilingual en={T.uncheckedBadge.en} kn={T.uncheckedBadge.kn} />
            </Chip>
          ) : null}
        </div>
      </td>
      {isGotra ? <td className="px-3 py-3">{item.active ? null : <Chip tone="neutral">{T.hiddenChip}</Chip>}</td> : null}
      {editable ? (
        <td className="px-3 py-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Pressable
              className={buttonVariants({ variant: "seva-secondary", size: "sm" })}
              aria-label={isGotra ? T.editLabel(item.nameEn) : T.editKannadaLabel(item.nameEn)}
              onClick={() => onEdit(item)}
            >
              {isGotra ? T.edit : T.editKannada}
            </Pressable>
            {isGotra ? (
              <PendingButton
                variant="seva-ghost"
                size="sm"
                aria-label={item.active ? T.hideLabel(item.nameEn) : T.showLabel(item.nameEn)}
                pendingLabel={item.active ? T.hiding : T.showing}
                action={() => onToggle(item)}
              >
                {item.active ? T.hide : T.show}
              </PendingButton>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/**
 * Settings - Devotee lists (plan A4P-5; owner's card `lists`, 2026-10-19): tabs Gotra / Nakshatra / Rashi, each with
 * a count of Kannada names not yet checked. Gotras: search, Add, Edit and Hide/Show (never delete - receipts keep
 * gotra_id). Nakshatras and rashis: the Kannada spelling only. Each Kannada name carries a "Not yet checked" mark until
 * an admin saves it (O-03). The counter offers what is saved here the next time its page opens.
 */
export function DevoteeListsEditor({ lists: initial, editable, onSave }: DevoteeListsEditorProps): JSX.Element {
  const baseId = useId();
  const idFor = useCallback((kind: SevaListKind, part: "tab" | "panel") => `${baseId}-${part}-${kind}`, [baseId]);
  const [lists, setLists] = useState<SevaLists>(initial);
  const [kind, setKind] = useState<SevaListKind>("gotra");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; target: ListDialogTarget | null }>({ open: false, target: null });
  const [notice, setNotice] = useState<{ id: number; kind: "ok" | "error"; text: string } | null>(null);
  const noticeSeq = useRef(0);

  const counts = useMemo(
    () => ({
      gotra: lists.gotras.filter(unchecked).length,
      nakshatra: lists.nakshatras.filter(unchecked).length,
      rashi: lists.rashis.filter(unchecked).length,
    }),
    [lists],
  );

  const items = useMemo(() => {
    const all = sorted(lists[LIST_OF[kind]]);
    const q = fold(query);
    if (kind !== "gotra" || q === "") return all;
    return all.filter((item) => fold(item.nameEn).includes(q) || fold(item.nameKn ?? "").includes(q));
  }, [lists, kind, query]);

  const say = useCallback((kindOfNotice: "ok" | "error", text: string) => {
    noticeSeq.current += 1;
    setNotice({ id: noticeSeq.current, kind: kindOfNotice, text });
  }, []);

  /** Saves one change and puts the saved item into the page's copy of the list. Throws so the caller can show why. */
  const save = useCallback(
    async (input: ListItemSaveRequest): Promise<SevaListItem> => {
      const saved = await onSave(input);
      const key = LIST_OF[saved.kind];
      setLists((current) => {
        const list = current[key];
        const at = list.findIndex((i) => i.id === saved.item.id);
        const next = at === -1 ? [...list, saved.item] : list.map((i, n) => (n === at ? saved.item : i));
        return { ...current, [key]: next };
      });
      return saved.item;
    },
    [onSave],
  );

  const saveFromDialog = useCallback(
    async (input: ListItemSaveRequest): Promise<void> => {
      const item = await save(input);
      say("ok", input.kind === "gotra" && input.id === undefined ? T.added(item.nameEn) : T.saved(item.nameEn));
    },
    [save, say],
  );

  const toggle = useCallback(
    async (item: SevaListItem): Promise<void> => {
      try {
        const saved = await save({ kind: "gotra", id: item.id, active: !item.active });
        say("ok", saved.active ? T.shown(saved.nameEn) : T.hidden(saved.nameEn));
      } catch (err) {
        say("error", err instanceof SevaClientError ? err.message : T.saveFailed.en);
      }
    },
    [save, say],
  );

  const otherGotraNames = useCallback(
    (exceptId: number | null) => new Set(lists.gotras.filter((g) => g.id !== exceptId).map((g) => fold(g.nameEn))),
    [lists.gotras],
  );

  const tab = LIST_TABS.find((t) => t.kind === kind) ?? LIST_TABS[0];
  const searchId = `${baseId}-search`;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Bilingual as="h2" en={T.title.en} kn={T.title.kn} className="text-(length:--text-h2) font-semibold" />
        <p className="m-0 text-(length:--text-meta) text-(--muted-foreground)">{T.intro}</p>
        {editable ? null : (
          <p role="note" className="m-0 text-(length:--text-meta) font-semibold">
            {T.viewOnly}
          </p>
        )}
      </div>

      <Tabs
        kind={kind}
        counts={counts}
        idFor={idFor}
        onChange={(next) => {
          setKind(next);
          setNotice(null);
        }}
      />

      <div
        role="tabpanel"
        id={idFor(kind, "panel")}
        aria-labelledby={idFor(kind, "tab")}
        className="flex min-w-0 flex-col gap-4 rounded-(--radius-surface) border border-(--border) bg-(--card) p-4 shadow-(--shadow-card) sm:p-5"
      >
        <div className="flex flex-col gap-1">
          <p className="m-0 text-(length:--text-meta)">{kind === "gotra" ? T.gotraNote : T.fixedNote}</p>
          {editable && counts[kind] > 0 ? <p className="meta m-0">{T.checkHint}</p> : null}
        </div>

        {kind === "gotra" ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[22rem]">
              <label htmlFor={searchId} className="text-(length:--text-meta) font-semibold">
                {T.search(tab.label.en)}
              </label>
              <input
                id={searchId}
                type="search"
                className={sevaControlClass}
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {editable ? (
              <Pressable
                className={buttonVariants({ variant: "seva-primary" })}
                onClick={() => setDialog({ open: true, target: { mode: "add" } })}
              >
                <Bilingual en={T.addGotra.en} kn={T.addGotra.kn} />
              </Pressable>
            ) : null}
          </div>
        ) : null}

        {notice ? (
          <Reveal key={notice.id}>
            <Notice kind={notice.kind} text={notice.text} />
          </Reveal>
        ) : null}

        <Reveal key={kind} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-(length:--text-ui)">
            <caption className="sr-only">{tab.label.en}</caption>
            <thead>
              <tr className="text-(length:--text-meta) text-(--muted-foreground)">
                <th scope="col" className="px-3 py-2 font-semibold">
                  <Bilingual en={T.colId.en} kn={T.colId.kn} />
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  <Bilingual en={T.colName.en} kn={T.colName.kn} />
                </th>
                {kind === "gotra" ? (
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <Bilingual en={T.colStatus.en} kn={T.colStatus.kn} />
                  </th>
                ) : null}
                {editable ? (
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">{T.edit}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Row
                  key={item.id}
                  kind={kind}
                  item={item}
                  editable={editable}
                  onEdit={(target) => setDialog({ open: true, target: { mode: "edit", kind, item: target } })}
                  onToggle={toggle}
                />
              ))}
            </tbody>
          </table>
          {items.length === 0 ? <p className="meta m-0 p-3">{T.noMatch}</p> : null}
        </Reveal>
      </div>

      <ListItemDialog
        open={dialog.open}
        target={dialog.target}
        otherGotraNames={otherGotraNames}
        onSave={saveFromDialog}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />
    </section>
  );
}

export default DevoteeListsEditor;
