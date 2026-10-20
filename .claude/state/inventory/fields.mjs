#!/usr/bin/env node
/**
 * fields.mjs - field-level harvester for the temple portal data layer.
 *
 * Written 2026-09-19 for brain file M16 (.claude/skills/temple-portal-expert/brain/
 * M16-collection-field-catalogue.md). Plain Node, built-in modules only, read-only.
 *
 * Run:  node .claude/state/inventory/fields.mjs
 * Out:  .claude/state/inventory/fields.json
 *
 * What it does
 * ------------
 * 1. Walks the source roots and, per file, resolves collection-name constants
 *    (`const COLLECTION_NAME = "sevaBookings"`, `const COLLECTIONS = { X: "y" }`).
 * 2. Finds "anchors": collection(db, X) / doc(db, X, ...) / db.collection(X) /
 *    collectionGroup(db, X) / .from(X).
 * 3. Picks a window around each anchor (whole file when the file touches exactly one
 *    store - services are usually single-store), and harvests field names inside it.
 * 4. Classifies each hit as a write (object-literal key handed to
 *    setDoc/addDoc/updateDoc/set/update/add/insert/upsert) or a read
 *    (where/orderBy/eq/order/select/data().x/destructuring).
 * 5. Parses types/*.ts interfaces and supabase/migrations/*.sql CREATE TABLEs.
 *
 * What it CANNOT see - confirm by opening the file:
 *  - fields read inside a mapper defined far from the anchor in a multi-store file;
 *  - computed keys, spreads (`...data`), and fields that only exist in seed JSON;
 *  - fields written through a variable (`await setDoc(ref, payload)`);
 *  - which of two same-named collections (Firestore `unknown_questions` vs the
 *    Supabase table of the same name) a hit belongs to - both are recorded.
 */

import fs from "node:fs";
import path from "node:path";

const argRoot = process.argv.slice(2).find((a) => !a.startsWith("--")) &&
  process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const ROOT = path.resolve(argRoot || process.cwd());
const OUT = path.join(ROOT, ".claude", "state", "inventory", "fields.json");

const SRC_ROOTS = [
  "app", "services", "lib", "hooks", "components", "scripts", "seed",
  "utils", "context", "data", "types",
];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const SKIP_DIR = new Set(["node_modules", ".next", ".git", "panchanga", "firestore-export", "firestore-dump", "exports"]);

/* ------------------------------------------------------------------ files */
function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (EXT.has(path.extname(e.name))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

const files = [];
for (const r of SRC_ROOTS) walk(path.join(ROOT, r), files);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

/* ------------------------------------------------------ constant resolution */
function aliasMap(src) {
  const map = new Map();
  // const NAME = "literal"  (and let/var, exported)
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*string)?\s*=\s*["'`]([A-Za-z_][\w-]*)["'`]/g;
  let m;
  while ((m = re.exec(src))) map.set(m[1], m[2]);
  // const COLLECTIONS = { KEY: "literal", ... }  -> COLLECTIONS.KEY
  const objRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*\{/g;
  let om;
  while ((om = objRe.exec(src))) {
    const objName = om[1];
    const start = src.indexOf("{", om.index);
    const body = balanced(src, start);
    if (!body || body.text.length > 4000) continue;
    const kv = /["'`]?([A-Za-z_$][\w$]*)["'`]?\s*:\s*["'`]([A-Za-z_][\w-]*)["'`]/g;
    let k;
    while ((k = kv.exec(body.text))) map.set(`${objName}.${k[1]}`, k[2]);
  }
  return map;
}

/** balanced {...} starting at index of '{' ; naive string/comment aware */
function balanced(src, open) {
  if (src[open] !== "{") return null;
  let depth = 0, i = open, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === "\\") { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i); if (i < 0) break; i++; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return { text: src.slice(open, i + 1), end: i }; }
  }
  return null;
}

