/**
 * Canonical Trust Committee content for the Supabase `settings_documents` row.
 *
 * This is the single source of truth for the one-time Trust Committee
 * initialization. It is the Supabase-native equivalent of the legacy
 * `scripts/seed-trust-committee.ts` (which wrote the Firestore
 * `settings/trustCommittee` document): the same 13 committee members, with the
 * `phone`/`address` fields dropped because no reader of the public document uses
 * them (`app/(public)/trust/page.tsx` and the admin page read only the member
 * fields below).
 *
 * It is pure: no Firestore, no `server-only`, no network, no credentials. The
 * initialization orchestration is a small `TrustCommitteeSeedPort` so the same
 * logic runs against the real Supabase admin client and against a test double.
 */

/** The `settings_documents.document_key` this document is stored under. */
export const TRUST_COMMITTEE_DOCUMENT_KEY = "trustCommittee";

/** The exact member count the document must contain. */
export const TRUST_COMMITTEE_MEMBER_COUNT = 13;

/** The fields every member must carry; the current UI reads exactly these. */
export interface TrustCommitteeMember {
  id: string;
  name: string;
  nameKannada: string;
  role: string;
  roleKannada: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
}

/** The document shape stored in `settings_documents.data`. */
export interface TrustCommitteeData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  members: TrustCommitteeMember[];
}

