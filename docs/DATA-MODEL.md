# Data Model Documentation

**Project:** Sri Raghavendra Swamy Matha Website
**Last Updated:** 2026-07-19

---

## Overview

This document describes the Firestore data model, including collections, schemas, relationships, and indexes. It answers: "How is data structured?"

---

## Database Overview

### Firebase Services

| Service | Purpose |
|---------|---------|
| **Firestore** | Primary database for all application data |
| **Firebase Auth** | User authentication |
| **Firebase Storage** | File storage (images, videos, documents) |

### Database Rules

- Public read for non-sensitive data (timings, events, announcements)
- Authenticated read for user-specific data
- Admin-only write for all collections
- Role-based access control via `role` field

---

## Collections

### 1. `users`

User profiles and authentication data.

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;                 // Required, unique
  name: string;                  // Display name
  phone?: string;                // Optional contact
  role: UserRole;                // Access level
  templeId: string;              // Associated temple
  profileImage?: string;         // Storage URL
  isApproved: boolean;           // Admin approval status
  isActive: boolean;            // Account status
  emailVerified: boolean;        // Email verification
  lastLogin?: Timestamp;         // Last login time
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type UserRole = 
  | "super_admin"      // Full access
  | "temple_admin"     // Temple management
  | "priest"           // Ritual management
  | "staff"            // Daily operations
  | "volunteer"        // Limited access
  | "devotee";         // Public user
```

**Indexes:**
- `email` (unique)
- `templeId, role`
- `isActive, role`

**Security:**
- Users can read/write own profile
- Admins can read/write all

---

### 2. `sevas`

Available sevas (services) at the temple.

```typescript
interface Seva {
  id: string;
  name: {
    en: string;
    kn: string;
  };
  description: {
    en: string;
    kn: string;
  };
  category: SevaCategory;
  amount: number;               // INR
  duration: number;              // Minutes
  imageUrl?: string;            // Storage URL
  active: boolean;              // Available for booking
  displayOrder: number;         // Sort order
  maxPerDay?: number;           // Daily limit
  requiresAdvanceBooking: boolean;
  bookingWindowDays: number;     // How far in advance
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type SevaCategory = 
  | "daily_pooja"
  | "special_pooja"
  | "homam"
  | "archana"
  | "seva"
  | "Others";
```

**Indexes:**
- `category, active, displayOrder`
- `active, displayOrder`

**Relationships:**
- Referenced by `sevaBookings.sevaId`

---

### 3. `sevaBookings`

Seva booking records.

```typescript
interface SevaBooking {
  id: string;
  sevaId: string;               // Reference to Seva
  sevaTitle: string;            // Denormalized name
  sevaAmount: number;            // Denormalized amount
  
  // Devotee info
  devoteeName: string;
  devoteeEmail: string;
  devoteePhone: string;
  gotra?: string;               // Hindu family lineage
  nakshatra?: string;           // Birth star
  
  // Booking details
  preferredDate: string;        // YYYY-MM-DD
  preferredTime?: string;       // HH:MM (optional)
  notes?: string;
  
  // Status
  status: BookingStatus;
  statusHistory: StatusChange[];
  
  // Payment
  paymentStatus: PaymentStatus;
  paymentId?: string;
  paymentMode?: PaymentMode;
  
  // Admin
  bookedBy: string;             // User ID who created
  confirmedBy?: string;          // Admin who confirmed
  confirmedAt?: Timestamp;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type BookingStatus = 
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type PaymentStatus = 
  | "pending"
  | "paid"
  | "refunded"
  | "failed";

type PaymentMode = 
  | "cash"
  | "upi"
  | "card"
  | "netbanking"
  | "bank_transfer";

interface StatusChange {
  from: BookingStatus;
  to: BookingStatus;
  changedBy: string;
  changedAt: Timestamp;
  reason?: string;
}
```

**Indexes:**
- `sevaId, preferredDate`
- `devoteeEmail, preferredDate`
- `status, preferredDate`
- `createdAt, status`

**Relationships:**
- References `sevas.id`
- References `users.id`

---

### 4. `events`

Temple events and festivals.

```typescript
interface TempleEvent {
  id: string;
  title: {
    en: string;
    kn: string;
  };
  description: {
    en: string;
    kn: string;
  };
  
  // Location
  location: string;
  
  // Timing
  startDate: Timestamp;
  endDate: Timestamp;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  
  // Classification
  category: EventCategory;
  type: EventType;
  
  // Media
  imageUrl?: string;
  videoUrl?: string;
  
