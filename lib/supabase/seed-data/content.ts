/**
 * Fresh Supabase-native starter content for the content and configuration tables.
 *
 * Every record is created directly in Supabase. Nothing here reads Firebase or a
 * Firestore export. Content is split three ways (docs/CONTENT-GUIDELINES.md):
 *
 *  - verified   — already published in this repository's own data modules
 *                 (`data/shlokas.ts`, `types/temple-explorer.ts`, `seed/quotes-seed-data.json`,
 *                 `seed/ai/*.json`, `website-settings/temple.json`).
 *  - placeholder — unverified owner-supplied values, prefixed `PLACEHOLDER - `.
 *  - generic    — reviewed, accurate, non-specific public text.
 *
 * Stable identifiers are explicit (a slug, `firestore_id` seed key, or fixed uuid)
 * so re-running the seed upserts onto the same row instead of inserting a duplicate.
 * No phone number, price, payment link, date, committee name or testimonial is invented.
 */


export interface SeedRecord {
  /** Conflict target column; must be a unique key on the destination table. */
  conflict: string;
  row: Record<string, unknown>;
}

/** Verified temple identity, from `website-settings/temple.json` and the AI seed data. */
export const TEMPLE_NAME = "Sri Raghavendra Swamy Matha";
export const TEMPLE_LOCATION = "Yelahanka New Town, Bengaluru";
export const TEMPLE_STATE = "Karnataka";
export const TEMPLE_PINCODE = "560064";

// ---------------------------------------------------------------------------
// site_settings — the single public temple-identity row
// ---------------------------------------------------------------------------

export const SITE_SETTINGS_SEED: SeedRecord = {
  conflict: "firestore_id",
  row: {
    firestore_id: "seed-site-settings",
    temple_name: TEMPLE_NAME,
    // Left blank on purpose: the owner supplies the real address, email and phone.
    contact_email: "",
    contact_phone: "",
    address: `${TEMPLE_LOCATION}, ${TEMPLE_STATE} ${TEMPLE_PINCODE}`,
    footer_text: `© ${TEMPLE_NAME}`,
    welcome_message: "🙏 Namaskara! Welcome to " + TEMPLE_NAME + ".",
  },
};

// ---------------------------------------------------------------------------
// social_links — one row, every URL left empty for the owner
// ---------------------------------------------------------------------------

export const SOCIAL_LINKS_SEED: SeedRecord = {
  conflict: "firestore_id",
  row: {
    firestore_id: "seed-social-links",
    facebook: "",
    instagram: "",
    youtube: "",
    whatsapp: "",
    twitter: "",
    linkedin: "",
    map_url: "",
    show_facebook: true,
    show_instagram: true,
    show_youtube: true,
    show_whatsapp: true,
    show_twitter: false,
    show_linkedin: false,
    show_map: false,
  },
};

// ---------------------------------------------------------------------------
// announcements — one editable welcome record; no event date is invented
// ---------------------------------------------------------------------------

export const ANNOUNCEMENT_SEEDS: SeedRecord[] = [
  {
    conflict: "firestore_id",
    row: {
      firestore_id: "seed-announcement-welcome",
      title: "Welcome to " + TEMPLE_NAME,
      message:
        "Devotees are welcome for darshan and daily pooja. Please check this page for current announcements.",
      link: "",
      is_active: true,
      display_order: 1,
    },
  },
];

// ---------------------------------------------------------------------------
// daily_poojas — the devotional daily-seva schedule, verified from the repository's
// own seva data (`scripts/seed-poojas.ts`). Amounts are the published seva amounts.
// ---------------------------------------------------------------------------