/** The canonical document. */
export const TRUST_COMMITTEE_DATA: TrustCommitteeData = {
  heading: "Trust Committee",
  headingKannada: "ಟ್ರಸ್ಟ್ ಸಮಿತಿ",
  subheading: "Meet the dedicated team behind Sri Raghavendra Swamy Matha",
  subheadingKannada:
    "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದ ಹಿಂದೆ ಇರುವ ಸಮರ್ಪಣೆಯ ತಂಡವನ್ನು ಭೇಟಿಯಾಗಿ",
  members: [
    {
      id: "1",
      name: "Ravikumar N",
      nameKannada: "ರವಿಕುಮಾರ್ ಎನ್",
      role: "Honorary President",
      roleKannada: "ಗೌರವ ಅಧ್ಯಕ್ಷರು",
      imageUrl: "/images/committee/ravikumar-n.png",
      order: 1,
      isActive: true,
    },
    {
      id: "2",
      name: "Rama Vadiraj",
      nameKannada: "ರಮಾ ವಾದಿರಾಜ್",
      role: "Honorary Vice President",
      roleKannada: "ಗೌರವ ಉಪಾಧ್ಯಕ್ಷರು",
      imageUrl: "/images/committee/rama-vadiraj.png",
      order: 2,
      isActive: true,
    },
    {
      id: "3",
      name: "Bheemasenachar S",
      nameKannada: "ಭೀಮಸೇನಾಚಾರ್ ಎಸ್",
      role: "Honorary Secretary",
      roleKannada: "ಗೌರವ ಕಾರ್ಯದರ್ಶಿ",
      imageUrl: "/images/committee/bheemasenachar-s.png",
      order: 3,
      isActive: true,
    },
    {
      id: "4",
      name: "Jayatheerth S C",
      nameKannada: "ಜಯತೀರ್ಥ ಎಸ್.ಸಿ.",
      role: "Honorary Joint Secretary",
      roleKannada: "ಗೌರವ ಸಹ ಕಾರ್ಯದರ್ಶಿ",
      imageUrl: "/images/committee/jayatheerth-sc.png",
      order: 4,
      isActive: true,
    },
    {
      id: "5",
      name: "Mohan N K",
      nameKannada: "ಮೋಹನ್ ಎನ್.ಕೆ.",
      role: "Honorary Treasurer",
      roleKannada: "ಗೌರವ ಖಜಾಂಚಿ",
      imageUrl: "/images/committee/mohan-nk.png",
      order: 5,
      isActive: true,
    },
    {
      id: "6",
      name: "Ravindranath Y K",
      nameKannada: "ರವೀಂದ್ರನಾಥ್ ವೈ.ಕೆ.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/ravindranath-yk.png",
      order: 6,
      isActive: true,
    },
    {
      id: "7",
      name: "Sudheendra G",
      nameKannada: "ಸುಧೀಂದ್ರ ಜಿ",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/sudheendra-g.png",
      order: 7,
      isActive: true,
    },
    {
      id: "8",
      name: "Sanjay H S",
      nameKannada: "ಸಂಜಯ್ ಎಚ್.ಎಸ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/sanjay-hs.png",
      order: 8,
      isActive: true,
    },
    {
      id: "9",
      name: "Raghavendra M N",
      nameKannada: "ರಾಘವೇಂದ್ರ ಎಂ.ಎನ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/raghavendra-mn.png",
      order: 9,
      isActive: true,
    },
    {
      id: "10",
      name: "Narasimha Prasad K R",
      nameKannada: "ನರಸಿಂಹ ಪ್ರಸಾದ್ ಕೆ.ಆರ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/narasimha-prasad-kr.png",
      order: 10,
      isActive: true,
    },
    {
      id: "11",
      name: "Venkataramana H S",
      nameKannada: "ವೆಂಕಟರಮಣ ಎಚ್.ಎಸ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/venkataramana-hs.png",
      order: 11,
      isActive: true,
    },
    {
      id: "12",
      name: "Vidya G P",
      nameKannada: "ವಿದ್ಯಾ ಜಿ.ಪಿ.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯೆ",
      imageUrl: "/images/committee/vidya-gp.png",
      order: 12,
      isActive: true,
    },
    {
      id: "13",
      name: "Veena N A",
      nameKannada: "ವೀಣಾ ಎನ್.ಎ.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯೆ",
      imageUrl: "/images/committee/veena-na.png",
      order: 13,
      isActive: true,
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The member fields compared for equality, in a fixed order. */
const MEMBER_FIELDS = [
  "id",
  "name",
  "nameKannada",
  "role",
  "roleKannada",
  "imageUrl",
  "order",
  "isActive",
] as const;

const DOCUMENT_FIELDS = ["heading", "headingKannada", "subheading", "subheadingKannada"] as const;

/** Count members in an unknown document, or 0 when the shape is not a document. */
export function countMembers(value: unknown): number {
  if (!isRecord(value)) return 0;
  const members = value.members;
  return Array.isArray(members) ? members.length : 0;
}

/** Count active members in an unknown document. */
export function countActiveMembers(value: unknown): number {
  if (!isRecord(value)) return 0;
  const members = value.members;
  if (!Array.isArray(members)) return 0;
  return members.filter((m) => isRecord(m) && m.isActive === true).length;
}

/**
 * True when the stored document already equals the canonical document on every
 * field the UI reads. `updatedAt` and any other extra key is ignored so a stored
 * document the admin saved (which carries `updatedAt`) still matches.
 */
export function matchesCanonicalDocument(existing: unknown): boolean {
  if (!isRecord(existing)) return false;
  for (const field of DOCUMENT_FIELDS) {
    if (existing[field] !== TRUST_COMMITTEE_DATA[field]) return false;
  }
  const members = existing.members;
  if (!Array.isArray(members) || members.length !== TRUST_COMMITTEE_DATA.members.length) {
    return false;
  }
  return TRUST_COMMITTEE_DATA.members.every((expected, index) => {
    const actual = members[index];
    if (!isRecord(actual)) return false;
    return MEMBER_FIELDS.every((field) => actual[field] === expected[field]);
  });
}

/**
 * Classify a stored `settings_documents` row for the Trust Committee key.
 *
 * - `missing`   — no row exists (the reported production state).
 * - `matches`   — a row exists and already equals the canonical document (no-op).
 * - `empty`     — a row exists but carries no members (safe to fill, with --force).
 * - `populated` — a row exists with members that differ from the canonical set;
 *                 never overwritten without an explicit --force.
 */
export type TrustCommitteeDocumentState = "missing" | "matches" | "empty" | "populated";

export function classifyExistingDocument(existing: unknown): TrustCommitteeDocumentState {
  if (existing === null || existing === undefined) return "missing";
  if (matchesCanonicalDocument(existing)) return "matches";
  if (countMembers(existing) === 0) return "empty";
  return "populated";
}

export interface TrustCommitteeInitPlan {
  state: TrustCommitteeDocumentState;
  action: "create" | "replace" | "noop" | "refused";
  /** Why the action was chosen; shown to the operator. */
  reason: string;
}

/**
 * Decide what the initialization should do, without touching a database.
 *
 * - a missing row is created;
 * - a row that already matches is a no-op (idempotent re-run);
 * - an empty or populated row is replaced only when `force` is set, so an
 *   existing (possibly owner-edited) document is never silently overwritten.
 */
export function planTrustCommitteeInitialization(
  existing: unknown,
  options: { force: boolean }
): TrustCommitteeInitPlan {
  const state = classifyExistingDocument(existing);
  switch (state) {
    case "missing":
      return { state, action: "create", reason: "no Trust Committee row exists" };
    case "matches":
      return {
        state,
        action: "noop",
        reason: "the stored document already matches the canonical 13 members",
      };
    case "empty":
      return options.force
        ? { state, action: "replace", reason: "the stored document has no members (--force)" }
        : {
            state,
            action: "refused",
            reason: "the stored document has no members; pass --force to replace it",
          };
    case "populated":
      return options.force
        ? {
            state,
            action: "replace",
            reason: "the stored document has members and --force was passed",
          }
        : {
            state,
            action: "refused",
            reason:
              "the stored document already has members; refusing to overwrite it without --force",
          };
  }
}

/**
 * Validate the canonical document. Returns a list of problems; empty means valid.
 * `imageExists` is injected so a filesystem check can be supplied by the caller
 * (the pure module has no filesystem access).
 */
export function validateTrustCommitteeData(
  data: TrustCommitteeData = TRUST_COMMITTEE_DATA,
  options: { imageExists?: (path: string) => boolean } = {}
): string[] {
  const issues: string[] = [];
  const imageExists = options.imageExists ?? (() => true);

  for (const field of DOCUMENT_FIELDS) {
    if (typeof data[field] !== "string" || data[field].trim() === "") {
      issues.push(`document field "${field}" must be a non-empty string`);
    }
  }

  if (!Array.isArray(data.members)) {
    issues.push("members must be an array");
    return issues;
  }

  if (data.members.length !== TRUST_COMMITTEE_MEMBER_COUNT) {
    issues.push(
      `expected ${TRUST_COMMITTEE_MEMBER_COUNT} members, found ${data.members.length}`
    );
  }

  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();

  data.members.forEach((member, index) => {
    const where = `members[${index}]`;
    for (const field of ["id", "name", "nameKannada", "role", "roleKannada", "imageUrl"] as const) {
      if (typeof member[field] !== "string" || member[field].trim() === "") {
        issues.push(`${where}.${field} must be a non-empty string`);
      }
    }
    if (!Number.isInteger(member.order) || member.order < 1) {
      issues.push(`${where}.order must be a positive integer`);
    }
    if (member.isActive !== true) {
      issues.push(`${where}.isActive must be true`);
    }
    if (seenIds.has(member.id)) issues.push(`${where}.id "${member.id}" is duplicated`);
    seenIds.add(member.id);
    if (seenOrders.has(member.order)) issues.push(`${where}.order ${member.order} is duplicated`);
    seenOrders.add(member.order);

    if (typeof member.imageUrl === "string" && member.imageUrl.startsWith("/") && !imageExists(member.imageUrl)) {
      issues.push(`${where}.imageUrl "${member.imageUrl}" does not exist on disk`);
    }
  });

  for (let order = 1; order <= TRUST_COMMITTEE_MEMBER_COUNT; order += 1) {
    if (!seenOrders.has(order)) issues.push(`no member has order ${order}`);
  }

  return issues;
}

/**
 * The I/O the initialization needs, injected so the orchestration is unit-testable
 * without a database. The real implementation reads/writes `settings_documents`
 * with the Supabase admin client.
 */
export interface TrustCommitteeSeedPort {
  /** The stored `data` for `document_key = trustCommittee`, or `null` when absent. */
  readDocument(): Promise<unknown | null>;
  /** Upsert the canonical document. */
  writeDocument(data: TrustCommitteeData, fieldCount: number): Promise<void>;
}

export interface TrustCommitteeInitResult {
  state: TrustCommitteeDocumentState;
  action: TrustCommitteeInitPlan["action"];
  reason: string;
  wrote: boolean;
  before: { present: boolean; memberCount: number; activeCount: number };
  after: { present: boolean; memberCount: number; activeCount: number };
}

function snapshot(existing: unknown): TrustCommitteeInitResult["before"] {
  return {
    present: existing !== null && existing !== undefined,
    memberCount: countMembers(existing),
    activeCount: countActiveMembers(existing),
  };
}

/**
 * Read the stored document, decide the action, and (only when `execute`) write.
 * `execute: false` performs a dry run: it reads and reports but never writes.
 */
export async function runTrustCommitteeInitialization(
  port: TrustCommitteeSeedPort,
  options: { execute: boolean; force: boolean }
): Promise<TrustCommitteeInitResult> {
  const existing = await port.readDocument();
  const plan = planTrustCommitteeInitialization(existing, { force: options.force });
  const before = snapshot(existing);

  if (plan.action === "refused" || plan.action === "noop" || !options.execute) {
    return {
      state: plan.state,
      action: plan.action,
      reason: plan.reason,
      wrote: false,
      before,
      after: before,
    };
  }

  await port.writeDocument(TRUST_COMMITTEE_DATA, Object.keys(TRUST_COMMITTEE_DATA).length);
  return {
    state: plan.state,
    action: plan.action,
    reason: plan.reason,
    wrote: true,
    before,
    after: snapshot(TRUST_COMMITTEE_DATA),
  };
}