  // Display
  featured: boolean;
  published: boolean;
  displayOrder: number;
  
  // Status
  status: EventStatus;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type EventCategory = 
  | "festival"
  | "pooja"
  | "lecture"
  | "cultural"
  | "special"
  | "regular";

type EventType = 
  | "upcoming"
  | "ongoing"
  | "completed";

type EventStatus = 
  | "draft"
  | "published"
  | "cancelled";
```

**Indexes:**
- `status, published, startDate`
- `featured, published`
- `category, published, startDate`

---

### 5. `gallery`

Photo and video gallery items.

```typescript
interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  
  // Media
  type: MediaType;
  url: string;                   // Storage URL
  thumbnailUrl?: string;         // For videos
  
  // Organization
  category: GalleryCategory;
  tags: string[];
  
  // Display
  featured: boolean;
  active: boolean;
  displayOrder: number;
  
  // Metadata
  uploadedBy: string;           // User ID
  uploadedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type MediaType = "image" | "video";

type GalleryCategory = 
  | "temple"
  | "events"
  | "festivals"
  | "priests"
  | "architecture"
  | "rituals"
  | " devotees"
  | "other";
```

**Indexes:**
- `category, active, displayOrder`
- `featured, active`

---

### 6. `announcements`

Public announcements and notices.

```typescript
interface Announcement {
  id: string;
  title: string;
  content: string;
  
  // Classification
  type: AnnouncementType;
  priority: number;              // Higher = more important
  
  // Display
  active: boolean;
  pinned: boolean;
  
  // Timing
  publishedAt: Timestamp;
  expiresAt?: Timestamp;
  
  // Target
  targetAudience: Audience;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type AnnouncementType = 
  | "info"
  | "alert"
  | "event"
  | "festival"
  | "important"
  | "maintenance";

type Audience = 
  | "all"
  | "devotees"
  | "visitors"
  | "staff";
```

**Indexes:**
- `active, publishedAt`
- `type, active, priority`

---

### 7. `donations`

Donation records.

```typescript
interface Donation {
  id: string;
  
  // Donor info
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  donorAddress?: string;
  pan?: string;                  // For 80G
  
  // Donation details
  amount: number;                // INR
  purpose: DonationPurpose;
  campaignId?: string;           // For campaigns
  message?: string;
  
  // Payment
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  transactionId?: string;
  
  // Receipt
  receiptNumber: string;
  receiptUrl?: string;
  
  // 80G Certificate
  eligible80G: boolean;
  certificateNumber?: string;
  certificateUrl?: string;
  
  // Admin
  collectedBy?: string;
  collectedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  adminRemarks?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type DonationPurpose = 
  | "general"
  | "annadan"
  | "seva"
  | "donation_box"
  | "hundi"
  | "building_fund"
  | "trust_fund"
  | "festival"
  | "other";
```

**Indexes:**
- `donorEmail, createdAt`
- `paymentStatus, createdAt`
- `purpose, createdAt`
- `receiptNumber` (unique)

**Relationships:**
- References `donationCampaigns.id` (optional)

---

### 8. `donationCampaigns`

Active donation campaigns.

```typescript
interface DonationCampaign {
  id: string;
  title: {
    en: string;
    kn: string;
  };
  description: {
    en: string;
    kn: string;
  };
  
  // Goal
  goalAmount: number;
  currentAmount: number;         // Denormalized total
  
  // Dates
  startDate: Timestamp;
  endDate: Timestamp;
  active: boolean;
  
