import { HomepageConfig } from "@/types/homepage";

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  heroTitle: "Welcome to Rayara Math",
  heroSubtitle: "Experience devotion and tradition",
  heroImage: "",

  announcement: "",

  morningOpen: "06:00 AM",
  morningClose: "12:00 PM",

  eveningOpen: "05:00 PM",
  eveningClose: "08:30 PM",

  featuredFestival: "",
  festivalDate: "",

  donationTitle: "Support Rayara Math",
  donationSubtitle:
    "Your generous contribution helps preserve our traditions.",

  templeName: "Rayara Math",
  templeLocation: "",
  templeAddress: "",
  contactEmail: "",
  contactPhone: "",

  isTempleOpen: true,

  heroPrimaryButton: "Book Seva",
  heroSecondaryButton: "Donate",

  footerCopyright: "",

  // Hero Quick Info Cards
  todaySeva: "Daily Pooja Morning",
  todaySevaTime: "09:30 AM",
  featuredFestivalDescription: "Coming Soon",

  // Temple Timings Schedule
  morningSchedule: [
    "Suprabhata Seva",
    "Alankara",
    "Darshan",
    "Theertha & Prasada",
  ],
  eveningSchedule: [
    "Evening Pooja",
    "Mangalarati",
    "Darshan",
    "Temple Closing",
  ],

  // Festival Schedule
  festivalScheduleNote:
    "Temple timings may be extended during festivals, Raghavendra Swamygala Aaradhane, Navaratri and other special occasions. Please check announcements before visiting.",

  panchanga: {
    tithi: "",
    nakshatra: "",
    yoga: "",
    karana: "",
    rahuKalam: "",
    gulikaKalam: "",
    masa: "",
  },

  featuredSeva: {
    sevaId: "",
  },

  featuredFestivalRef: {
    eventId: "",
  },

  donationCTA: {
    title: "SUPPORT THE TEMPLE",
    subtitle: "Every Contribution Matters",
    items: [
      { id: "1", title: "Annadanam", amount: "501", description: "Sponsor prasada and meals for devotees visiting the temple." },
      { id: "2", title: "Goshala", amount: "1001", description: "Support the care and maintenance of our sacred cows." },
      { id: "3", title: "Temple Development", amount: "5001", description: "Contribute towards renovation and future development projects." },
    ],
    ctaTitle: "Be a Part of Divine Service",
    ctaDescription: "Every offering, regardless of its size, supports the temple's daily rituals, festivals and charitable activities for the benefit of all devotees.",
    ctaButtonText: "Donate Now",
  },
};

export const STATUS_TIMEOUT = 5000;

export const PAGE_TITLE = "Homepage Settings";

export const PAGE_DESCRIPTION =
  "Manage hero section, announcement, timings, Panchanga and donation content displayed on the public homepage.";
