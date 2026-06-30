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

  isTempleOpen: true,

  heroPrimaryButton: "Book Seva",
  heroSecondaryButton: "Donate",

  footerCopyright: "",

  panchanga: {
    tithi: "",
    nakshatra: "",
    yoga: "",
    karana: "",
  },

  featuredSeva: {
    sevaId: "",
  },

  featuredFestivalRef: {
    eventId: "",
  },

  donationCTA: {
    title: "Support Rayara Math",
    description:
      "Help preserve our traditions through your generous contribution.",
    buttonText: "Donate Now",
  },
};

export const STATUS_TIMEOUT = 5000;

export const PAGE_TITLE = "Homepage Settings";

export const PAGE_DESCRIPTION =
  "Manage hero section, announcement, timings, Panchanga and donation content displayed on the public homepage.";
