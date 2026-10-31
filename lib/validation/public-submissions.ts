/**
 * Zod schemas for the public (non-admin) write endpoints.
 *
 * These cover the request bodies of `/api/events`, `/api/donations`,
 * `/api/bookings`, `/api/testimonials`, `/api/testimonials/devotee` and the
 * `/api/profile/*` routes. They exist so every public write is type-checked,
 * length-bounded and key-allow-listed before the service layer runs:
 *
 *  - `z.object` drops keys it does not declare, so a caller cannot smuggle
 *    privileged fields (status, approved, receiptNumber, ...) into an insert.
 *  - ids that a caller supplies (sevaId, itemId, bookmarkId, ...) are plain
 *    bounded strings, not attacker-chosen foreign keys that could be trusted as
 *    an ownership claim — ownership is always derived from the verified token.
 *
 * The module is pure: it imports only `zod`, so it is safe in either bundle.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Trimmed text of a bounded length. */
function text(min: number, max: number, label: string) {
  return z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`);
}

/** Optional text: absent, or trimmed and bounded (empty string allowed). */
function optionalText(max: number, label: string) {
  return z.string().trim().max(max, `${label} is too long`).optional();
}

/**
 * An optional email that may be the empty string (public forms treat email as
 * optional). A non-empty value must look like an address.
 */
const optionalEmail = z
  .string()
  .trim()
  .max(320, "Email is too long")
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "Enter a valid email address",
  })
  .optional()
  .default("");

/** A phone number: digits, spaces and the usual separators, bounded. */
const optionalPhone = z
  .string()
  .trim()
  .max(30, "Phone number is too long")
  .refine((value) => value === "" || /^[+()\-\s0-9]+$/.test(value), {
    message: "Enter a valid phone number",
  })
  .optional()
  .default("");

/** An http(s) URL or a site-relative path; the empty string is allowed. */
const optionalAssetUrl = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .refine((value) => value === "" || /^(https?:\/\/|\/)\S*$/i.test(value), {
    message: "Enter a valid URL",
  })
  .optional();

/** A string that parses as a date (ISO date-time, `YYYY-MM-DD`, or a Date string). */
function dateString(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: `${label} must be a valid date` });
}

/** A plain, bounded identifier supplied by the caller (an id, slug or code). */
function idString(max: number, label: string) {
  return z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
}

/** Money: a non-negative number, bounded to something a temple could plausibly receive. */
const moneyAmount = z.coerce
  .number()
  .refine((n) => Number.isFinite(n), { message: "Amount must be a number" })
  .positive({ message: "Amount must be greater than zero" })
  .max(10_000_000, { message: "Amount is too large" });

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const eventStatusSchema = z.enum(["Upcoming", "Ongoing", "Completed"]);

export const eventCreateSchema = z
  .object({
    title: text(1, 200, "Title"),
    description: z.string().trim().max(5000, "Description is too long").optional().default(""),
    location: z.string().trim().max(200, "Location is too long").optional().default(""),
    startDate: dateString("Start date").optional(),
    endDate: dateString("End date").optional(),
    /** Legacy alias for `startDate`, still accepted for backward compatibility. */
    date: dateString("Date").optional(),
    startTime: optionalText(20, "Start time"),
    endTime: optionalText(20, "End time"),
    featured: z.boolean().optional().default(false),
    published: z.boolean().optional().default(true),
    category: optionalText(100, "Category"),
    imageUrl: optionalAssetUrl,
    status: eventStatusSchema.optional().default("Upcoming"),
  })
  .refine((value) => Boolean(value.startDate || value.date), {
    message: "Start date is required",
    path: ["startDate"],
  })
  .refine(
    (value) => {
      const start = value.startDate ?? value.date;
      if (!start || !value.endDate) return true;
      return Date.parse(value.endDate) >= Date.parse(start);
    },
    { message: "End date cannot be before the start date", path: ["endDate"] }
  );

export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = z
  .object({
    title: text(1, 200, "Title").optional(),
    description: z.string().trim().max(5000, "Description is too long").optional(),
    location: z.string().trim().max(200, "Location is too long").optional(),
    startDate: dateString("Start date").optional(),
    endDate: dateString("End date").optional(),
    startTime: optionalText(20, "Start time"),
    endTime: optionalText(20, "End time"),
    featured: z.boolean().optional(),
    published: z.boolean().optional(),
    category: optionalText(100, "Category"),
    imageUrl: optionalAssetUrl,
    status: eventStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No supported fields were provided" });

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

export const paymentModeSchema = z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]);

export const donationCreateSchema = z.object({
  donorName: text(1, 150, "Donor name").optional(),
  /** Legacy alias for `donorName`. */
  name: text(1, 150, "Donor name").optional(),
  email: optionalEmail,
  phone: optionalPhone,
  address: z.string().trim().max(500, "Address is too long").optional().default(""),
  amount: moneyAmount,
  purpose: z.string().trim().max(200, "Purpose is too long").optional().default(""),
  campaignId: z.string().trim().max(100, "Campaign id is too long").optional().default(""),
  message: z.string().trim().max(2000, "Message is too long").optional().default(""),
  paymentMode: paymentModeSchema.optional().default("cash"),
}).refine((value) => Boolean(value.donorName || value.name), {
  message: "Donor name is required",
  path: ["donorName"],
});

export type DonationCreateInput = z.infer<typeof donationCreateSchema>;

// ---------------------------------------------------------------------------
// Seva bookings
// ---------------------------------------------------------------------------

export const bookingCreateSchema = z.object({
  sevaId: idString(200, "Seva id"),
  sevaTitle: z.string().trim().max(300, "Seva title is too long").optional().default(""),
  sevaAmount: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0, { message: "Seva amount must be zero or more" })
    .max(10_000_000, { message: "Seva amount is too large" })
    .optional()
    .default(0),
  userName: z.string().trim().max(200, "Name is too long").optional().default(""),
  userEmail: optionalEmail,
  userPhone: optionalPhone,
  gotra: z.string().trim().max(100, "Gotra is too long").optional().default(""),
  nakshatra: z.string().trim().max(100, "Nakshatra is too long").optional().default(""),
  raashi: z.string().trim().max(100, "Raashi is too long").optional().default(""),
  preferredDate: dateString("Preferred date"),
  notes: z.string().trim().max(1000, "Notes are too long").optional().default(""),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

/** The devotee's own payment declaration for their booking (self-service). */
export const bookingPaymentSchema = z.object({
  paymentReference: idString(120, "Payment reference"),
  paymentMethod: z.string().trim().max(60, "Payment method is too long").optional().default("UPI"),
});

/** An administrator's update to a booking (status and/or recorded payment). */
export const bookingAdminUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
  payment: z
    .object({
      paymentReference: idString(120, "Payment reference"),
      paymentStatus: z.enum(["pending", "completed", "failed"]),
      paymentMethod: z.string().trim().max(60, "Payment method is too long").optional().default("UPI"),
    })
    .optional(),
});

/** A devotee's self-service payment declaration for their own booking. */
export const bookingSelfPaymentSchema = z.object({ payment: bookingPaymentSchema });

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

/** Legacy AI-chat testimonial (`/api/testimonials`). */
export const chatTestimonialSchema = z.object({
  sessionId: z.string().trim().max(200, "Session id is too long").optional().default(""),
  name: text(1, 150, "Name"),
  city: z.string().trim().max(150, "City is too long").optional().default(""),
  experience: text(1, 3000, "Experience"),
  rating: z.coerce
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),
  permissionToPublish: z.boolean().optional().default(false),
});

/** Devotee testimonial (`/api/testimonials/devotee`). */
export const devoteeTestimonialSchema = z.object({
  name: text(1, 150, "Name"),
  location: z.string().trim().max(150, "Location is too long").optional().default(""),
  quote: text(1, 3000, "Testimonial"),
  phone: optionalPhone,
  /** A site-relative/remote URL, or a base64 data URL the server uploads. */
  image: z
    .string()
    .trim()
    .max(3_000_000, "Image is too large")
    .refine((value) => value === "" || /^(https?:\/\/|\/|data:image\/)/i.test(value), {
      message: "Image must be a URL or an image upload",
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const notificationPreferencesSchema = z
  .object({
    email: z.boolean(),
    push: z.boolean(),
    dailyPanchanga: z.boolean(),
    dailyQuote: z.boolean(),
    events: z.boolean(),
    festivals: z.boolean(),
    liveStream: z.boolean(),
    aaradhane: z.boolean(),
    announcements: z.boolean(),
  })
  .partial();

const devicePreferencesSchema = z
  .object({
    notificationsEnabled: z.boolean(),
    soundEnabled: z.boolean(),
    vibrationEnabled: z.boolean(),
    autoPlayVideo: z.boolean(),
    highQualityImages: z.boolean(),
  })
  .partial();

export const preferencesSchema = z.object({
  language: z.enum(["en", "kn", "sa"]).optional(),
  timezone: z.string().trim().max(100, "Timezone is too long").optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: notificationPreferencesSchema.optional(),
  device: devicePreferencesSchema.optional(),
});

export const bookmarkTypeSchema = z.enum([
  "event",
  "article",
  "gallery",
  "quote",
  "stotra",
  "video",
  "audio",
  "book",
]);

export const bookmarkSchema = z.object({
  type: bookmarkTypeSchema,
  itemId: idString(200, "Item id"),
  title: text(1, 300, "Title"),
  description: z.string().trim().max(1000, "Description is too long").optional(),
  thumbnail: optionalAssetUrl,
  url: z.string().trim().min(1, "URL is required").max(2048, "URL is too long"),
});

export const profileSaveSchema = z.object({
  name: z.string().trim().max(200, "Name is too long").optional(),
  email: optionalEmail,
  phone: optionalPhone,
  profileImage: optionalAssetUrl,
  bio: z.string().trim().max(2000, "Bio is too long").optional(),
  gotra: z.string().trim().max(100, "Gotra is too long").optional(),
  nakshatra: z.string().trim().max(100, "Nakshatra is too long").optional(),
  preferences: preferencesSchema.optional(),
  favorites: z.array(z.string().trim().min(1).max(200)).max(500, "Too many favorites").optional(),
  recentlyViewed: z.array(z.string().trim().min(1).max(200)).max(500, "Too many items").optional(),
  bookmarks: z.array(bookmarkSchema).max(500, "Too many bookmarks").optional(),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().max(200, "Name is too long").optional(),
    phone: optionalPhone,
    profileImage: optionalAssetUrl,
    bio: z.string().trim().max(2000, "Bio is too long").optional(),
    gotra: z.string().trim().max(100, "Gotra is too long").optional(),
    nakshatra: z.string().trim().max(100, "Nakshatra is too long").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No supported fields were provided" });

/** A single id used by favorites / recently-viewed. */
export const itemIdSchema = z.object({ itemId: idString(200, "Item id") });

/** A bookmark id used by bookmark deletion. */
export const bookmarkIdSchema = z.object({ bookmarkId: idString(200, "Bookmark id") });
