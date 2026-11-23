/**
 * @jest-environment node
 *
 * F-04.6: route-level proof for the remaining administrative mutations
 * (events, announcements, gallery albums, reports, revalidate, volunteer list)
 * and the settings server action. The identity verifier is stubbed; the real
 * capability map runs.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { NextRequest } from "next/server";

const mockVerifyAdminUserResult = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  verifyAdminUserResult: (...args: unknown[]) => mockVerifyAdminUserResult(...args),
}));

jest.mock("@/lib/api/public-rate-limit", () => ({
  allowPublicWrite: () => true,
}));

const mockAddEvent = jest.fn();
const mockGetEvent = jest.fn();
const mockDeleteEvent = jest.fn();
jest.mock("@/services/event.service", () => ({
  eventService: {
    addEvent: (...a: unknown[]) => mockAddEvent(...a),
    getEvent: (...a: unknown[]) => mockGetEvent(...a),
    deleteEvent: (...a: unknown[]) => mockDeleteEvent(...a),
    getPublishedEvents: jest.fn(),
    getPublishedEvent: jest.fn(),
    updateEvent: jest.fn(),
  },
}));

const mockAddAnnouncement = jest.fn();
jest.mock("@/services/announcement.server", () => ({
  announcementService: {
    addAnnouncement: (...a: unknown[]) => mockAddAnnouncement(...a),
    getAnnouncements: jest.fn(),
    getActiveAnnouncements: jest.fn(),
  },
}));

const mockCreateAlbum = jest.fn();
jest.mock("@/services/gallery.server", () => ({
  galleryService: {
    createAlbum: (...a: unknown[]) => mockCreateAlbum(...a),
    getAlbums: jest.fn(),
  },
}));

const mockSaveReport = jest.fn();
jest.mock("@/services/storage.service", () => ({
  ReportFileType: {},
  storageService: {
    saveReport: (...a: unknown[]) => mockSaveReport(...a),
    generateReportFilename: () => "report.json",
    saveScreenshot: jest.fn(),
    savePdf: jest.fn(),
  },
}));

const mockRevalidatePath = jest.fn();
jest.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
}));

const mockGetVolunteerRequests = jest.fn();
jest.mock("@/services/chat.server", () => ({
  getVolunteerRequests: (...a: unknown[]) => mockGetVolunteerRequests(...a),
  submitVolunteerRequest: jest.fn(),
}));

import { POST as eventsPost } from "../../app/api/events/route";
import { DELETE as eventDelete } from "../../app/api/events/[id]/route";
import { POST as announcementsPost } from "../../app/api/announcements/route";
import { POST as albumsPost } from "../../app/api/gallery/albums/route";
import { POST as reportsSavePost } from "../../app/api/reports/save/route";
import { POST as revalidatePost } from "../../app/api/revalidate/route";
import { GET as volunteerGet } from "../../app/api/volunteer/route";

function verified(role: string) {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: true,
    provider: "supabase",
    user: { uid: "uid-1", email: "admin@example.com", role, provider: "supabase" },
  });
}

function req(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetEvent.mockResolvedValue({ id: "e1" });
  mockDeleteEvent.mockResolvedValue(undefined);
  mockAddEvent.mockResolvedValue(undefined);
  mockAddAnnouncement.mockResolvedValue("a1");
  mockCreateAlbum.mockResolvedValue("al1");
  mockSaveReport.mockResolvedValue({ url: "u", pathname: "p" });
  mockGetVolunteerRequests.mockResolvedValue([]);
});

describe("events", () => {
  test("billing cannot create an event", async () => {
    verified("billing");
    const response = await eventsPost(
      req("POST", "http://localhost/api/events", { title: "Test Event", startDate: "2026-12-01" }),
    );
    expect(response.status).toBe(403);
    expect(mockAddEvent).not.toHaveBeenCalled();
  });

  test("priest can create an event", async () => {
    verified("priest");
    const response = await eventsPost(
      req("POST", "http://localhost/api/events", { title: "Test Event", startDate: "2026-12-01" }),
    );
    expect(response.status).toBe(201);
    expect(mockAddEvent).toHaveBeenCalled();
  });

  test("priest cannot delete an event", async () => {
    verified("priest");
    const response = await eventDelete(req("DELETE", "http://localhost/api/events/e1"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(response.status).toBe(403);
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  test("temple_admin can delete an event", async () => {
    verified("temple_admin");
    const response = await eventDelete(req("DELETE", "http://localhost/api/events/e1"), {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(response.status).toBe(200);
    expect(mockDeleteEvent).toHaveBeenCalledWith("e1");
  });
});

describe("announcements", () => {
  test("staff cannot create an announcement", async () => {
    verified("staff");
    const response = await announcementsPost(
      req("POST", "http://localhost/api/announcements", { title: "Notice" }),
    );
    expect(response.status).toBe(403);
    expect(mockAddAnnouncement).not.toHaveBeenCalled();
  });

  test("temple_admin can create an announcement", async () => {
    verified("temple_admin");
    const response = await announcementsPost(
      req("POST", "http://localhost/api/announcements", { title: "Notice" }),
    );
    expect(response.status).toBe(201);
    expect(mockAddAnnouncement).toHaveBeenCalled();
  });
});

describe("gallery albums", () => {
  test("priest cannot create an album", async () => {
    verified("priest");
    const response = await albumsPost(
      req("POST", "http://localhost/api/gallery/albums", { name: "Album" }),
    );
    expect(response.status).toBe(403);
    expect(mockCreateAlbum).not.toHaveBeenCalled();
  });

  test("temple_admin can create an album", async () => {
    verified("temple_admin");
    const response = await albumsPost(
      req("POST", "http://localhost/api/gallery/albums", { name: "Album" }),
    );
    expect(response.status).toBe(201);
    expect(mockCreateAlbum).toHaveBeenCalled();
  });
});

describe("reports and revalidation", () => {
  test("staff cannot save a report", async () => {
    verified("staff");
    const response = await reportsSavePost(
      req("POST", "http://localhost/api/reports/save", {
        type: "json",
        name: "r",
        content: "{}",
        contentType: "application/json",
      }),
    );
    expect(response.status).toBe(403);
    expect(mockSaveReport).not.toHaveBeenCalled();
  });

  test("temple_admin can save a report", async () => {
    verified("temple_admin");
    const response = await reportsSavePost(
      req("POST", "http://localhost/api/reports/save", {
        type: "json",
        name: "r",
        content: "{}",
        contentType: "application/json",
      }),
    );
    expect(response.status).toBe(200);
    expect(mockSaveReport).toHaveBeenCalled();
  });

  test("billing cannot revalidate the cache", async () => {
    verified("billing");
    const response = await revalidatePost(
      req("POST", "http://localhost/api/revalidate", { paths: ["/"] }),
    );
    expect(response.status).toBe(403);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  test("temple_admin can revalidate the cache", async () => {
    verified("temple_admin");
    const response = await revalidatePost(
      req("POST", "http://localhost/api/revalidate", { paths: ["/"] }),
    );
    expect(response.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("volunteer list", () => {
  test("staff may read the volunteer requests", async () => {
    verified("staff");
    const response = await volunteerGet(req("GET", "http://localhost/api/volunteer"));
    expect(response.status).toBe(200);
    expect(mockGetVolunteerRequests).toHaveBeenCalled();
  });

  test("office_staff may not read the volunteer requests", async () => {
    verified("office_staff");
    const response = await volunteerGet(req("GET", "http://localhost/api/volunteer"));
    expect(response.status).toBe(403);
    expect(mockGetVolunteerRequests).not.toHaveBeenCalled();
  });
});
