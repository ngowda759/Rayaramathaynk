/**
 * The website footer settings document (`settings_documents.document_key = 'footer'`),
 * shared by the public footer, the admin editor and the public contact page so the
 * temple's contact details live in one place.
 *
 * The values are defaults only: the stored Supabase document (read through
 * `/api/public/settings/footer`) replaces them at runtime.
 */

export interface FooterLink {
  name: string;
  href: string;
}

export interface FooterSettings {
  templeName: string;
  templeSubtitle: string;
  logoUrl: string;
  address: string;
  phone: string;
  phone2: string;
  email: string;
  mapUrl: string;
  quickLinks: FooterLink[];
  sevasLinks: FooterLink[];
  calendarLinks: FooterLink[];
  copyrightText: string;
  currentYear: boolean;
}

export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  templeName: "Sri Raghavendra Swamy Matha",
  templeSubtitle: "Yelahanka New Town",
  logoUrl: "/images/logos/ynk_matha_logo.png",
  address: "Sri Rayara Matha, Yelahanka New Town, Bengaluru",
  phone: "+91 81234 70770",
  phone2: "",
  email: "ngowda759@gmail.com",
  mapUrl: "https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8",
  quickLinks: [
    { name: "Home", href: "/" },
    { name: "Aaradhane", href: "/aaradhane" },
    { name: "Facilities", href: "/facilities" },
    { name: "Guru Parampara", href: "/guruparampara" },
    { name: "Gallery", href: "/gallery" },
    { name: "Events", href: "/events" },
    { name: "About", href: "/about" },
    { name: "Shlokas", href: "/shlokas" },
  ],
  sevasLinks: [
    { name: "Daily Pooja", href: "/pooja" },
    { name: "Special Sevas", href: "/sevas" },
    { name: "Donate", href: "/donation" },
  ],
  calendarLinks: [
    { name: "Ekadasi Calendar", href: "/calendar/ekadashi" },
    { name: "Festival Calendar", href: "/calendar/festivals" },
  ],
  copyrightText: "All rights reserved",
  currentYear: true,
};
