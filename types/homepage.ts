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

  isTempleOpen: boolean;

  heroPrimaryButton: string;
  heroPrimaryButtonLink: string;

  heroSecondaryButton: string;
  heroSecondaryButtonLink: string;

  footerCopyright: string;

  /**
   * Future Homepage CMS fields
   */

  panchanga?: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    karana: string;
  };

  featuredSeva?: {
    sevaId: string;
  };

  featuredFestivalRef?: {
    eventId: string;
  };

  donationCTA?: {
    title: string;
    description: string;
    buttonText: string;
  };

  updatedAt?: unknown;
}
