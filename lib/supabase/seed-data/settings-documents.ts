/**
 * Fresh Supabase-native starter content for `settings_documents`.
 *
 * These are the admin-editable website settings documents that previously lived in
 * the Firestore `settings` collection (`aboutUs`, `facilities`, `trustCommittee`,
 * `futurePlans`, `poojaSchedule`, `festivalCalendar`, `ekadashiCalendar`, `footer`,
 * `homepage`). Each key matches the `DOCUMENT` constant the corresponding admin page
 * uses, so the seeded row is exactly what that page loads and saves.
 *
 * Content policy (see docs/CONTENT-GUIDELINES.md):
 *  - `verified`: facts already published in this repository's own data modules.
 *  - `placeholder`: unverified values the owner must supply. Each string is prefixed
 *    with `PLACEHOLDER - ` so a go-live check can find any that remain, mirroring the
 *    `SAMPLE - ` convention the seva seed already uses. No phone number, price,
 *    payment link, committee name or date is invented.
 *  - `generic`: reviewed, accurate, non-specific public descriptions.
 *
 * This module contains no secrets and no Firebase references.
 */

/** Every unverified string the owner must replace is prefixed with this marker. */
export const PLACEHOLDER_PREFIX = "PLACEHOLDER - ";

export interface SettingsDocumentSeed {
  documentKey: string;
  data: Record<string, unknown>;
}

