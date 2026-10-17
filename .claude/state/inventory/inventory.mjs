// Plain Node inventory script. Built-ins only. See .claude/state/briefs/INVENTORY.brief.md.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = __dirname;

const SKIP_DIRS = new Set(['node_modules', '.next', '.claude', '.git']);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const RECORD_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.css', '.json', '.md',
  '.sql', '.yml', '.yaml', '.rules', '.sh', '.html',
]);
const MAX_BYTES = 2 * 1024 * 1024;

function toRel(p) {
  return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

// ---------- tsconfig alias ----------
let alias = { prefix: '@/', target: '' }; // "@/*" -> "./*" => strip "@/" from repo root
try {
  const tsconfigRaw = fs.readFileSync(path.join(REPO_ROOT, 'tsconfig.json'), 'utf8');
  const tsconfig = JSON.parse(tsconfigRaw);
  const paths = tsconfig?.compilerOptions?.paths || {};
  const key = Object.keys(paths).find((k) => k.includes('*'));
  if (key) {
    const targetArr = paths[key];
    const target = Array.isArray(targetArr) ? targetArr[0] : targetArr;
    alias.prefix = key.replace('*', '');
    alias.target = String(target).replace('*', '').replace(/^\.\//, '');
  }
} catch (e) {
  // fall back to default @/ -> repo root
}

// ---------- walk ----------
const records = []; // full records for RECORD_EXTS files (real content read)
const publicEntries = []; // {path, ext} only, public/ dir
let panchangaFileCount = 0;
const notes = [];

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function countFilesRecursive(dir) {
  let count = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      count += countFilesRecursive(full);
    } else if (ent.isFile()) {
      count += 1;
    }
  }
  return count;
}

function listPublicRecursive(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      listPublicRecursive(full);
    } else if (ent.isFile()) {
      publicEntries.push({ path: toRel(full), ext: path.extname(ent.name).toLowerCase() });
    }
  }
}

function extractHasUseClient(content) {
  const lines = content.split(/\r?\n/);
  let inBlockComment = false;
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (inBlockComment) {
      const endIdx = line.indexOf('*/');
      if (endIdx === -1) continue;
      line = line.slice(endIdx + 2).trim();
      inBlockComment = false;
      if (!line) continue;
    }
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      const endIdx = line.indexOf('*/', 2);
      if (endIdx === -1) {
        inBlockComment = true;
        continue;
      }
      line = line.slice(endIdx + 2).trim();
      if (!line) continue;
    }
    // this is the first substantive line
    return /^["']use client["'];?$/.test(line);
  }
  return false;
}

const IMPORT_RE = /import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_RE = /export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|class|type|interface)\s+([A-Za-z0-9_$]+)/g;
const EXPORT_DEFAULT_BARE_RE = /export\s+default\s+(?!function|class|async)([A-Za-z0-9_$]+)/g;

