export interface HomepageConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;

  announcement: string;

  morningOpen: string;
  morningClose: string;

  eveningOpen: string;
  eveningClose: string;

  featuredFestival: string;
  festivalDate: string;

  donationTitle: string;
  donationSubtitle: string;

  templeName: string;
  templeLocation: string;
  templeAddress: string;
  contactEmail: string;
  contactPhone: string;
  footerCopyright: string;

  isTempleOpen: boolean;

  heroPrimaryButton: string;
  heroSecondaryButton: string;

  /**
   * Hero Quick Info Cards - Today's Seva & Festival
   */
  todaySeva: string;
  todaySevaTime: string;
  featuredFestivalDescription: string;

  /**
   * Temple Timings Schedule Items
   */
  morningSchedule: string[];
  eveningSchedule: string[];

  /**
   * Festival Schedule Note
   */
  festivalScheduleNote: string;

  /**
   * Future Homepage CMS fields
   * These are optional to remain backward compatible
   */

  panchanga?: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    karana: string;
    rahuKalam: string;
    gulikaKalam: string;
    masa: string;
  };

  featuredSeva?: {
    sevaId: string;
  };

  featuredFestivalRef?: {
    eventId: string;
  };

  donationCTA?: {
    title: string;
    subtitle: string;
    items: DonationItem[];
    ctaTitle: string;
    ctaDescription: string;
    ctaButtonText: string;
  };

  /**
   * Testimonials Section
   */
  testimonials?: Testimonial[];

  updatedAt?: any;
}

export interface DonationItem {
  id: string;
  title: string;
  amount: string;
  description: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  quote: string;
  years: string;
}
