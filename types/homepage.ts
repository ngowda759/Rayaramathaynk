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

  /**
   * Dashboard Configuration - Daily Spiritual Dashboard
   */
  dailyQuote?: {
    text: string;
    source: string;
  };

  dashboardFeaturedEvent?: {
    title: string;
    description: string;
    daysRemaining?: number;
    isOngoing?: boolean;
  };

  /**
   * Hero Stats Section - Configurable statistics below the hero buttons
   */
  heroStats?: {
    stat1Label: string;
    stat1Value: string;
    stat1Description: string;
    stat2Label: string;
    stat2Value: string;
    stat2Description: string;
    stat3Label: string;
    stat3Value: string;
    stat3Description: string;
  };

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
  image?: string; // Optional profile image URL
  phone?: string; // Optional phone number for contact
  approved?: boolean; // Whether the testimonial is approved for public display
  rejected?: boolean; // Whether the testimonial has been rejected
  rejectionReason?: string; // Reason for rejection if rejected
  submittedBy?: 'admin' | 'public'; // Who submitted this testimonial
  createdAt?: number | Date; // For local storage sorting
}

// Form data for public testimonial submission
export interface TestimonialSubmission {
  name: string;
  location: string;
  quote: string;
  phone?: string;
  image?: string; // Base64 encoded image data URL
}