function extractCodeFields(content) {
  const hasUseClient = extractHasUseClient(content);

  const imports = new Set();
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content))) imports.add(m[1]);
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(content))) imports.add(m[1]);

  const hasServerOnly = [...imports].includes('server-only');

  const exportsSet = new Set();
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(content))) exportsSet.add(m[1]);
  EXPORT_DEFAULT_BARE_RE.lastIndex = 0;
  while ((m = EXPORT_DEFAULT_BARE_RE.exec(content))) exportsSet.add(m[1]);
  if (/export\s+default\s+(function|class)\s*[({]/.test(content) ||
      /export\s+default\s+\(/.test(content)) {
    exportsSet.add('default');
  }

  return {
    hasUseClient,
    hasServerOnly,
    exports: [...exportsSet],
    imports: [...imports],
  };
}

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
let fileExistsCache = new Map();
function fileExists(absPath) {
  if (fileExistsCache.has(absPath)) return fileExistsCache.get(absPath);
  let ok = false;
  try {
    ok = fs.statSync(absPath).isFile();
  } catch {
    ok = false;
  }
  fileExistsCache.set(absPath, ok);
  return ok;
}

function resolveLocalImport(spec, fromFileAbs) {
  let baseAbs;
  if (spec.startsWith(alias.prefix)) {
    const rest = spec.slice(alias.prefix.length);
    baseAbs = path.join(REPO_ROOT, alias.target, rest);
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    baseAbs = path.resolve(path.dirname(fromFileAbs), spec);
  } else {
    return null; // not a local import
  }
  for (const suf of RESOLVE_SUFFIXES) {
    const candidate = baseAbs + suf;
    if (fileExists(candidate)) return toRel(candidate);
  }
  return null;
}

function walk(dirAbs) {
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (e) {
    notes.push(`UNCLEAR: could not read dir ${toRel(dirAbs)}: ${e.message}`);
    return;
  }
  for (const ent of entries) {
    const full = path.join(dirAbs, ent.name);
    const rel = toRel(full);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      if (rel === 'data/panchanga') {
        panchangaFileCount += countFilesRecursive(full);
        continue;
      }
      if (rel === 'public') {
        listPublicRecursive(full);
        continue;
      }
      walk(full);
      continue;
    }
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!RECORD_EXTS.has(ext)) continue;
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.size > MAX_BYTES) {
      notes.push(`Skipped >2MB file: ${rel}`);
      continue;
    }
    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch (e) {
      notes.push(`UNCLEAR: could not read ${rel}: ${e.message}`);
      continue;
    }
    const lines = content.length === 0 ? 0 : content.split(/\r?\n/).length;
    const record = {
      path: rel,
      lines,
      bytes: stat.size,
    };
    if (CODE_EXTS.has(ext)) {
      const fields = extractCodeFields(content);
      record.hasUseClient = fields.hasUseClient;
      record.hasServerOnly = fields.hasServerOnly;
      record.exports = fields.exports;
      record.imports = fields.imports;
      record.localImports = fields.imports
        .map((spec) => resolveLocalImport(spec, full))
        .filter(Boolean);
    }
    records.push(record);
  }
}

walk(REPO_ROOT);

// index by path for quick lookup
const recordByPath = new Map(records.map((r) => [r.path, r]));

// ---------- chunk resolution ----------
const chunksRaw = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude', 'state', 'chunks.json'), 'utf8'));