  // Media
  imageUrl?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `active, endDate`

---

### 9. `settings`

Temple settings and configuration.

```typescript
interface TempleSettings {
  id: string;                    // Always "main"
  
  // Basic info
  templeName: {
    en: string;
    kn: string;
  };
  templeAddress: string;
  templePhone: string;
  templeEmail: string;
  
  // Location
  coordinates: {
    lat: number;
    lng: number;
  };
  googleMapsUrl?: string;
  
  // Timings
  timings: {
    morningOpen: string;         // "05:30"
    morningClose: string;
    eveningOpen: string;
    eveningClose: string;
  };
  
  // Contact
  contactPerson?: string;
  emergencyPhone?: string;
  
  // Social
  socialLinks: {
    website?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  
  // Bank details (for donations)
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    branchName: string;
    ifscCode: string;
    upiId?: string;
  };
  
  // 80G
  tanNumber?: string;
  eightyGUrl?: string;
  
  updatedAt: Timestamp;
}
```

**Indexes:**
- No additional indexes needed (single document)

---

### 10. `knowledge`

Knowledge base articles for AI.

```typescript
interface KnowledgeArticle {
  id: string;
  
  // Content
  title: {
    en: string;
    kn: string;
  };
  content: {
    en: string;
    kn: string;
  };
  summary?: {
    en: string;
    kn: string;
  };
  
  // Organization
  category: KnowledgeCategory;
  tags: string[];
  
  // Search
  keywords: {
    en: string[];
    kn: string[];
  };
  
  // Display
  featured: boolean;
  active: boolean;
  
  // Metadata
  author: string;
  lastReviewed?: Timestamp;
  reviewedBy?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type KnowledgeCategory = 
  | "history"
  | "philosophy"
  | "guru_parampara"
  | "festivals"
  | "rituals"
  | "visiting"
  | "faq"
  | "other";
```

**Indexes:**
- `category, active`
- `active, keywords.en`
- `active, keywords.kn`
- `featured, active`

---

### 11. `chat_sessions`

AI chat session records.

```typescript
interface ChatSession {
  id: string;
  
  // User
  userId?: string;               // Anonymous if null
  sessionToken?: string;
  
  // Messages
  messages: ChatMessage[];
  
  // Context
  lastIntent?: string;
  lastLanguage?: string;
  
  // Stats
  messageCount: number;
  
  // Status
  status: "active" | "ended";
  
  createdAt: Timestamp;
  endedAt?: Timestamp;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  
  // AI metadata
  intent?: string;
  confidence?: number;
  source?: string;
  language?: string;
  
  timestamp: Timestamp;
}
```

**Indexes:**
- `userId, createdAt`
- `createdAt, status`

---

### 12. `aaradhane`

Aaradhane (deity worship schedule).

```typescript
interface Aaradhane {
  id: string;
  
  // Schedule
  dayOfWeek: number;             // 0 = Sunday, 6 = Saturday
  name: {
    en: string;
    kn: string;
  };
  description?: {
    en: string;
    kn: string;
  };
  
  // Timing
  startTime: string;             // "06:00"
  endTime: string;
  
  // Display
  active: boolean;
  displayOrder: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `dayOfWeek, active`
- `active, displayOrder`

---

### 13. `panchanga`

Daily panchanga (Hindu calendar) data.

```typescript
interface Panchanga {
  id: string;                    // Date in YYYY-MM-DD format
  date: string;
  
  // Calendar data
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  
  // Special days
  isFestival: boolean;
  festivalName?: string;
  isEkadashi: boolean;
  ekadashiName?: string;
  
  // Shubha/Ashubha
  rahuKaal: string;
  yamaganda: string;
  abhijitMuhurta?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `date` (unique)
- `isEkadashi, date`

---

### 14. `unknown_questions`

Questions that AI couldn't answer well.

```typescript
interface UnknownQuestion {
  id: string;
  
  // Question
  question: string;
  language: "en" | "kn" | "mixed";
  
  // AI response
  detectedIntent?: string;
  confidence?: number;
  aiResponse?: string;
  
  // Session
  sessionId?: string;
  userId?: string;
  
  // Review
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  
  // Resolution
  addedToKnowledge: boolean;
  knowledgeArticleId?: string;
  
  createdAt: Timestamp;
}
```

**Indexes:**
- `reviewed, createdAt`
- `addedToKnowledge, reviewed`

---

## Relationships Diagram

```
users (1) ←→ (N) users
   │
   ├──→ users (createdBy)
   ├──→ users (confirmedBy)
   ├──→ users (collectedBy)
   │
   └──→ (N) sevaBookings
              │
              └──→ (1) sevas
              
donations (N) ←→ (1) donationCampaigns
   │
   └──→ (N) users (collectedBy, approvedBy)

sevas (1) ←→ (N) sevaBookings

chat_sessions (1) ←→ (N) chat_messages
   │
   └──→ (1) users (userId)
```

---

## Validation Rules

### Required Fields

| Collection | Required Fields |
|------------|----------------|
| users | email, name, role |
| sevas | name, category, amount |
| sevaBookings | devoteeName, devoteeEmail, sevaId, preferredDate |
| events | title, startDate, endDate |
| donations | donorName, donorEmail, amount, purpose |
| announcements | title, content |

### Field Constraints

| Field | Constraint |
|-------|-----------|
| email | Valid email format |
| phone | 10 digits |
| amount | > 0 |
| date | YYYY-MM-DD format |
| time | HH:MM format |

---

*Document maintained by: Development Team*
