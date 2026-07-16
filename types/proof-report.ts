// Proof Report Types

export interface PageInfo {
  url: string;
  title: string;
  heading: string;
  metaTitle: string;
  metaDescription: string;
  visibleText: string;
  images: ImageInfo[];
  externalLinks: string[];
  internalLinks: string[];
  tables: string[];
  lists: string[];
  buttons: string[];
  forms: FormInfo[];
  contactInfo: ContactInfo;
}

export interface ImageInfo {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  isDecorative: boolean;
}

export interface FormInfo {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  required: boolean;
}

export interface ContactInfo {
  phones: string[];
  emails: string[];
  addresses: string[];
}

export interface ScreenshotInfo {
  pageUrl: string;
  screenshotPath: string;
  timestamp: Date;
}

export interface AccessibilityIssue {
  type: 'missing-alt' | 'empty-heading' | 'duplicate-heading' | 'long-paragraph' | 'broken-anchor' | 'missing-label';
  pageUrl: string;
  element?: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface SEOIssue {
  type: 'missing-title' | 'duplicate-title' | 'missing-meta-description' | 'large-image' | 'missing-og' | 'canonical-issue';
  pageUrl: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface LinkValidationResult {
  url: string;
  pageUrl: string;
  status: 'valid' | 'broken' | 'redirect' | 'external';
  statusCode?: number;
  redirectUrl?: string;
  error?: string;
}

export interface ImageValidationResult {
  src: string;
  pageUrl: string;
  status: 'valid' | 'broken' | 'missing' | 'oversized';
  altText?: string;
  size?: number;
  error?: string;
}

export interface ContentQualityIssue {
  type: 'duplicate-paragraph' | 'placeholder-text' | 'empty-page' | 'short-page' | 'repeated-content';
  pageUrl: string;
  severity: 'error' | 'warning';
  message: string;
  content?: string;
}

export interface TempleValidationIssue {
  type: 'missing-timings' | 'missing-poojas' | 'missing-seva-prices' | 'missing-contact' | 'missing-donation' | 'missing-festival' | 'missing-guru' | 'missing-brindavana' | 'missing-map' | 'missing-emergency';
  severity: 'error' | 'warning';
  message: string;
}

export interface SeedArticle {
  filename: string;
  slug: string;
  title: string;
  category: string;
  language: string;
  keywords: string[];
  summary: string;
  content: string;
  questions?: Array<{ q: string; a: string }>;
  approved: boolean;
  version: number;
  lastReviewed: string;
  reviewedBy: string;
  tags: string[];
}

export interface DatabaseContent {
  events: any[];
  announcements: any[];
  sevas: any[];
  poojas: any[];
  donations: any[];
  galleryAlbums: any[];
  galleryMedia: any[];
  settings?: any;
  homepage?: any;
}

export interface TempleEvent {
  id?: string;
  title: string;
  description: string;
  location: string;
  startDate: any;
  endDate: any;
  startTime?: string;
  endTime?: string;
  featured: boolean;
  published: boolean;
  category?: string;
  imageUrl?: string;
  status: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  link?: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Seva {
  id: string;
  name: string;
  description: string;
  category: string;
  amount: number;
  duration: number;
  imageUrl: string;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPooja {
  id: string;
  title: string;
  description: string;
  startTime: string;
  duration: string;
  category: string;
  sevaAmount: number;
  isActive: boolean;
  displayOrder: number;
  days: string[];
  notes: string;
  createdAt: string;
  createdBy: string;
}

export interface Donation {
  id: string;
  donorName: string;
  email: string;
  phone: string;
  address: string;
  amount: number;
  purpose: string;
  message: string;
  paymentMode: string;
  status: string;
  receiptNumber?: string;
  createdAt: string;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string;
  active: boolean;
  displayOrder: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface GalleryMedia {
  id: string;
  albumId: string;
  title: string;
  description: string;
  category: string;
  type: 'photo' | 'video';
  imagePath: string;
  altText: string;
  uploadedAt?: any;
  uploadedBy: string;
  isFeatured: boolean;
  displayOrder: number;
  tags: string[];
}

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
  todaySeva: string;
  todaySevaTime: string;
  featuredFestivalDescription: string;
  morningSchedule: string[];
  eveningSchedule: string[];
  festivalScheduleNote: string;
  panchanga?: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    karana: string;
    rahuKalam: string;
    gulikaKalam: string;
    masa: string;
  };
  updatedAt?: any;
}

export interface ProofReportSummary {
  totalPages: number;
  totalEvents: number;
  totalSevas: number;
  totalGalleryAlbums: number;
  totalGalleryImages: number;
  totalAnnouncements: number;
  totalAIArticles: number;
  totalScreenshots: number;
  brokenLinks: number;
  missingImages: number;
  seoIssues: number;
  accessibilityIssues: number;
  warnings: number;
  errors: number;
  generationDate: Date;
  gitCommitHash?: string;
  environment: string;
}

export interface ProofReportData {
  summary: ProofReportSummary;
  pages: PageInfo[];
  screenshots: ScreenshotInfo[];
  accessibilityIssues: AccessibilityIssue[];
  seoIssues: SEOIssue[];
  linkValidation: LinkValidationResult[];
  imageValidation: ImageValidationResult[];
  contentQualityIssues: ContentQualityIssue[];
  templeValidationIssues: TempleValidationIssue[];
  seedArticles: SeedArticle[];
  databaseContent: DatabaseContent;
  tableOfContents: TableOfContentsItem[];
}

export interface TableOfContentsItem {
  title: string;
  level: number;
  pageNumber: number;
  anchor?: string;
}