function resolveRoot(root) {
  const absCandidate = path.join(REPO_ROOT, root);
  // exact recorded file
  if (recordByPath.has(root)) return [recordByPath.get(root)];
  // synthetic dirs
  if (root === 'data/panchanga') {
    return [{ path: 'data/panchanga', lines: 0, bytes: 0, fileCount: panchangaFileCount, isDirectorySummary: true }];
  }
  if (root === 'public') {
    return publicEntries.map((e) => ({ path: e.path, ext: e.ext, lines: 0, bytes: 0, isPublicAsset: true }));
  }
  // directory
  if (isDirectory(absCandidate)) {
    const prefix = root.endsWith('/') ? root : root + '/';
    return records.filter((r) => r.path === root || r.path.startsWith(prefix));
  }
  // glob with single * in last segment
  const base = path.basename(root);
  if (base.includes('*')) {
    const dirPart = path.dirname(root) === '.' ? '' : path.dirname(root);
    const regex = new RegExp('^' + base.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return records.filter((r) => {
      const rDir = path.dirname(r.path) === '.' ? '' : path.dirname(r.path);
      return rDir === dirPart && regex.test(path.basename(r.path));
    });
  }
  // file that doesn't exist as a recorded ext (e.g. no matching record ext), or truly missing
  if (fs.existsSync(absCandidate)) {
    // exists but not a recorded extension (e.g. binary) - skip silently, not an error
    return [];
  }
  notes.push(`Root matched nothing: ${root}`);
  return [];
}

const chunkAssignments = new Map(); // chunkId -> Set(paths)
const pathToChunks = new Map(); // path -> Set(chunkId)

const chunkOutputs = [];
for (const chunk of chunksRaw.chunks) {
  const fileSet = new Map(); // path -> record
  for (const root of chunk.roots) {
    const matched = resolveRoot(root);
    for (const rec of matched) {
      fileSet.set(rec.path, rec);
    }
  }
  const files = [...fileSet.values()];
  const totalLines = files.reduce((sum, r) => sum + (r.lines || 0), 0);
  chunkAssignments.set(chunk.id, new Set(fileSet.keys()));
  for (const p of fileSet.keys()) {
    if (!pathToChunks.has(p)) pathToChunks.set(p, new Set());
    pathToChunks.get(p).add(chunk.id);
  }
  const out = {
    id: chunk.id,
    title: chunk.title,
    files,
    totals: { files: files.length, lines: totalLines },
  };
  chunkOutputs.push(out);
  fs.writeFileSync(path.join(OUT_DIR, `${chunk.id}.json`), JSON.stringify(out, null, 2));
}

// ---------- import graph ----------
const GRAPH_DIRS = ['app', 'components', 'services', 'lib', 'hooks', 'types', 'context', 'utils'];
const importGraph = {};
for (const r of records) {
  if (!r.localImports) continue;
  const topDir = r.path.split('/')[0];
  if (!GRAPH_DIRS.includes(topDir)) continue;
  importGraph[r.path] = r.localImports;
}
fs.writeFileSync(path.join(OUT_DIR, 'import-graph.json'), JSON.stringify(importGraph, null, 2));

// ---------- SUMMARY.md ----------
const SUMMARY_DIRS = ['app', 'components', 'services', 'lib', 'hooks', 'types', 'context', 'utils', 'data', 'seed', 'scripts', 'tests'];
const assignedPaths = new Set();
for (const s of chunkAssignments.values()) for (const p of s) assignedPaths.add(p);

const unassigned = records.filter((r) => {
  const topDir = r.path.split('/')[0];
  return SUMMARY_DIRS.includes(topDir) && !assignedPaths.has(r.path);
}).sort((a, b) => a.path.localeCompare(b.path));

const multiAssigned = [...pathToChunks.entries()]
  .filter(([, s]) => s.size > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

// reverse dependency hotspots
const importerCount = new Map();
for (const [file, imports] of Object.entries(importGraph)) {
  for (const imp of imports) {
    importerCount.set(imp, (importerCount.get(imp) || 0) + 1);
  }
}
const hotspots = [...importerCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);

const sourceRecords = records.filter((r) => CODE_EXTS.has(path.extname(r.path)));
const totalSourceFiles = sourceRecords.length;
const totalSourceLines = sourceRecords.reduce((s, r) => s + r.lines, 0);
const useClientCount = sourceRecords.filter((r) => r.hasUseClient).length;
const serverOnlyCount = sourceRecords.filter((r) => r.hasServerOnly).length;

let md = '';
md += '# Inventory Summary\n\n';
md += `Generated: 2026-09-19\n\n`;
md += '## Chunks\n\n';
md += '| Chunk | Title | Files | Lines |\n';
md += '|---|---|---:|---:|\n';
for (const c of chunkOutputs) {
  md += `| ${c.id} | ${c.title} | ${c.totals.files} | ${c.totals.lines} |\n`;
}
md += '\n## Unassigned\n\n';
md += `${unassigned.length} files under app, components, services, lib, hooks, types, context, utils, data, seed, scripts, tests are not owned by any chunk.\n\n`;
for (const r of unassigned) {
  md += `- ${r.path} (${r.lines} lines)\n`;
}
md += '\n## Assigned to more than one chunk\n\n';
md += `${multiAssigned.length} files are claimed by 2+ chunks (allowed).\n\n`;
for (const [p, s] of multiAssigned) {
  md += `- ${p}: ${[...s].sort().join(', ')}\n`;
}
md += '\n## Reverse dependency hot-spots (top 30 most-imported local files)\n\n';
md += '| File | Importer count |\n|---|---:|\n';
for (const [f, count] of hotspots) {
  md += `| ${f} | ${count} |\n`;
}
md += '\n## Totals\n\n';
md += `- Source files (.ts/.tsx/.js/.jsx/.mjs): ${totalSourceFiles}\n`;
md += `- Source lines: ${totalSourceLines}\n`;
md += `- 'use client' files: ${useClientCount}\n`;
md += `- server-only files: ${serverOnlyCount}\n`;
md += `- data/panchanga files (counted only, not read): ${panchangaFileCount}\n`;
md += `- public/ files (listed only, not read): ${publicEntries.length}\n`;
if (notes.length) {
  md += '\n## Notes\n\n';
  for (const n of notes) md += `- ${n}\n`;
}

fs.writeFileSync(path.join(OUT_DIR, 'SUMMARY.md'), md);

console.log(JSON.stringify({
  totalRecords: records.length,
  totalSourceFiles,
  totalSourceLines,
  panchangaFileCount,
  publicEntries: publicEntries.length,
  unassigned: unassigned.length,
  multiAssigned: multiAssigned.length,
  useClientCount,
  serverOnlyCount,
  notes: notes.length,
}, null, 2));