const DAILY_POOJA_ROWS: Array<{
  key: string;
  title: string;
  description: string;
  startTime: string;
  duration: string;
  category: string;
  sevaAmount: number;
  displayOrder: number;
}> = [
  { key: "arati", title: "Arati", description: "Arati", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 20, displayOrder: 1 },
  { key: "archane-with-arati", title: "Archane with Arati", description: "Archane with Arati", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 50, displayOrder: 2 },
  { key: "panchamrutha", title: "Panchamrutha", description: "Panchamrutha", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 100, displayOrder: 3 },
  { key: "madhu-abhisheka", title: "Madhu Abhisheka", description: "Madhu Abhisheka", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 200, displayOrder: 4 },
  { key: "vahana-pooja", title: "Vahana Pooja", description: "Vahana Pooja", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 200, displayOrder: 5 },
  { key: "hastodaka", title: "Hastodaka", description: "Hastodaka", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 250, displayOrder: 6 },
  { key: "totillu-seva", title: "Totillu Seva", description: "Totillu Seva", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 250, displayOrder: 7 },
  { key: "padapooja", title: "Padapooja", description: "Padapooja", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 500, displayOrder: 8 },
  { key: "annadana-seve", title: "Annadana Seve", description: "Annadana Seve", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 500, displayOrder: 9 },
  { key: "anna-santharpana-seva", title: "Anna Santharpana Seva", description: "Anna Santharpana Seva", startTime: "07:00", duration: "30 mins", category: "Morning", sevaAmount: 2500, displayOrder: 10 },
  { key: "rathotsava", title: "Rathotsava", description: "Rathotsava", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, displayOrder: 11 },
  { key: "maha-pooja", title: "Maha Pooja", description: "Maha Pooja", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, displayOrder: 12 },
  { key: "satyanarayana-pooja", title: "Satyanarayana Pooja", description: "Satyanarayana Pooja", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1200, displayOrder: 13 },
];

export const DAILY_POOJA_SEEDS: SeedRecord[] = DAILY_POOJA_ROWS.map((p) => ({
  conflict: "firestore_id",
  row: {
    firestore_id: `seed-daily-pooja-${p.key}`,
    title: p.title,
    description: p.description,
    start_time: p.startTime,
    duration: p.duration,
    category: p.category,
    seva_amount: p.sevaAmount,
    is_active: true,
    display_order: p.displayOrder,
    days: ["All"],
    notes: "",
    created_by: "seed",
  },
}));

// ---------------------------------------------------------------------------
// donation_campaigns — one generic, owner-editable campaign. No amount or payment
// link is invented; the suggested amount is the repository's own default (501).
// ---------------------------------------------------------------------------

export const DONATION_CAMPAIGN_SEEDS: SeedRecord[] = [
  {
    conflict: "firestore_id",
    row: {
      firestore_id: "seed-donation-campaign-annadanam",
      title: "Annadanam",
      description:
        "Sponsor prasada and meals for devotees visiting the temple. Contact the temple office for details.",
      image_url: "",
      suggested_amount: 501,
      active: true,
      display_order: 1,
    },
  },
];

// ---------------------------------------------------------------------------
// gallery — one album and the repository's own local default images. Every image
// path is a real file under `public/images/temple/`, so nothing is a broken URL.
// ---------------------------------------------------------------------------

export const GALLERY_ALBUM_SEEDS: SeedRecord[] = [
  {
    conflict: "firestore_id",
    row: {
      firestore_id: "seed-gallery-album-temple",
      title: "Temple",
      slug: "temple",
      description: "Photographs from the Matha.",
      cover_image: "/images/temple/Ananda.jpg",
      active: true,
      display_order: 1,
    },
  },
];

const GALLERY_MEDIA_ROWS = [
  { key: "ananda", title: "Ananda - Divine Bliss", description: "Experience divine bliss at the temple", category: "Daily Pooja", path: "/images/temple/Ananda.jpg", alt: "Temple deity - Ananda", order: 1, tags: ["bliss", "deity"] },
  { key: "bhakti", title: "Bhakti - Devotion", description: "Devotees in prayer", category: "Daily Pooja", path: "/images/temple/Bhakti.jpg", alt: "Devotees in prayer", order: 2, tags: ["devotion", "prayer"] },
  { key: "prahallada", title: "Prahallada - Devotee of Lord Narayana", description: "Story of Prahallada's devotion", category: "Aaradhane", path: "/images/temple/Prahallada 1.jpg", alt: "Prahallada depiction", order: 3, tags: ["aaradhane", "narayana"] },
  { key: "prasada", title: "Prasada - Sacred Offering", description: "Prasada offered to the deity", category: "Special Sevas", path: "/images/temple/Prasada.jpg", alt: "Prasada offering", order: 4, tags: ["prasada", "offering"] },
  { key: "seva", title: "Seva - Service to God", description: "Devotees serving the temple", category: "Special Sevas", path: "/images/temple/Seva.jpg", alt: "Temple service", order: 5, tags: ["seva", "service"] },
  { key: "shraddha", title: "Shraddha - Faith", description: "Faith in the divine", category: "Daily Pooja", path: "/images/temple/Shraddha.jpg", alt: "Devotional faith", order: 6, tags: ["faith", "devotion"] },
  { key: "tapas", title: "Tapas - Spiritual Practice", description: "Spiritual austerity and practice", category: "Utsava", path: "/images/temple/Tapas.jpg", alt: "Spiritual practice", order: 7, tags: ["tapas", "spiritual"] },
];

