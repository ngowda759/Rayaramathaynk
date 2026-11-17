# Project Structure Documentation

## Overview

Sri Raghavendra Swamy Temple website - a Next.js 14 application with a Supabase backend.

---

## Directory Structure

```
Rayaramathaynk/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (public)/                 # Public pages
│   │   ├── page.tsx             # Home page
│   │   ├── about/
│   │   ├── donation/
│   │   ├── events/
│   │   ├── gallery/
│   │   ├── sevas/
│   │   ├── pooja/
│   │   └── aaradhane/
│   ├── admin/                    # Admin dashboard
│   │   ├── page.tsx             # Dashboard
│   │   ├── bookings/
│   │   ├── sevas/
│   │   ├── events/
│   │   ├── gallery/
│   │   ├── announcements/
│   │   ├── users/
│   │   ├── donations/
│   │   ├── reports/
│   │   ├── timings/
│   │   ├── settings/
│   │   ├── pooja/
│   │   ├── aaradhane/
│   │   └── assistant/
│   ├── calendar/                 # Calendar pages
│   │   ├── page.tsx
│   │   ├── ekadashi/
│   │   └── festivals/
│   ├── api/                     # API routes
│   │   ├── admin/users/
│   │   │   ├── create-admin/
│   │   │   └── set-role/
│   │   └── gallery/
│   │       └── local-assets/
│   ├── layout.tsx               # Root layout
│   └── globals.css
│
├── components/                  # React components
│   ├── admin/                    # Admin-specific components
│   ├── auth/                    # Auth components
│   ├── calendar/                 # Calendar components
│   ├── chat/                    # Chatbot components
│   ├── common/                   # Shared components
│   ├── events/                   # Events components
│   ├── home/                     # Homepage components
│   ├── layout/                   # Layout components
│   ├── shared/                   # Shared utilities
│   └── ui/                      # UI primitives
│
├── context/                     # React contexts
│   └── AuthContext.tsx
│
├── hooks/                       # Custom hooks
│   ├── useAuth.ts
│   ├── useCrudTable.ts
│   ├── useDonationNotifications.ts
│   ├── useFinanceSettings.ts
│   ├── useGallery.ts
│   └── useHomepage.ts
│
├── lib/                         # Utilities
│   ├── supabase/                # Supabase clients (browser, server, admin)
│   ├── auth.ts                  # Auth utilities
│   ├── utils.ts                 # General utilities
│   ├── constants.ts             # Constants
│   ├── config.ts                # App config
│   ├── format.ts                # Formatting utilities
│   ├── options.ts               # Select options
│   ├── date.ts                  # Date utilities
│   ├── gallery.ts               # Gallery utilities
│   ├── sevas.ts                 # Sevas utilities
│   ├── crud-columns.tsx         # CRUD column definitions
│   ├── formStyles.ts            # Form styling
│   ├── panchanga-cache.ts       # Panchanga cache
│   └── settings/
│       └── temple.ts            # Temple settings
│
├── types/                       # TypeScript types
│   ├── announcement.ts
│   ├── calendar.ts
│   ├── crud.ts
│   ├── donation.ts
│   ├── donationCampaign.ts
│   ├── dashboard.ts
│   ├── finance.ts
│   ├── gallery.ts
│   ├── homepage.ts
│   ├── pooja.ts
│   ├── report.ts
│   ├── settings.ts
│   ├── seva-booking.ts
│   ├── temple.ts
│   ├── timing.ts
│   └── user.ts
│
├── public/                      # Static assets
│   ├── data/
│   │   └── panchanga/
│   │       └── current.json     # Daily panchanga
│   ├── images/
│   └── videos/
│
├── data/                        # Static data files
│   ├── calendar.ts              # Calendar data
│   └── panchanga/               # Historical panchanga
│
├── docs/                        # Documentation
│   ├── API.md
│   ├── PANCHANGA.md
│   └── PROJECT_STRUCTURE.md
│
├── scripts/                     # Utility scripts
│   ├── panchanga.py             # Panchanga CLI
│   └── generate_panchanga.py     # GitHub Actions script
│
├── .github/
│   └── workflows/
│       └── panchanga.yml        # Daily panchanga workflow
│
└── Configuration Files
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.js
    └── .env.example
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Hero.tsx`, `TempleMap.tsx` |
| Hooks | camelCase with `use` prefix | `useHomepage.ts`, `useAuth.ts` |
| Types | PascalCase | `User.ts`, `SevaBooking.ts` |
| Utilities | camelCase | `utils.ts`, `format.ts` |
| Constants | SCREAMING_SNAKE | `MAX_FILE_SIZE` |
| CSS Classes | Tailwind utilities | `className="text-amber-600"` |

---

## Page Routes

### Public Pages
| Route | Description |
|-------|-------------|
| `/` | Home page |
| `/about` | About the temple |
| `/donation` | Donation page |
| `/events` | Events listing |
| `/gallery` | Photo gallery |
| `/sevas` | Sevas (services) listing |
| `/pooja` | Pooja listings |
| `/aaradhane` | Aaradhane page |
| `/calendar` | Temple calendar |
| `/calendar/ekadashi` | Ekadashi schedule |
| `/calendar/festivals` | Festival list |

### Admin Pages
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard |
| `/admin/bookings` | Booking management |
| `/admin/sevas` | Seva management |
| `/admin/events` | Event management |
| `/admin/gallery` | Gallery management |
| `/admin/announcements` | Announcements |
| `/admin/users` | User management |
| `/admin/donations` | Donation records |
| `/admin/reports` | Reports & analytics |
| `/admin/timings` | Temple timings |
| `/admin/settings` | Settings |
| `/admin/pooja` | Pooja management |
| `/admin/aaradhane` | Aaradhane management |

### Auth Pages
| Route | Description |
|-------|-------------|
| `/login` | User login |
| `/register` | User registration |
| `/forgot-password` | Password reset |

---

## Environment Variables

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Chatbot (Optional)
NEXT_PUBLIC_CHATBOT_ID=
NEXT_PUBLIC_CHATBOT_LANGUAGE=en

# App
NEXT_PUBLIC_APP_URL=
```

---

## Tech Stack

| Category | Technology |
|---------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Icons | Lucide React |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| Deployment | Vercel |
| Calendar | Panchanga (Python) |
