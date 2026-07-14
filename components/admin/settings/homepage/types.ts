import { HomepageConfig } from "@/types/homepage";

export type HomepageFormData = HomepageConfig;

export interface HomepageSettingsProps {
  onSaved?: () => void;
}

export type HomepageValidationErrors = Partial<
  Record<
    | "heroTitle"
    | "heroSubtitle"
    | "heroImage"
    | "announcement"
    | "morningOpen"
    | "morningClose"
    | "eveningOpen"
    | "eveningClose"
    | "featuredFestival"
    | "festivalDate"
    | "donationTitle"
    | "donationSubtitle"
    | "templeName"
    | "templeLocation"
    | "templeAddress"
    | "contactEmail"
    | "contactPhone"
    | "heroPrimaryButton"
    | "heroSecondaryButton"
    | "footerCopyright",
    string
  >
>;
