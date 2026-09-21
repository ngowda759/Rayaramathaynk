/**
 * Pure Firestore -> Supabase row mappers.
 *
 * These live outside the executable scripts so the exact transforms used by the
 * real migration can be unit tested against fixtures, without a database or any
 * credentials.
 *
 * Contract for every mapper:
 *  - throw `ValidationError` when a NOT NULL destination column has no valid
 *    source value;
 *  - never invent a value (no `new Date()`, no placeholder email/boolean);
 *  - copy Firestore document IDs verbatim (they are arbitrary strings).
 */

import { FieldCoverageSpec, ValidationError, toIsoString } from "./migration-helpers";

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`Missing required field: ${field}`);
  }
  return value;
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Missing or invalid required field: ${field}`);
  }
  return value.map((v) => String(v));
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`Missing or invalid required numeric field: ${field}`);
  }
  return value;
}

function requireTimestamp(value: unknown, field: string): string {
  const iso = toIsoString(value);
  if (!iso) {
    throw new ValidationError(`Missing or invalid required timestamp: ${field}`);
  }
  return iso;
}

/** Copy a nullable timestamp only when the source actually has a valid value. */
function assignOptionalTimestamp(
  row: Record<string, any>,
  column: string,
  source: unknown,
  sourceField: string
): void {
  if (source === undefined || source === null) return;
  const iso = toIsoString(source);
  if (!iso) {
    throw new ValidationError(`Invalid timestamp for ${sourceField}: ${String(source)}`);
  }
  row[column] = iso;
}

// ---------------------------------------------------------------------------
// Content collections
// ---------------------------------------------------------------------------

export const CONTENT_FIELD_SPECS: Record<string, FieldCoverageSpec> = {
  users: {
    mapped: ["email", "displayName", "phoneNumber", "photoUrl", "role", "active", "name", "phone", "profileImage", "isActive"],
    transformed: ["createdAt", "updatedAt"],
    intentionallyExcluded: [
      { field: "uid", why: "Equals the document id, stored as firestore_id." },
      { field: "templeId", why: "Single-temple deployment; not in the users schema." },
      { field: "isApproved", why: "Not present in the users schema." },
      { field: "emailVerified", why: "Not present in the users schema." },
      { field: "lastLogin", why: "Not present in the users schema." },
    ],
  },
  profiles: {
    mapped: [
      "uid",
      "name",
      "email",
      "phone",
      "profileImage",
      "bio",
      "gotra",
      "nakshatra",
      "preferences",
      "favorites",
      "recentlyViewed",
      "bookmarks",
    ],
    transformed: ["createdAt", "updatedAt"],
  },
  donation_campaigns: {
    mapped: ["title", "description", "imageUrl", "suggestedAmount", "active", "displayOrder"],
    transformed: ["createdAt", "updatedAt"],
  },
  donations: {
    mapped: [
      "donorName",
      "email",
      "phone",
      "address",
      "amount",
      "purpose",
      "campaignId",
      "message",
      "paymentMode",
      "status",
      "receiptNumber",
      "adminRemarks",
      "collectedBy",
    ],
    transformed: ["collectedAt", "createdAt", "updatedAt"],
  },
  galleryAlbums: {
    mapped: ["title", "slug", "description", "coverImage", "active", "displayOrder"],
    transformed: ["createdAt", "updatedAt"],
  },
  galleryMedia: {
    mapped: [
      "albumId",
      "title",
      "description",
      "category",
      "type",
      "imagePath",
      "videoUrl",
      "altText",
      "isFeatured",
      "displayOrder",
      "tags",
      "uploadedBy",
    ],
    transformed: ["uploadedAt"],
  },
  testimonials: {
    mapped: [
      "name",
      "location",
      "quote",
      "years",
      "image",
      "phone",
      "approved",
      "rejected",
      "rejectionReason",
      "submittedBy",
    ],
    transformed: ["createdAt"],
  },
  aaradhane: {
    mapped: [
      "title",
      "guruName",
      "dates",
      "description",
      "significance",
      "rituals",
      "offerings",
      "imageUrl",
      "sevaDetails",
      "isUpcoming",
      "displayOrder",
      "createdBy",
    ],
    transformed: ["createdAt"],
  },
  volunteer_requests: {
    mapped: ["volunteerId", "name", "phone", "sex", "active", "address"],
    transformed: ["createdAt", "updatedAt"],
  },
};

export function mapUser(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    email: requireString(data.email, "email"),
    display_name: optionalString(data.displayName ?? data.name),
    phone_number: optionalString(data.phoneNumber ?? data.phone),
    photo_url: optionalString(data.photoUrl ?? data.profileImage),
    role: typeof data.role === "string" && data.role ? data.role : "user",
  };
  if (typeof data.active === "boolean") row.active = data.active;
  else if (typeof data.isActive === "boolean") row.active = data.isActive;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

export function mapProfile(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    uid: requireString(data.uid, "uid"),
    name: requireString(data.name, "name"),
    email: requireString(data.email, "email"),
    phone: optionalString(data.phone),
    profile_image: optionalString(data.profileImage),
    bio: optionalString(data.bio),
    gotra: optionalString(data.gotra),
    nakshatra: optionalString(data.nakshatra),
    preferences: data.preferences ?? {},
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    recently_viewed: Array.isArray(data.recentlyViewed) ? data.recentlyViewed : [],
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
  };

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

export function mapDonationCampaign(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    title: requireString(data.title, "title"),
    description: requireString(data.description, "description"),
    image_url: requireString(data.imageUrl, "imageUrl"),
    suggested_amount: requireNumber(data.suggestedAmount, "suggestedAmount"),
  };
  if (typeof data.active === "boolean") row.active = data.active;
  if (typeof data.displayOrder === "number") row.display_order = data.displayOrder;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

export function mapDonation(id: string, data: any): Record<string, any> {
  return {
    firestore_id: id,
    donor_name: requireString(data.donorName, "donorName"),
    email: requireString(data.email, "email"),
    phone: requireString(data.phone, "phone"),
    address: requireString(data.address, "address"),
    amount: requireNumber(data.amount, "amount"),
    purpose: requireString(data.purpose, "purpose"),
    // Verbatim Firestore document ID; never coerced to a UUID.
    campaign_id: optionalString(data.campaignId),
    message: typeof data.message === "string" ? data.message : "",
    payment_mode: requireString(data.paymentMode, "paymentMode"),
    status: requireString(data.status, "status"),
    receipt_number: requireString(data.receiptNumber, "receiptNumber"),
    admin_remarks: typeof data.adminRemarks === "string" ? data.adminRemarks : "",
    collected_by: requireString(data.collectedBy, "collectedBy"),
    collected_at: toIsoString(data.collectedAt),
  };
}

export function mapGalleryAlbum(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    title: requireString(data.title, "title"),
    slug: requireString(data.slug, "slug"),
    description: requireString(data.description, "description"),
    cover_image: requireString(data.coverImage, "coverImage"),
  };
  if (typeof data.active === "boolean") row.active = data.active;
  if (typeof data.displayOrder === "number") row.display_order = data.displayOrder;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

export function mapGalleryMedia(id: string, data: any): Record<string, any> {
  return {
    firestore_id: id,
    // Verbatim Firestore album document ID; never coerced to a UUID.
    album_id: optionalString(data.albumId),
    title: requireString(data.title, "title"),
    description: requireString(data.description, "description"),
    category: requireString(data.category, "category"),
    type: requireString(data.type, "type"),
    image_path: requireString(data.imagePath, "imagePath"),
    video_url: optionalString(data.videoUrl),
    alt_text: typeof data.altText === "string" ? data.altText : "",
    is_featured: typeof data.isFeatured === "boolean" ? data.isFeatured : false,
    display_order: typeof data.displayOrder === "number" ? data.displayOrder : 0,
    tags: Array.isArray(data.tags) ? data.tags : [],
    uploaded_by: requireString(data.uploadedBy, "uploadedBy"),
    uploaded_at: toIsoString(data.uploadedAt),
  };
}

export function mapTestimonial(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    name: requireString(data.name, "name"),
    location: requireString(data.location, "location"),
    quote: requireString(data.quote, "quote"),
    years: requireString(data.years, "years"),
    image: optionalString(data.image),
    phone: optionalString(data.phone),
    rejection_reason: optionalString(data.rejectionReason),
    submitted_by: optionalString(data.submittedBy),
  };
  if (typeof data.approved === "boolean") row.approved = data.approved;
  if (typeof data.rejected === "boolean") row.rejected = data.rejected;

  // created_at is nullable; never fabricate a submission date.
  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  return row;
}

export function mapAaradhane(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    title: requireString(data.title, "title"),
    guru_name: requireString(data.guruName, "guruName"),
    dates: requireStringArray(data.dates, "dates"),
    description: requireString(data.description, "description"),
    significance: requireString(data.significance, "significance"),
    rituals: Array.isArray(data.rituals) ? data.rituals.map(String) : [],
    offerings: Array.isArray(data.offerings) ? data.offerings.map(String) : [],
    image_url: requireString(data.imageUrl, "imageUrl"),
    seva_details: data.sevaDetails ?? [],
    created_by: requireString(data.createdBy, "createdBy"),
  };
  if (typeof data.isUpcoming === "boolean") row.is_upcoming = data.isUpcoming;
  if (typeof data.displayOrder === "number") row.display_order = data.displayOrder;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  return row;
}

export function mapVolunteerRequest(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    volunteer_id: requireString(data.volunteerId, "volunteerId"),
    name: requireString(data.name, "name"),
    phone: requireString(data.phone, "phone"),
    sex: requireString(data.sex, "sex"),
    address: requireString(data.address, "address"),
  };
  if (typeof data.active === "boolean") row.active = data.active;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

// ---------------------------------------------------------------------------
// AI collections
// ---------------------------------------------------------------------------

export const AI_FIELD_SPECS: Record<string, FieldCoverageSpec> = {
  chat_sessions: {
    mapped: ["userId", "messageCount", "lastMessage", "detectedLanguage"],
    transformed: ["createdAt", "updatedAt"],
    intentionallyExcluded: [
      { field: "messages", why: "Session summary; messages migrate from the messages collection." },
      { field: "lastIntent", why: "Conversational state not in the Supabase session schema." },
      { field: "lastTopic", why: "Conversational state not in the Supabase session schema." },
      { field: "preferredLanguage", why: "Conversational state not in the Supabase session schema." },
    ],
  },
  messages: {
    mapped: ["sessionId", "role", "content", "model", "latency", "detectedLanguage"],
    transformed: ["timestamp"],
  },
  unknown_questions: {
    mapped: [
      "question",
      "questionLower",
      "detectedIntent",
      "intent",
      "confidence",
      "language",
      "sessionId",
      "timesAsked",
      "status",
      "assignedTo",
      "reviewedBy",
      "response",
      "addedToKnowledgeArticleId",
      "notes",
    ],
    transformed: ["timestamp", "lastAsked", "reviewedAt"],
    intentionallyExcluded: [
      { field: "userAgent", why: "Not present in the Supabase unknown_questions schema." },
      { field: "ip", why: "Not present in the schema; personal data stays in Firestore." },
      { field: "expectedIntent", why: "Not present in the Supabase unknown_questions schema." },
      { field: "error", why: "Not present in the Supabase unknown_questions schema." },
      { field: "reviewed", why: "Superseded by the status column." },
      { field: "addedToKnowledge", why: "Superseded by added_to_knowledge_article_id." },
    ],
  },
  ai_intent_distribution: {
    mapped: ["intent", "category", "language", "confidence", "sessionId", "messageId"],
    transformed: ["timestamp"],
  },
  ai_latency_records: {
    mapped: [
      "totalLatency",
      "intentDetectionTime",
      "retrievalTime",
      "generationTime",
      "success",
      "errorType",
      "model",
      "sessionId",
    ],
    transformed: ["timestamp"],
    intentionallyExcluded: [
      { field: "messageId", why: "Not present in the ai_latency_records schema." },
      { field: "intent", why: "Not present in the ai_latency_records schema." },
    ],
  },
};

export function mapChatSession(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    user_id: optionalString(data.userId),
    // Domain default: a session with no recorded count has zero messages.
    message_count: typeof data.messageCount === "number" ? data.messageCount : 0,
    last_message: optionalString(data.lastMessage),
    detected_language: optionalString(data.detectedLanguage),
  };

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

export function mapChatMessage(id: string, data: any): Record<string, any> {
  return {
    firestore_id: id,
    session_id: requireString(data.sessionId, "sessionId"),
    role: requireString(data.role, "role"),
    content: typeof data.content === "string" ? data.content : "",
    timestamp: requireTimestamp(data.timestamp, "timestamp"),
    model: optionalString(data.model),
    latency: typeof data.latency === "number" ? data.latency : null,
    detected_language: optionalString(data.detectedLanguage),
  };
}

export function mapUnknownQuestion(id: string, data: any): Record<string, any> {
  const question = requireString(data.question, "question");
  return {
    firestore_id: id,
    question,
    question_lower: optionalString(data.questionLower) ?? question.toLowerCase(),
    detected_intent: optionalString(data.detectedIntent ?? data.intent),
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    language: optionalString(data.language),
    // The question's own timestamp; required, never "now".
    timestamp: requireTimestamp(data.timestamp, "timestamp"),
    session_id: optionalString(data.sessionId),
    // Domain default: first sighting of a question.
    times_asked: typeof data.timesAsked === "number" ? data.timesAsked : 1,
    status: typeof data.status === "string" && data.status ? data.status : "pending",
    assigned_to:
      typeof data.assignedTo === "string" && data.assignedTo ? data.assignedTo : "unassigned",
    last_asked: toIsoString(data.lastAsked),
    reviewed_by: optionalString(data.reviewedBy),
    reviewed_at: toIsoString(data.reviewedAt),
    response: optionalString(data.response),
    added_to_knowledge_article_id: optionalString(data.addedToKnowledgeArticleId),
    notes: optionalString(data.notes),
  };
}

export function mapIntentDistribution(id: string, data: any): Record<string, any> {
  return {
    firestore_id: id,
    intent: requireString(data.intent, "intent"),
    category: optionalString(data.category),
    language: optionalString(data.language),
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    timestamp: requireTimestamp(data.timestamp, "timestamp"),
    session_id: optionalString(data.sessionId),
    message_id: optionalString(data.messageId),
  };
}

export function mapLatencyRecord(id: string, data: any): Record<string, any> {
  if (typeof data.success !== "boolean") {
    throw new ValidationError("Missing required boolean field: success");
  }
  return {
    firestore_id: id,
    total_latency: requireNumber(data.totalLatency, "totalLatency"),
    // Each component is required; 0 would fabricate a measurement.
    intent_detection_time: requireNumber(data.intentDetectionTime, "intentDetectionTime"),
    retrieval_time: requireNumber(data.retrievalTime, "retrievalTime"),
    generation_time: requireNumber(data.generationTime, "generationTime"),
    timestamp: requireTimestamp(data.timestamp, "timestamp"),
    success: data.success,
    error_type: optionalString(data.errorType),
    model: optionalString(data.model),
    session_id: optionalString(data.sessionId),
  };
}

// ---------------------------------------------------------------------------
// Core collections
// ---------------------------------------------------------------------------

export const CORE_FIELD_SPECS: Record<string, FieldCoverageSpec> = {
  sevas: {
    mapped: ["name", "description", "category", "amount", "duration", "imageUrl", "active", "displayOrder"],
    transformed: ["createdAt", "updatedAt"],
  },
  dailyPoojas: {
    mapped: [
      "title",
      "description",
      "startTime",
      "duration",
      "category",
      "sevaAmount",
      "isActive",
      "displayOrder",
      "days",
      "notes",
      "createdBy",
    ],
    transformed: ["createdAt"],
  },
  events: {
    mapped: [
      "title",
      "description",
      "location",
      "startTime",
      "endTime",
      "featured",
      "published",
      "category",
      "imageUrl",
      "status",
    ],
    transformed: ["startDate", "endDate", "createdAt", "updatedAt"],
  },
};

export function mapSeva(id: string, data: any): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    name: requireString(data.name, "name"),
    description: requireString(data.description, "description"),
    category: requireString(data.category, "category"),
    amount: requireNumber(data.amount, "amount"),
    duration: requireNumber(data.duration, "duration"),
    image_url: optionalString(data.imageUrl),
  };
  if (typeof data.active === "boolean") row.active = data.active;
  if (typeof data.displayOrder === "number") row.display_order = data.displayOrder;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

export function mapDailyPooja(id: string, data: any): Record<string, any> {
  if (!Array.isArray(data.days)) {
    throw new ValidationError("Missing or invalid required field: days");
  }
  const row: Record<string, any> = {
    firestore_id: id,
    title: requireString(data.title, "title"),
    description: requireString(data.description, "description"),
    start_time: requireString(data.startTime, "startTime"),
    duration: requireString(data.duration, "duration"),
    category: requireString(data.category, "category"),
    seva_amount: requireNumber(data.sevaAmount, "sevaAmount"),
    days: data.days.map(String),
    notes: optionalString(data.notes),
    created_by: optionalString(data.createdBy),
  };
  if (typeof data.isActive === "boolean") row.is_active = data.isActive;
  if (typeof data.displayOrder === "number") row.display_order = data.displayOrder;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  return row;
}

export function mapEvent(id: string, data: any): Record<string, any> {
  const startDate = toIsoString(data.startDate);
  if (!startDate) {
    throw new ValidationError(`Missing or invalid required field 'startDate'`);
  }
  const endDate = toIsoString(data.endDate);
  if (!endDate) {
    throw new ValidationError(`Missing or invalid required field 'endDate'`);
  }

  const row: Record<string, any> = {
    firestore_id: id,
    title: requireString(data.title, "title"),
    description: requireString(data.description, "description"),
    location: requireString(data.location, "location"),
    start_date: startDate,
    end_date: endDate,
    start_time: optionalString(data.startTime),
    end_time: optionalString(data.endTime),
    category: optionalString(data.category),
    image_url: optionalString(data.imageUrl),
    status: requireString(data.status, "status"),
  };
  if (typeof data.featured === "boolean") row.featured = data.featured;
  if (typeof data.published === "boolean") row.published = data.published;

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}

// ---------------------------------------------------------------------------
// Settings documents
// ---------------------------------------------------------------------------

/**
 * Recursively convert Firestore-specific values (Timestamp, nested objects) into
 * JSON-safe equivalents so the complete document can be stored as JSONB.
 * Objects and arrays are walked, never dropped.
 */
export function toJsonSafe(value: any): any {
  if (value === null || value === undefined) return value ?? null;

  if (typeof value === "object") {
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    if (typeof value._seconds === "number" && typeof value._nanoseconds === "number") {
      return new Date(value._seconds * 1000).toISOString();
    }
    if (Array.isArray(value)) return value.map(toJsonSafe);

    const out: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = toJsonSafe(nested);
    }
    return out;
  }

  return value;
}

/** Fields whose presence identifies the main site-settings document. */
export const SITE_SETTINGS_SIGNATURES = ["templeName", "contactEmail"];

export function isSiteSettingsDoc(data: Record<string, any>): boolean {
  return SITE_SETTINGS_SIGNATURES.some((field) => {
    const value = data[field];
    return typeof value === "string" && value.length > 0;
  });
}

/**
 * Build a lossless settings_documents row: the entire source document is kept
 * in `data`, so no nested object or array can be dropped by normalisation.
 */
export function mapSettingsDocument(id: string, data: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {
    firestore_id: id,
    document_key: id,
    data: toJsonSafe(data),
    source_field_count: Object.keys(data).length,
  };

  assignOptionalTimestamp(row, "created_at", data.createdAt, "createdAt");
  assignOptionalTimestamp(row, "updated_at", data.updatedAt, "updatedAt");
  return row;
}
