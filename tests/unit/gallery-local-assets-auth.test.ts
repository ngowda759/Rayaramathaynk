/**
 * @jest-environment node
 *
 * F-04.1: local gallery asset deletion must be authorized and contained.
 *
 * The route previously exposed an unauthenticated GET (which listed filenames)
 * and an unauthenticated DELETE (which removed them). These tests pin:
 *  - a verified admin session is required for GET and DELETE;
 *  - DELETE needs a gallery-write role (super_admin / temple_admin / admin);
 *  - traversal, absolute paths, backslashes, NUL bytes, symlinks and files
 *    outside `public/images/temple` and `public/videos` are refused;
 *  - files outside the roots are never touched.
 *
 * The containment helper takes an explicit `publicRoot`, so the path tests run
 * against a temporary directory and never touch the repository's `public/`.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import fs from "fs";
import os from "os";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

import { listLocalAssets, resolveLocalAssetPath } from "@/lib/gallery/local-assets";
import { DELETE as deleteRoute, GET as getRoute } from "../../app/api/gallery/local-assets/route";

let tmpRoot: string;
let publicRoot: string;
let imagesRoot: string;
let videosRoot: string;

function writeFile(relative: string, contents = "x"): string {
  const full = path.join(publicRoot, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  return full;
}

function authorized(role: string) {
  mockRequireAdminUser.mockResolvedValue({
    ok: true,
    user: { uid: "uid-1", email: "admin@example.com", role, provider: "supabase" },
  });
}

function unauthorized() {
  mockRequireAdminUser.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
  });
}

function deleteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/gallery/local-assets", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function getRequest(): NextRequest {
  return new NextRequest("http://localhost/api/gallery/local-assets", { method: "GET" });
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-f04-"));
  publicRoot = path.join(tmpRoot, "public");
  imagesRoot = path.join(publicRoot, "images", "temple");
  videosRoot = path.join(publicRoot, "videos");
  fs.mkdirSync(imagesRoot, { recursive: true });
  fs.mkdirSync(videosRoot, { recursive: true });
  jest.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  mockRequireAdminUser.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("resolveLocalAssetPath — containment", () => {
  test("accepts a regular image inside public/images/temple", () => {
    const file = writeFile("images/temple/a.jpg");
    const result = resolveLocalAssetPath("/images/temple/a.jpg", publicRoot);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.realPath).toBe(fs.realpathSync(file));
  });

  test("accepts a regular video inside public/videos", () => {
    writeFile("videos/b.mp4");
    expect(resolveLocalAssetPath("/videos/b.mp4", publicRoot).ok).toBe(true);
  });

  test.each([
    ["/images/temple/../../secret.jpg", 403],
    ["/images/temple/../../../etc/passwd", 403],
    ["//etc/passwd", 403],
    ["/images/other/a.jpg", 403],
    ["images/temple/a.jpg", 400],
    ["/images/temple/a.jpg\0", 400],
    ["/images/temple/..\\..\\secret.jpg", 400],
    ["/images/temple/a.txt", 400],
  ])("refuses %j with %i", (src, status) => {
    writeFile("secret.jpg");
    const result = resolveLocalAssetPath(src, publicRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(status);
  });

  test("refuses a directory", () => {
    fs.mkdirSync(path.join(imagesRoot, "folder.jpg"), { recursive: true });
    const result = resolveLocalAssetPath("/images/temple/folder.jpg", publicRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  test("refuses a symlink to a file outside the roots", () => {
    const outside = path.join(tmpRoot, "outside.jpg");
    fs.writeFileSync(outside, "secret");
    fs.symlinkSync(outside, path.join(imagesRoot, "link.jpg"));
    const result = resolveLocalAssetPath("/images/temple/link.jpg", publicRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  test("refuses a file reached through a symlinked directory outside the roots", () => {
    const outsideDir = path.join(tmpRoot, "outside-dir");
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, "escape.jpg"), "secret");
    fs.symlinkSync(outsideDir, path.join(imagesRoot, "linkdir"));
    const result = resolveLocalAssetPath("/images/temple/linkdir/escape.jpg", publicRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  test("returns 404 for a missing file inside an allowed root", () => {
    const result = resolveLocalAssetPath("/images/temple/missing.jpg", publicRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

describe("listLocalAssets", () => {
  test("lists regular files only, sorted, with safe public srcs", () => {
    writeFile("images/temple/b.jpg");
    writeFile("images/temple/a.png");
    writeFile("videos/c.mp4");
    fs.mkdirSync(path.join(imagesRoot, "folder.jpg"), { recursive: true });
    fs.symlinkSync(path.join(tmpRoot, "outside.jpg"), path.join(imagesRoot, "link.jpg"));

    const listed = listLocalAssets(publicRoot);
    expect(listed.localImages.map((a) => a.src)).toEqual([
      "/images/temple/a.png",
      "/images/temple/b.jpg",
    ]);
    expect(listed.localVideos.map((a) => a.src)).toEqual(["/videos/c.mp4"]);
  });

  test("returns empty lists when the roots are missing", () => {
    fs.rmSync(publicRoot, { recursive: true, force: true });
    expect(listLocalAssets(publicRoot)).toEqual({ localImages: [], localVideos: [] });
  });
});

describe("GET /api/gallery/local-assets", () => {
  test("rejects an anonymous caller", async () => {
    unauthorized();
    const response = await getRoute(getRequest());
    expect(response.status).toBe(401);
  });

  test("lists assets for an authorized console role", async () => {
    writeFile("images/temple/a.jpg");
    authorized("priest");
    const response = await getRoute(getRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { localImages: { src: string }[] };
    expect(body.localImages.map((a) => a.src)).toEqual(["/images/temple/a.jpg"]);
  });
});

describe("DELETE /api/gallery/local-assets", () => {
  test("rejects an anonymous caller and leaves the file", async () => {
    const file = writeFile("images/temple/a.jpg");
    unauthorized();
    const response = await deleteRoute(deleteRequest({ src: "/images/temple/a.jpg" }));
    expect(response.status).toBe(401);
    expect(fs.existsSync(file)).toBe(true);
  });

  test.each(["billing", "priest", "staff", "office_staff"])(
    "rejects the %s role and leaves the file",
    async (role) => {
      const file = writeFile("images/temple/a.jpg");
      authorized(role);
      const response = await deleteRoute(deleteRequest({ src: "/images/temple/a.jpg" }));
      expect(response.status).toBe(403);
      expect(fs.existsSync(file)).toBe(true);
    },
  );

  test.each(["super_admin", "temple_admin", "admin"])(
    "allows the %s role to delete a regular file",
    async (role) => {
      const file = writeFile("images/temple/a.jpg");
      authorized(role);
      const response = await deleteRoute(deleteRequest({ src: "/images/temple/a.jpg" }));
      expect(response.status).toBe(200);
      expect(fs.existsSync(file)).toBe(false);
    },
  );

  test("rejects traversal and leaves the outside file", async () => {
    const outside = path.join(tmpRoot, "secret.jpg");
    fs.writeFileSync(outside, "secret");
    authorized("super_admin");
    const response = await deleteRoute(deleteRequest({ src: "/images/temple/../../secret.jpg" }));
    expect(response.status).toBe(403);
    expect(fs.existsSync(outside)).toBe(true);
  });

  test("rejects a symlink escape and leaves the target", async () => {
    const outside = path.join(tmpRoot, "outside.jpg");
    fs.writeFileSync(outside, "secret");
    fs.symlinkSync(outside, path.join(imagesRoot, "link.jpg"));
    authorized("super_admin");
    const response = await deleteRoute(deleteRequest({ src: "/images/temple/link.jpg" }));
    expect(response.status).toBe(403);
    expect(fs.existsSync(outside)).toBe(true);
  });

  test("rejects a non-JSON body", async () => {
    authorized("super_admin");
    const request = new NextRequest("http://localhost/api/gallery/local-assets", {
      method: "DELETE",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const response = await deleteRoute(request);
    expect(response.status).toBe(400);
  });
});
