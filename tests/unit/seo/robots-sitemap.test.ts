import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { pageMetadata, SITE_URL } from "@/lib/seo";

describe("robots.txt", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

  it("allows crawling of public content", () => {
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
  });

  it("disallows the admin console, API routes and the auth-guarded seva module", () => {
    const disallow = rules.disallow as string[];
    expect(disallow).toContain("/admin/");
    expect(disallow).toContain("/api/");
    // Anchored so it never matches the public /sevas page.
    expect(disallow).toContain("/seva$");
    expect(disallow).toContain("/seva/");
    expect(disallow).not.toContain("/seva");
  });

  it("keeps the OAuth callback out of crawlers", () => {
    const disallow = rules.disallow as string[];
    // The callback carries a single-use PKCE code in its query string.
    expect(disallow).toContain("/auth/");
  });

  it("references the canonical sitemap on the production domain", () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  it("lists public routes on the canonical domain", () => {
    for (const path of ["/", "/events", "/sevas", "/donation", "/gallery", "/calendar/festivals", "/calendar/ekadashi", "/trust", "/facilities", "/contact"]) {
      expect(urls).toContain(`${SITE_URL}${path}`);
    }
  });

  it("never exposes admin, API, debug or user-private routes", () => {
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/admin(\/|$)/);
      expect(entry.url).not.toMatch(/\/api(\/|$)/);
      expect(entry.url).not.toMatch(/\/(debug|profile|receipts|favorites|search)(\/|$)/);
      expect(entry.url).not.toMatch(/\/seva(\/|$)/);
    }
  });

  it("emits absolute URLs only", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });

  it("gives every entry a valid change frequency and priority", () => {
    const valid = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
    for (const entry of entries) {
      expect(valid).toContain(entry.changeFrequency);
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });
});

describe("pageMetadata", () => {
  it("builds canonical, Open Graph and Twitter metadata for a route", () => {
    const meta = pageMetadata({
      title: "Contact Us",
      description: "Reach the temple office.",
      path: "/contact",
    });

    expect(meta.title).toBe("Contact Us");
    expect(meta.description).toBe("Reach the temple office.");
    expect(meta.alternates?.canonical).toBe("/contact");
    expect(meta.openGraph?.url).toBe("/contact");
    expect(meta.openGraph?.title).toBe("Contact Us | Sri Raghavendra Swamy Matha");
    expect(meta.twitter?.card).toBe("summary_large_image");
  });

  it("uses an absolute title for the homepage so it skips the layout template", () => {
    const meta = pageMetadata({
      title: "Sri Raghavendra Swamy Matha",
      description: "Home.",
      path: "/",
      absolute: true,
    });

    expect(meta.title).toEqual({ absolute: "Sri Raghavendra Swamy Matha" });
  });

  it("keeps canonical paths relative so query strings and the apex host collapse to one URL", () => {
    const meta = pageMetadata({ title: "Events", description: "Events.", path: "/events" });
    expect(meta.alternates?.canonical).toBe("/events");
    expect(String(meta.alternates?.canonical)).not.toMatch(/^https?:/);
  });
});