/** top-level keys of a balanced object literal text */
function topLevelKeys(objText) {
  const keys = [];
  let depth = 0, i = 0, q = null;
  let atKeyPos = true;
  for (; i < objText.length; i++) {
    const c = objText[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") {
      if (depth === 1 && atKeyPos) {
        const m = /^(["'`])([A-Za-z_$][\w$]*)\1\s*:/.exec(objText.slice(i));
        if (m) { keys.push(m[2]); i += m[0].length - 1; atKeyPos = false; continue; }
      }
      q = c; continue;
    }
    if (c === "/" && objText[i + 1] === "/") { while (i < objText.length && objText[i] !== "\n") i++; continue; }
    if (c === "/" && objText[i + 1] === "*") { i = objText.indexOf("*/", i); if (i < 0) break; i++; continue; }
    if (c === "{" || c === "[" || c === "(") { depth++; if (c === "{" && depth === 1) atKeyPos = true; continue; }
    if (c === "}" || c === "]" || c === ")") { depth--; continue; }
    if (depth === 1 && c === ",") { atKeyPos = true; continue; }
    if (depth === 1 && atKeyPos) {
      const m = /^([A-Za-z_$][\w$]*)\s*[:,}]/.exec(objText.slice(i));
      if (m) {
        // `{ status, updatedAt }` shorthand counts too
        keys.push(m[1]);
        i += m[1].length - 1;
        atKeyPos = false;
        continue;
      }
      if (!/\s/.test(c)) atKeyPos = false;
    }
  }
  return keys;
}

/* --------------------------------------------------------------- anchors */
const ARG = String.raw`(["'\`][A-Za-z_][\w-]*["'\`]|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)`;
const ANCHOR_RES = [
  { kind: "fs", re: new RegExp(String.raw`\bcollection\(\s*[A-Za-z_$][\w$]*!?\s*,\s*${ARG}`, "g") },
  { kind: "fs", re: new RegExp(String.raw`\bcollectionGroup\(\s*[A-Za-z_$][\w$]*!?\s*,\s*${ARG}`, "g") },
  { kind: "fs", re: new RegExp(String.raw`\bdoc\(\s*[A-Za-z_$][\w$]*!?\s*,\s*${ARG}\s*,\s*["'\`]([A-Za-z_][\w-]*)["'\`]\s*\)`, "g"), doc: 2 },
  { kind: "fs", re: new RegExp(String.raw`\bdoc\(\s*[A-Za-z_$][\w$]*!?\s*,\s*${ARG}\s*[,)]`, "g") },
  { kind: "fs", re: new RegExp(String.raw`\.collection\(\s*${ARG}\s*\)`, "g") },
  { kind: "sb", re: new RegExp(String.raw`\.from\(\s*${ARG}\s*\)`, "g") },
];

function resolveArg(raw, alias) {
  if (/^["'`]/.test(raw)) return raw.slice(1, -1);
  if (alias.has(raw)) return alias.get(raw);
  return null;
}

/* ---------------------------------------------------- field harvest regexes */
const READ_RES = [
  { re: /\bwhere\(\s*["'`]([\w.]+)["'`]/g, how: "where" },
  { re: /\borderBy\(\s*["'`]([\w.]+)["'`]/g, how: "orderBy" },
  { re: /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|order)\(\s*["'`]([\w.]+)["'`]/g, how: "supabase-filter" },
  { re: /\.data\(\)\??\.([A-Za-z_$][\w$]*)/g, how: "data()" },
  { re: /\b(?:data|docData|rawData|row|rec|snapData|d)\??\.([A-Za-z_$][\w$]*)/g, how: "data." },
];
const SELECT_RE = /\.select\(\s*["'`]([^"'`]+)["'`]/g;
const DESTRUCT_RE = /(?:const|let)\s*\{([^}]{1,600})\}\s*=\s*(?:[A-Za-z_$][\w$]*\.data\(\)|data|docData|row|snapData)\b/g;

const WRITE_CALLS = /\b(?:setDoc|addDoc|updateDoc)\s*\(|\.(?:set|update|add|insert|upsert)\s*\(/g;

const NOISE = new Set([
  "id", "map", "filter", "forEach", "length", "then", "catch", "push", "slice", "docs", "exists",
  "toDate", "data", "toISOString", "get", "has", "size", "keys", "values", "entries", "join",
  "find", "sort", "reduce", "some", "every", "includes", "split", "trim", "toLowerCase",
  "toUpperCase", "replace", "concat", "toString", "valueOf", "call", "apply", "bind", "ref",
  "from", "of", "raw", "json", "text", "body", "ok", "status_code", "constructor", "prototype",
  // API/option noise, not document fields
  "count", "onConflict", "merge", "ascending", "head", "returning", "toLocaleDateString",
  "toLocaleString", "toFixed", "getTime", "seconds", "nanoseconds", "padStart", "substring",
]);
// `id` is real on every doc but never stored in the document body - track separately
const SOFT_NOISE = new Set(["id"]);

function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === "\n") n++;
  return n;
}
function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  return starts;
}
function lineFromStarts(starts, idx) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

/* ------------------------------------------------------------- main sweep */
const store = {};               // name -> { kind, fields: { f: {writes:[], reads:[]} }, sites: {...} }
const unresolved = [];          // anchors whose name could not be resolved
const WINDOW_FWD = 45, WINDOW_BACK = 3;

function bucket(name, kind) {
  if (!store[name]) store[name] = { kinds: {}, fields: {}, anchors: [], files: {} };
  store[name].kinds[kind] = true;
  return store[name];
}
function rawRecord(name, kind, field, mode, where) {
  if (!field || NOISE.has(field) || /^\d/.test(field)) return;
  const b = bucket(name, kind);
  if (!b.fields[field]) b.fields[field] = { writes: [], reads: [] };
  const list = b.fields[field][mode === "write" ? "writes" : "reads"];
  if (!list.includes(where)) list.push(where);
}

for (const abs of files) {
  const src = fs.readFileSync(abs, "utf8");
  const r = rel(abs);
  if (r.startsWith(".claude/")) continue;
  const alias = aliasMap(src);
  const starts = lineIndex(src);

  // 1. anchors
  const anchors = [];
  for (const { kind, re, doc } of ANCHOR_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const name = resolveArg(m[1], alias);
      const line = lineFromStarts(starts, m.index);
      if (!name) { unresolved.push({ file: r, line, expr: m[1] }); continue; }
      if (anchors.some((a) => a.idx === m.index)) continue;   // doc()-with-id matched twice
      anchors.push({ name, kind, idx: m.index, line, docId: doc ? m[doc] : null });
    }
  }
  if (!anchors.length) continue;
  anchors.sort((a, b) => a.idx - b.idx);
  for (const a of anchors) {
    const b = bucket(a.name, a.kind);
    const site = `${r}:${a.line}`;
    if (!b.anchors.includes(site)) b.anchors.push(site);
    b.files[r] = true;
  }

  const distinct = [...new Set(anchors.map((a) => `${a.kind}:${a.name}`))];
  const wholeFile = distinct.length === 1;

  // 2. windows
  const windows = [];
  if (wholeFile) {
    const ids = [...new Set(anchors.map((a) => a.docId).filter(Boolean))];
    windows.push({
      name: anchors[0].name, kind: anchors[0].kind, from: 0, to: src.length, mode: "file",
      docId: ids.length === 1 ? ids[0] : null,
    });
  } else {
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const backLine = Math.max(1, a.line - WINDOW_BACK);
      let from = starts[backLine - 1];
      let endLine = a.line + WINDOW_FWD;
      const next = anchors.find((x) => x.idx > a.idx && `${x.kind}:${x.name}` !== `${a.kind}:${a.name}`);
      if (next) endLine = Math.min(endLine, next.line - 1 >= a.line ? next.line - 1 : a.line);
      const to = endLine < starts.length ? starts[endLine] : src.length;
      windows.push({ name: a.name, kind: a.kind, from, to: Math.max(to, a.idx + 1), mode: "window", docId: a.docId });
    }
  }

  // 3. harvest
  for (const w of windows) {
    const text = src.slice(w.from, w.to);
    const base = w.from;
    const record = (name, kind, f, mode, at) => {
      rawRecord(name, kind, f, mode, at);
      if (w.docId) rawRecord(`${name}/${w.docId}`, `${kind}-doc`, f, mode, at);
    };

    for (const { re } of READ_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const line = lineFromStarts(starts, base + m.index);
        record(w.name, w.kind, m[1], "read", `${r}:${line}`);
      }
    }

    // variables bound to a snapshot payload: `const data = snap.data()`, `const row = res.data`
    const bound = new Set();
    const bindRe = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]{0,80})?=\s*(?:await\s+)?[A-Za-z_$][\w$.!?]*\.data\(\)/g;
    let bm;
    while ((bm = bindRe.exec(text))) bound.add(bm[1]);
    for (const v of bound) {
      const vr = new RegExp(String.raw`\b${v}\??\.([A-Za-z_$][\w$]*)`, "g");
      let vm;
      while ((vm = vr.exec(text))) {
        const line = lineFromStarts(starts, base + vm.index);
        record(w.name, w.kind, vm[1], "read", `${r}:${line}`);
      }
    }
    SELECT_RE.lastIndex = 0;
    let sm;
    while ((sm = SELECT_RE.exec(text))) {
      const line = lineFromStarts(starts, base + sm.index);
      for (const piece of sm[1].split(",")) {
        const f = piece.trim().split(/[\s(]/)[0];
        if (f && f !== "*" && /^[A-Za-z_]\w*$/.test(f)) record(w.name, w.kind, f, "read", `${r}:${line}`);
      }
    }
    DESTRUCT_RE.lastIndex = 0;
    let dm;
    while ((dm = DESTRUCT_RE.exec(text))) {
      const line = lineFromStarts(starts, base + dm.index);
      for (const piece of dm[1].split(",")) {
        const f = piece.trim().split(/[:=\s]/)[0];
        if (/^[A-Za-z_]\w*$/.test(f)) record(w.name, w.kind, f, "read", `${r}:${line}`);
      }
    }

    // writes: object literal handed to a write call
    WRITE_CALLS.lastIndex = 0;
    let wm;
    while ((wm = WRITE_CALLS.exec(text))) {
      const callEnd = base + wm.index + wm[0].length;
      // find the first '{' that starts an argument, within 240 chars, skipping a nested call
      let j = callEnd, guard = 0, q = null, depth = 0;
      let objStart = -1;
      for (; j < src.length && guard < 400; j++, guard++) {
        const c = src[j];
        if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === "`") { q = c; continue; }
        if (c === "(") { depth++; continue; }
        if (c === ")") { if (depth === 0) break; depth--; continue; }
        if (c === "{") { objStart = j; break; }
        if (c === ";") break;
      }
      if (objStart < 0) continue;
      const bal = balanced(src, objStart);
      if (!bal) continue;
      const line = lineFromStarts(starts, objStart);
      for (const k of topLevelKeys(bal.text)) record(w.name, w.kind, k, "write", `${r}:${line}`);
    }
  }
}

/* ----------------------------------------------------- declared TS types */
const typeFields = {};   // TypeName -> [{name, type, optional, file, line}]
const TYPE_FILES = walk(path.join(ROOT, "types"));
for (const extra of ["lib/ai/knowledge/types.ts", "lib/ai/ai-settings/types.ts", "types/ai-settings.ts"]) {
  const p = path.join(ROOT, extra);
  if (fs.existsSync(p) && !TYPE_FILES.includes(p)) TYPE_FILES.push(p);
}
for (const abs of TYPE_FILES) {
  const src = fs.readFileSync(abs, "utf8");
  const r = rel(abs);
  const starts = lineIndex(src);
  const re = /export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+[^{]+)?=?\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const open = src.indexOf("{", m.index + m[0].length - 1);
    const bal = balanced(src, open);
    if (!bal) continue;
    const list = [];
    const fieldRe = /(?:^|\n)\s{2}(["'`]?)([A-Za-z_$][\w$]*)\1(\?)?\s*:\s*([^;\n]+)/g;
    let f;
    while ((f = fieldRe.exec(bal.text))) {
      list.push({ name: f[2], optional: !!f[3], type: f[4].trim().replace(/,$/, "") });
    }
    typeFields[`${r}#${m[1]}`] = { file: r, name: m[1], line: lineFromStarts(starts, m.index), fields: list };
  }
}

/* --------------------------------------------------- supabase migrations */
const tables = {};
const MIG = path.join(ROOT, "supabase", "migrations");
for (const f of fs.existsSync(MIG) ? fs.readdirSync(MIG).sort() : []) {
  if (!f.endsWith(".sql")) continue;
  const raw = fs.readFileSync(path.join(MIG, f), "utf8");
  // blank out `-- ...` comments but keep line count/offsets intact
  const src = raw.replace(/--[^\n]*/g, (s) => " ".repeat(s.length));
  const starts = lineIndex(src);
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([\w]+)"?\s*\(/gi;
  let m;
  while ((m = re.exec(src))) {
    const open = src.indexOf("(", m.index + m[0].length - 1);
    // balanced parens
    let depth = 0, i = open, q = null, end = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    const body = src.slice(open + 1, end);
    const cols = [];
    let d = 0, cur = "", qq = null;
    const parts = [];
    for (const c of body) {
      if (qq) { cur += c; if (c === qq) qq = null; continue; }
      if (c === "'" || c === '"') { qq = c; cur += c; continue; }
      if (c === "(") d++;
      if (c === ")") d--;
      if (c === "," && d === 0) { parts.push(cur); cur = ""; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur);
    for (const p of parts) {
      const t = p.trim().replace(/\s+/g, " ");
      if (!t) continue;
      if (/^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK|EXCLUDE)\b/i.test(t)) continue;
      const cm = /^"?([A-Za-z_]\w*)"?\s+(.+)$/.exec(t);
      if (!cm) continue;
      const restOf = cm[2];
      cols.push({
        name: cm[1],
        type: restOf.replace(/\s*(NOT NULL|NULL|DEFAULT .*|UNIQUE|PRIMARY KEY|REFERENCES .*|CHECK .*)/gi, "").trim() || restOf,
        notNull: /NOT NULL/i.test(restOf),
        default: (/DEFAULT\s+([^,]+?)(?:\s+(?:NOT NULL|UNIQUE|CHECK|REFERENCES)|$)/i.exec(restOf) || [])[1] || null,
        raw: t,
      });
    }
    const name = m[1];
    if (!tables[name]) tables[name] = { migrations: [], columns: [], policies: [], indexes: [] };
    tables[name].migrations.push(`supabase/migrations/${f}:${lineFromStarts(starts, m.index)}`);
    // later migration wins, but keep union
    for (const c of cols) if (!tables[name].columns.some((x) => x.name === c.name)) tables[name].columns.push(c);
  }
  // policies
  const pre = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?"?(\w+)"?\s+FOR\s+(\w+)([\s\S]{0,200}?);/gi;
  let pm;
  while ((pm = pre.exec(src))) {
    const t = pm[2];
    if (!tables[t]) tables[t] = { migrations: [], columns: [], policies: [], indexes: [] };
    tables[t].policies.push({
      name: pm[1], cmd: pm[3].toUpperCase(),
      clause: pm[4].replace(/\s+/g, " ").trim().slice(0, 160),
      at: `supabase/migrations/${f}:${lineFromStarts(starts, pm.index)}`,
    });
  }
  const ire = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(?:public\.)?"?(\w+)"?\s*\(([^)]*)\)/gi;
  let im;
  while ((im = ire.exec(src))) {
    const t = im[2];
    if (!tables[t]) tables[t] = { migrations: [], columns: [], policies: [], indexes: [] };
    tables[t].indexes.push({ name: im[1], cols: im[3].replace(/\s+/g, " ").trim(), at: `supabase/migrations/${f}:${lineFromStarts(starts, im.index)}` });
  }
}

/* --------------------------------------------------------------- output */
const out = {
  generated: "2026-09-19",
  root: rel(ROOT) || ".",
  filesScanned: files.length,
  note: "See the header of fields.mjs for what this harvester can and cannot see.",
  stores: {},
  types: typeFields,
  supabaseSchema: tables,
  unresolvedAnchors: unresolved,
};
for (const [name, b] of Object.entries(store).sort(([a], [c]) => a.localeCompare(c))) {
  out.stores[name] = {
    kinds: Object.keys(b.kinds),
    anchors: b.anchors,
    files: Object.keys(b.files),
    fieldCount: Object.keys(b.fields).length,
    fields: Object.fromEntries(
      Object.entries(b.fields).sort(([a], [c]) => a.localeCompare(c))
    ),
  };
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

const totalFields = Object.values(out.stores).reduce((n, s) => n + s.fieldCount, 0);
console.log(`files scanned      : ${files.length}`);
console.log(`stores found       : ${Object.keys(out.stores).length}`);
console.log(`field candidates   : ${totalFields}`);
console.log(`TS types parsed    : ${Object.keys(typeFields).length}`);
console.log(`SQL tables parsed  : ${Object.keys(tables).length}`);
console.log(`unresolved anchors : ${unresolved.length}`);
console.log(`written            : ${rel(OUT)}`);

/* ================================================================= expand ==
 * Second mode:  node fields.mjs --expand <brain-file>
 * Rewrites the brain file in place, replacing every placeholder line
 *     <!--FIELDS fs <collection> [| <types-file>#<TypeName>] -->
 *     <!--FIELDS sb <table> -->
 *     <!--COLUMNS <table> -->
 * with the generated markdown table, so that every path:line in the catalogue
 * comes from the harvest and not from hand transcription. Idempotent: a
 * placeholder is kept in the output and the table is regenerated under it.
 */
const expandIdx = process.argv.indexOf("--expand");
if (expandIdx !== -1) {
  const target = path.resolve(process.argv[expandIdx + 1]);
  const doc = fs.readFileSync(target, "utf8");

  const siteList = (list) => {
    if (!list || !list.length) return "-";
    const s = list.slice(0, 3).map((x) => "`" + x + "`").join("<br>");
    return s + (list.length > 3 ? `<br>+${list.length - 3} more` : "");
  };
  const cell = (s) => String(s).replace(/\|/g, "\\|");

  function fieldTable(storeKey, typeKey) {
    const st = out.stores[storeKey];
    const ti = typeKey ? typeFields[typeKey] : null;
    const tmap = {};
    if (ti) for (const f of ti.fields) tmap[f.name] = f;
    const names = [...new Set([...(st ? Object.keys(st.fields) : []), ...Object.keys(tmap)])]
      .filter((n) => !n.includes("/"))
      .sort();
    if (!names.length) return "_No field observed at any call site and no declared type._";
    const rows = [
      "| field | type | required? | written by | read by | notes |",
      "|---|---|---|---|---|---|",
    ];
    for (const f of names) {
      const io = (st && st.fields[f]) || { writes: [], reads: [] };
      const dt = tmap[f];
      const type = dt ? "`" + cell(dt.type.slice(0, 40)) + "`" : "`?` inferred";
      const req = dt ? (dt.optional ? "no" : "yes") : "-";
      let note = dt
        ? (!io.writes.length && !io.reads.length ? "declared, **no call site**" : "declared")
        : "not in the type";
      if (f === "id") note += "; doc id, not a stored field";
      rows.push(`| \`${cell(f)}\` | ${type} | ${req} | ${siteList(io.writes)} | ${siteList(io.reads)} | ${note} |`);
    }
    return rows.join("\n");
  }

  function columnTable(tableName) {
    const t = tables[tableName];
    if (!t) return "_No CREATE TABLE found in supabase/migrations._";
    const st = out.stores[tableName];
    const rows = [
      "| column | type | nullable | default | read/written by |",
      "|---|---|---|---|---|",
    ];
    for (const c of t.columns) {
      const io = (st && st.fields[c.name]) || { writes: [], reads: [] };
      const use = [
        io.writes.length ? "W " + siteList(io.writes) : "",
        io.reads.length ? "R " + siteList(io.reads) : "",
      ].filter(Boolean).join("<br>") || "-";
      rows.push(`| \`${cell(c.name)}\` | \`${cell(c.type)}\` | ${c.notNull ? "NOT NULL" : "yes"} | ${c.default ? "`" + cell(c.default) + "`" : "-"} | ${use} |`);
    }
    let extra = "\n\n**RLS:** " + (t.policies.length
      ? t.policies.map((p) => `${p.cmd} \`${p.name}\` (\`${p.at}\`)`).join("; ")
      : "no policy in any migration");
    extra += "  \n**Indexes:** " + (t.indexes.length
      ? t.indexes.map((i) => `\`${i.name}(${i.cols})\``).join(", ")
      : "none declared");
    extra += "  \n**Declared in:** " + t.migrations.map((m) => "`" + m + "`").join(", ");
    return rows.join("\n") + extra;
  }

  // INDEX rows: one line per store, in the order the doc lists them
  function indexRows(spec) {
    const rows = [
      "| store | kind | type file | F | W | R | migration state | jump |",
      "|---|---|---|---|---|---|---|---|",
    ];
    for (const line of spec.split(";").map((s) => s.trim()).filter(Boolean)) {
      const [kind, name, typeKey, state] = line.split("|").map((s) => (s || "").trim());
      const st = out.stores[name];
      let W = 0, R = 0;
      let F = st ? Object.keys(st.fields).length : 0;
      if (kind === "sb" && tables[name]) F = tables[name].columns.length;
      if (st) for (const io of Object.values(st.fields)) { W += io.writes.length; R += io.reads.length; }
      const tf = typeKey && typeKey !== "-" ? "`" + typeKey + "`" : "**none**";
      rows.push(`| \`${name}\` | ${kind === "fs" ? "Firestore" : "Supabase"} | ${tf} | ${F} | ${W} | ${R} | ${state || ""} | [→](#${kind}-${name.toLowerCase()}) |`);
    }
    return rows.join("\n");
  }

  const expanded = doc.replace(
    /^(<!--(FIELDS|COLUMNS|INDEX)[^>]*-->)[\s\S]*?(?=\n<!--END-->)\n<!--END-->/gm,
    (_, tag) => tag + "\n<!--END-->"
  ).replace(/^<!--(FIELDS|COLUMNS|INDEX)\s+([^>]*?)\s*-->\n<!--END-->/gm, (_, kind, arg) => {
    let body;
    if (kind === "COLUMNS") body = columnTable(arg.trim());
    else if (kind === "INDEX") body = indexRows(arg);
    else {
      const [store, type] = arg.split("|").map((s) => s.trim());
      body = fieldTable(store.replace(/^(fs|sb)\s+/, ""), type || null);
    }
    return `<!--${kind} ${arg}-->\n${body}\n<!--END-->`;
  });

  fs.writeFileSync(target, expanded, "utf8");
  const n = (expanded.match(/^<!--(FIELDS|COLUMNS|INDEX)/gm) || []).length;
  console.log(`expanded           : ${n} tables into ${rel(target)}`);
}
