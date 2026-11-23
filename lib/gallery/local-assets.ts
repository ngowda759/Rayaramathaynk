import fs from "fs";
import path from "path";

/**
 * Local gallery assets under `public/`. Deletion is restricted to two roots and
 * every resolved path is checked twice: once on the requested path and once on
 * its real path, so a symlinked file or directory cannot escape the roots.
 *
 * Kept separate from the route so the containment rules can be unit-tested
 * against a temporary directory without touching the repository's `public/`.
 */

export const LOCAL_IMAGE_PREFIX = "/images/temple";
export const LOCAL_VIDEO_PREFIX = "/videos";

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg)$/i;

export interface LocalAsset {
  id: string;
  src: string;
  title: string;
  alt: string;
}

export interface LocalAssetRoots {
  images: string;
  videos: string;
}

export type ResolveLocalAssetResult =
  | { ok: true; absolutePath: string; realPath: string }
  | { ok: false; status: number; error: string };

export function localAssetRoots(publicRoot: string): LocalAssetRoots {
  return {
    images: path.resolve(publicRoot, "images", "temple"),
    videos: path.resolve(publicRoot, "videos"),
  };
}

function isWithin(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function realRootOrNull(root: string): string | null {
  try {
    return fs.realpathSync(root);
  } catch {
    return null;
  }
}

/**
 * Resolve a request-supplied `src` to a file that may be deleted. Returns a
 * status and safe message on refusal; never leaks a filesystem path.
 */
export function resolveLocalAssetPath(
  src: unknown,
  publicRoot: string,
): ResolveLocalAssetResult {
  if (typeof src !== "string" || src.length === 0) {
    return { ok: false, status: 400, error: "Invalid src" };
  }
  // A NUL byte or a backslash can be used to confuse path handling on some
  // platforms; neither is valid in an asset path this application writes.
  if (src.includes("\0") || src.includes("\\")) {
    return { ok: false, status: 400, error: "Invalid src" };
  }
  if (!src.startsWith("/")) {
    return { ok: false, status: 400, error: "Invalid src" };
  }

  const normalized = path.posix.normalize(src);
  const roots = localAssetRoots(publicRoot);
  const absolutePath = path.resolve(publicRoot, "." + normalized);

  if (!isWithin(roots.images, absolutePath) && !isWithin(roots.videos, absolutePath)) {
    return { ok: false, status: 403, error: "Unauthorized path" };
  }

  if (!IMAGE_EXTENSIONS.test(absolutePath) && !VIDEO_EXTENSIONS.test(absolutePath)) {
    return { ok: false, status: 400, error: "Unsupported file type" };
  }

  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch {
    return { ok: false, status: 404, error: "File not found" };
  }
  // The final component must be a regular file. A symlink is refused outright;
  // a symlinked ancestor directory is caught by the real-path check below.
  if (stat.isSymbolicLink() || !stat.isFile()) {
    return { ok: false, status: 403, error: "Unauthorized path" };
  }

  let realPath: string;
  try {
    realPath = fs.realpathSync(absolutePath);
  } catch {
    return { ok: false, status: 404, error: "File not found" };
  }

  const realRoots = [realRootOrNull(roots.images), realRootOrNull(roots.videos)].filter(
    (root): root is string => root !== null,
  );
  if (!realRoots.some((root) => isWithin(root, realPath))) {
    return { ok: false, status: 403, error: "Unauthorized path" };
  }

  return { ok: true, absolutePath, realPath };
}

export function listLocalAssets(publicRoot: string): {
  localImages: LocalAsset[];
  localVideos: LocalAsset[];
} {
  const roots = localAssetRoots(publicRoot);
  return {
    localImages: listDirectory(roots.images, IMAGE_EXTENSIONS, LOCAL_IMAGE_PREFIX),
    localVideos: listDirectory(roots.videos, VIDEO_EXTENSIONS, LOCAL_VIDEO_PREFIX),
  };
}

function listDirectory(directory: string, allowed: RegExp, prefix: string): LocalAsset[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && allowed.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((filename) => ({
      id: `${prefix.slice(1)}-${filename}`,
      src: `${prefix}/${filename}`,
      title: normalizeFilename(filename) || filename,
      alt: normalizeFilename(filename) || "Local gallery asset",
    }));
}

function normalizeFilename(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