export const GALLERY_MEDIA_SEEDS: SeedRecord[] = GALLERY_MEDIA_ROWS.map((m) => ({
  conflict: "firestore_id",
  row: {
    firestore_id: `seed-gallery-media-${m.key}`,
    album_id: "seed-gallery-album-temple",
    title: m.title,
    description: m.description,
    category: m.category,
    type: "photo",
    image_path: m.path,
    video_url: null,
    alt_text: m.alt,
    uploaded_by: "seed",
    is_featured: true,
    display_order: m.order,
    tags: m.tags,
  },
}));

// ---------------------------------------------------------------------------
// temple_areas — verified local temple-explorer content. Ids match the stable ids
// already used by `types/temple-explorer.ts`, so the public explorer is unchanged.
// ---------------------------------------------------------------------------

export const TEMPLE_AREA_SEEDS: SeedRecord[] = [
  {
    conflict: "id",
    row: {
      id: "garbhagriha",
      name: "Garbhagriha (Sanctum Sanctorum)",
      name_kannada: "ಗರ್ಭಗೃಹ",
      description:
        "The innermost sacred chamber housing the presiding deity of Lord Venkateshwara with Lord Rama and Sita",
      significance:
        "This is the most sacred part of the temple where the main deity is enshrined",
      icon: "🕉️",
      image_url: "",
      category: "sanctum",
      features: [
        "Main Deity: Lord Venkateshwara",
        "Sri Rama and Sita deities on either side",
        "Golden krubas (garlands) and ornaments",
        "Sacred sandal paste applied daily",
      ],
      best_time_to_visit: "5:30 AM - 12:00 PM",
      tips: [
        "Maintain silence in the sanctum",
        "Remove footwear before entry",
        "Offerings available at the counter",
      ],
      has360_view: false,
      order: 1,
    },
  },
  {
    conflict: "id",
    row: {
      id: "navagraha-shrine",
      name: "Navagraha Shrine",
      name_kannada: "ನವಗ್ರಹ ಸ್ಥಾನ",
      description:
        "Nine planetary deities arranged in a semi-circular arrangement representing the nine planets",
      significance:
        "Worshipping Navagrahas is believed to mitigate planetary afflictions",
      icon: "🌌",
      image_url: "",
      category: "sanctum",
      features: ["Surya (Sun)", "Chandra (Moon)", "Mangal (Mars)", "Budha (Mercury)", "Guru (Jupiter)", "Shukra (Venus)"],
      best_time_to_visit: "5:30 AM - 12:00 PM",
      tips: ["Circumambulate clockwise", "Offerings available at the counter"],
      has360_view: false,
      order: 2,
    },
  },
];

// ---------------------------------------------------------------------------
// testimonials — none. Devotee testimonials are not invented (rule 12). The table
// stays empty so the public page shows its own empty state until a real devotee
// testimonial is approved.
// ---------------------------------------------------------------------------

export const TESTIMONIAL_SEEDS: SeedRecord[] = [];

// ---------------------------------------------------------------------------
// members / volunteers — none. Roster entries are personal data the office supplies.
// ---------------------------------------------------------------------------

export const MEMBER_SEEDS: SeedRecord[] = [];
export const VOLUNTEER_SEEDS: SeedRecord[] = [];
