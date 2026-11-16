# Firebase Documentation

> **Superseded (2026-11-16).** Firebase has been fully retired. Supabase is the only backend for
> authentication, database, profiles, storage, settings, analytics and Raya AI. This document is
> kept as a historical record of the Firestore schema that was migrated; it is **not** a
> description of the current system. See `docs/DATA-MODEL.md` for the current Supabase schema and
> `docs/audits/FIREBASE_RETIREMENT_AUDIT.md` for the retirement record. No application runtime code
> reads Firebase.

## Overview

The project **used to** use Firebase for backend services:
- **Firebase Authentication** - User authentication
- **Cloud Firestore** - Database
- **Firebase Storage** - File storage (images, videos)

---

## Firestore Collections

### 1. Users (`users`)
```typescript
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: "super_admin" | "temple_admin" | "priest" | "staff" | "volunteer" | "devotee";
  templeId: string;
  profileImage: string;
  isApproved: boolean;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2. Sevas (`sevas`)
```typescript
interface Seva {
  id: string;
  name: string;
  description: string;
  category: string;
  amount: number;
  duration: number;
  imageUrl: string;
  active: boolean;
  displayOrder: number;
}
```

### 3. Seva Bookings (`sevaBookings`)
```typescript
interface SevaBooking {
  id: string;
  sevaId: string;
  sevaTitle: string;
  sevaAmount: number;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  preferredDate: string;
  notes: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
}
```

### 4. Events (`events`)
```typescript
interface TempleEvent {
  title: string;
  description: string;
  location: string;
  startDate: Timestamp;
  endDate: Timestamp;
  startTime?: string;
  endTime?: string;
  featured: boolean;
  published: boolean;
  category?: string;
  imageUrl?: string;
  status: "Upcoming" | "Ongoing" | "Completed";
}
```

### 5. Gallery (`gallery`)
```typescript
interface GalleryItem {
  title: string;
  description?: string;
  type: "image" | "video";
  url: string;
  thumbnail?: string;
  category: string;
  tags: string[];
  featured: boolean;
  active: boolean;
}
```

### 6. Announcements (`announcements`)
```typescript
interface Announcement {
  title: string;
  content: string;
  type: "info" | "alert" | "event" | "festival" | "important";
  priority: number;
  active: boolean;
  publishedAt: Timestamp;
  expiresAt?: Timestamp;
}
```

### 7. Donations (`donations`)
```typescript
interface DonationRecord {
  donorName: string;
  email: string;
  phone: string;
  address: string;
  amount: number;
  purpose: string;
  campaignId: string;
  message: string;
  paymentMode: "cash" | "upi" | "bank_transfer" | "cheque" | "other";
  status: "pending" | "received" | "failed";
  receiptNumber: string;
  adminRemarks: string;
  collectedBy: string;
  collectedAt: string;
}
```

---

## Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## Setup

1. Create Firebase project
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Enable Storage
5. Add environment variables
