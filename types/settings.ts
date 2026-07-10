export interface SiteSettings {
  id: string;
  templeName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  footerText?: string;
  welcomeMessage?: string;
  updatedAt?: any;
}

export type SiteSettingsPayload = Omit<SiteSettings, "id" | "updatedAt">;