export const SETTINGS_DOCUMENT_SEEDS: SettingsDocumentSeed[] = [
  {
    documentKey: "aboutUs",
    data: {
      templeName: "Sri Raghavendra Swamy Matha",
      templeNameKannada: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
      tagline: "A sacred place of devotion and tradition",
      taglineKannada: "ಭಕ್ತಿ ಮತ್ತು ಸಂಪ್ರದಾಯದ ಪವಿತ್ರ ಸ್ಥಳ",
      tagline2: "Yelahanka New Town, Bengaluru",
      heroImageUrl: "",
      sacredMotto: "Sri Guru Raghavendraya Namaha",
      aboutTitle: "About the Matha",
      aboutContent:
        "Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru, is a place of worship and devotion in the Madhwa tradition, dedicated to Sri Raghavendra Swamy. Devotees visit for darshan, daily pooja, and special sevas.",
      aboutContentKannada:
        "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ, ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್, ಬೆಂಗಳೂರು - ಮಧ್ವ ಸಂಪ್ರದಾಯದ ಪೂಜಾ ಹಾಗೂ ಭಕ್ತಿಯ ಸ್ಥಳವಾಗಿದ್ದು, ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರಿಗೆ ಸಮರ್ಪಿತವಾಗಿದೆ.",
      facilitiesTitle: "Facilities",
      facilities: [],
      activitiesTitle: "Temple Activities",
      activities: [],
      sevaTitle: "Sevas at the Matha",
      sevaContent:
        "Daily and special sevas are performed at the Matha. Please contact the temple office or use the seva counter for current seva details and bookings.",
      sevaContentKannada:
        "ಮಠದಲ್ಲಿ ನಿತ್ಯ ಹಾಗೂ ವಿಶೇಷ ಸೇವೆಗಳು ನಡೆಯುತ್ತವೆ. ಪ್ರಸ್ತುತ ಸೇವಾ ವಿವರಗಳಿಗಾಗಿ ದಯವಿಟ್ಟು ಮಠದ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
      sevaItems: [],
      resourcesTitle: "Resources",
      resourcesContent:
        "Devotional resources including prayers and stotras are available at the Matha.",
      visitTitle: "Visit Us",
      address: `${PLACEHOLDER_PREFIX}temple address to be confirmed by the office`,
      phone: "",
      phone2: "",
      email: "",
      communityTitle: "Join Our Community",
      communityContent:
        "We welcome all devotees to participate in our temple activities, events, and community gatherings.",
      communityContentKannada:
        "ನಾವು ಎಲ್ಲಾ ಭಕ್ತರನ್ನು ನಮ್ಮ ದೇವಸ್ಥಾನದ ಚಟುವಟಿಕೆಗಳು, ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಸಮುದಾಯ ಸಭೆಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಸ್ವಾಗತಿಸುತ್ತೇವೆ.",
      communityQuote:
        "May we all be protected, nourished, and blessed with strength together.",
      communityQuoteKannada:
        "ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ |",
      updatedAt: null,
    },
  },
  {
    documentKey: "facilities",
    data: {
      heroTitle: "Facilities",
      heroSubtitle: "Facilities available for devotees at the Matha",
      heroImageUrl: "",
      pageTitle: "Facilities",
      pageSubtitle: "Facilities available for devotees at the Matha",
      sectionTitle: "What We Offer",
      sectionSubtitle: `${PLACEHOLDER_PREFIX}facility descriptions to be confirmed by the office`,
      facilities: [],
      amenitiesTitle: "Amenities",
      amenitiesSubtitle: `${PLACEHOLDER_PREFIX}amenity list to be confirmed by the office`,
      amenities: [],
      updatedAt: null,
    },
  },
  {
    documentKey: "trustCommittee",
    data: {
      heading: "Trust Committee",
      headingKannada: "ಟ್ರಸ್ಟ್ ಸಮಿತಿ",
      subheading: `${PLACEHOLDER_PREFIX}committee details to be supplied by the owner`,
      subheadingKannada: "",
      members: [],
      updatedAt: null,
    },
  },
  {
    documentKey: "futurePlans",
    data: {
      heading: "Future Plans",
      headingKannada: "ಮುಂದಿನ ಯೋಜನೆಗಳು",
      subheading: `${PLACEHOLDER_PREFIX}approved future plans to be supplied by the owner`,
      subheadingKannada: "",
      plans: [],
      updatedAt: null,
    },
  },
  {
    documentKey: "poojaSchedule",
    data: {
      heading: "Daily Pooja Schedule",
      headingKannada: "ನಿತ್ಯ ಪೂಜಾ ವೇಳಾಪಟ್ಟಿ",
      items: [],
      note: `${PLACEHOLDER_PREFIX}pooja timings to be confirmed by the office`,
      updatedAt: null,
    },
  },
  {
    documentKey: "festivalCalendar",
    data: {
      heading: "Festival Calendar",
      headingKannada: "ಹಬ್ಬಗಳ ಪಂಚಾಂಗ",
      festivals: [],
      note: `${PLACEHOLDER_PREFIX}festival dates to be confirmed by the office`,
      updatedAt: null,
    },
  },
  {
    documentKey: "ekadashiCalendar",
    data: {
      heading: "Ekadashi Calendar",
      headingKannada: "ಏಕಾದಶಿ ಪಂಚಾಂಗ",
      ekadashis: [],
      note: `${PLACEHOLDER_PREFIX}ekadashi dates to be confirmed by the office`,
      updatedAt: null,
    },
  },
  {
    documentKey: "footer",
    data: {
      copyright: "Sri Raghavendra Swamy Matha",
      description:
        "Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru.",
      quickLinks: [
        { name: "Home", href: "/" },
        { name: "About", href: "/about" },
        { name: "Events", href: "/events" },
        { name: "Gallery", href: "/gallery" },
        { name: "Facilities", href: "/facilities" },
        { name: "Donate", href: "/donation" },
        { name: "Shlokas", href: "/shlokas" },
        { name: "Contact", href: "/contact" },
      ],
      updatedAt: null,
    },
  },
  {
    documentKey: "homepage",
    data: {
      heroTitle: "Sri Raghavendra Swamy Matha",
      heroSubtitle: "A sacred place of devotion and tradition.",
      heroImage: "",
      announcement: "",
      announcement2: "",
      morningOpen: "06:00 AM",
      morningClose: "01:00 PM",
      eveningOpen: "01:00 PM",
      eveningClose: "08:30 PM",
      featuredFestival: "",
      festivalDate: "",
      donationTitle: "Support the Matha",
      donationSubtitle:
        "Your generous contribution helps preserve our traditions.",
      templeName: "Sri Raghavendra Swamy Matha",
      templeLocation: "Yelahanka New Town, Bengaluru",
      templeAddress: `${PLACEHOLDER_PREFIX}temple address to be confirmed by the office`,
      contactEmail: "",
      contactPhone: "",
      footerCopyright: "Sri Raghavendra Swamy Matha",
      isTempleOpen: true,
      heroPrimaryButton: "Book Seva",
      heroSecondaryButton: "Donate",
      todaySeva: "",
      todaySevaTime: "",
      featuredFestivalDescription: "",
      morningSchedule: [
        "Suprabhata Seva",
        "Alankara",
        "Darshan",
        "Theertha & Prasada",
      ],
      eveningSchedule: ["Evening Pooja", "Mangalarati", "Darshan", "Temple Closing"],
      festivalScheduleNote:
        "Temple timings may be extended during festivals and other special occasions. Please check announcements before visiting.",
      updatedAt: null,
    },
  },
];
