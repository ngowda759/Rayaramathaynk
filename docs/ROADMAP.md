# Project Roadmap

**Project:** Sri Raghavendra Swamy Matha Website
**Last Updated:** 2026-07-19

---

## Overview

This document tracks the evolution of the Sri Raghavendra Swamy Matha website. It helps contributors understand the long-term vision and avoid short-sighted implementations.

---

## Version History

### v1.0 — Foundation ✅
*Completed: January 2025*

#### Core Website

| Feature | Status | Notes |
|---------|--------|-------|
| Public Website | ✅ | Responsive landing page |
| About Page | ✅ | Temple history, trust committee |
| Events Listing | ✅ | CRUD for admins |
| Gallery | ✅ | Image/video management |
| Seva Listings | ✅ | Service catalog |
| Donation Page | ✅ | UPI, bank transfer options |
| Contact Page | ✅ | Temple location, phone |
| Responsive Design | ✅ | Mobile-first approach |

#### Admin Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | ✅ | Overview stats |
| Events Management | ✅ | CRUD operations |
| Gallery Management | ✅ | Upload/delete |
| Seva Management | ✅ | Pricing, details |
| User Management | ✅ | Role-based access |
| Settings | ✅ | Timings, contact info |

---

### v1.5 — Intelligence ⭐
*Completed: July 2026*

#### AI Assistant (Raya AI)

| Feature | Status | Notes |
|---------|--------|-------|
| Chat Interface | ✅ | Web-based chat |
| Intent Detection | ✅ | 20+ intents |
| Multi-language | ✅ | English, Kannada, mixed |
| Knowledge Base | ✅ | Articles integration |
| Retrieval-First | ✅ | Firebase-backed responses |
| Unknown Logging | ✅ | Admin review queue |

#### Knowledge Center

| Feature | Status | Notes |
|---------|--------|-------|
| Article Management | ✅ | CRUD for admins |
| Categories | ✅ | History, philosophy, FAQ |
| Keyword Search | ✅ | Bilingual support |
| Content Guidelines | ✅ | This document! |

#### Enhancements

| Feature | Status | Notes |
|---------|--------|-------|
| Panchanga Integration | ✅ | Daily tithis, nakshatras |
| Aaradhane Schedule | ✅ | Daily worship schedule |
| Ekadashi Calendar | ✅ | Special days |
| Festival Listings | ✅ | Major celebrations |
| Email Notifications | ✅ | Booking confirmations |

---

### v2.0 — Experience 🚀
*In Progress*

#### Digital Temple Explorer

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Temple Map | 🔄 | High | Interactive floor plan |
| Point of Interest | 🔄 | High | Key locations, deities |
| Accessibility Info | 🔄 | Medium | Wheelchair access, facilities |
| Temple Timeline | 📋 | Low | Historical events map |

#### Festival Experience

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Festival Countdown | 📋 | High | Days until major festivals |
| Live Updates | 📋 | High | During Aradhana, etc. |
| Photo Highlights | 📋 | Medium | Auto-generate albums |
| Festival Guide | 📋 | Medium | What to expect |

#### Digital Dashboard

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Real-time Stats | 📋 | High | Visitor count, donations |
| Analytics Dashboard | 📋 | High | User behavior, popular pages |
| Revenue Reports | 📋 | Medium | Donation trends |
| AI Insights | 📋 | Medium | Conversation analytics |

---

### v2.5 — Community 💬
*Planned*

#### Devotee Portal

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Personal Profile | 📋 | High | My bookings, donations |
| Booking History | 📋 | High | All past sevas |
| Donation Receipts | 📋 | High | Download 80G certificates |
| Seva Reminders | 📋 | Medium | Calendar integration |

#### Community Features

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Testimonials | 📋 | High | Share experiences |
| Photo Submissions | 📋 | Medium | Devotee photos |
| Volunteer Portal | 📋 | Medium | Sign up for events |
| Community Forum | 📋 | Low | Q&A, discussions |

#### Communication

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Email Digest | 📋 | Medium | Weekly temple updates |
| SMS Notifications | 📋 | Medium | Booking reminders |
| Push Notifications | 📋 | Low | New events, festivals |

---

### v3.0 — Immersion 🌐
*Future Vision*

#### Virtual Tour

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| 360° Panoramas | 📋 | High | Key temple areas |
| VR Support | 📋 | Medium | Cardboard, Oculus |
| Audio Guide | 📋 | Medium | Narration in multiple languages |
| AR Features | 📋 | Low | Point phone at deity |

#### Mobile Experience

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Native App (iOS) | 📋 | High | App Store release |
| Native App (Android) | 📋 | High | Play Store release |
| Offline Mode | 📋 | Medium | View without internet |
| Widgets | 📋 | Low | Today's panchanga, aaradhane |

#### Advanced Features

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Audio Pujas | 📋 | Medium | Recorded mantras, slokas |
| Video Streaming | 📋 | Medium | Live darshan |
| Puja Booking | 📋 | Medium | Schedule personal pujas |
| Priest Connect | 📋 | Low | Video call with priests |

---

## Milestone Timeline

```
2025 Q1 ────────────────────────────────────────── v1.0 Foundation
│
2025 Q4 ────────────────────────────────────────── v1.0 Complete
│
2026 Q1 ────────────────────────────────────────── AI Infrastructure
│
2026 Q3 ────────────────────────────────────────── v1.5 Intelligence ⭐ (Now)
│
2027 Q1 ────────────────────────────────────────── v2.0 Experience
│
2027 Q2 ────────────────────────────────────────── Community Features
│
2027 Q4 ────────────────────────────────────────── v2.5 Community
│
2028 Q2 ────────────────────────────────────────── v3.0 Immersion
```

---

## Technical Roadmap

### Infrastructure

| Phase | Goal | Target |
|-------|------|--------|
| 1 | Multi-tenant support | v2.0 |
| 2 | CDN optimization | v2.0 |
| 3 | Edge caching | v2.5 |
| 4 | Database sharding | v3.0 |

### Performance

| Metric | Current | v2.0 Target | v3.0 Target |
|--------|---------|--------------|--------------|
| LCP | < 2.5s | < 2.0s | < 1.5s |
| FID | < 100ms | < 50ms | < 30ms |
| CLS | < 0.1 | < 0.05 | < 0.02 |
| Lighthouse | > 80 | > 90 | > 95 |

### Security

| Phase | Goal | Target |
|-------|------|--------|
| 1 | Basic hardening | v1.5 |
| 2 | Penetration testing | v2.0 |
| 3 | SOC2 compliance | v2.5 |
| 4 | Annual audit | v3.0 |

---

## Deprecation Notes

### v2.0 Deprecations

These will be removed in v2.0:

| Item | Removal Date | Replacement |
|------|-------------|-------------|
| `lib/legacy-api.ts` | 2027-03-01 | `lib/api/v2.ts` |
| Old dashboard | 2027-06-01 | New analytics |
| v1 AI model | 2027-09-01 | Improved model |

---

## Contribution Guidelines

When working on features, align with the roadmap:

1. **Check the roadmap** — Is this part of a planned version?
2. **Forward compatibility** — Will this scale with future features?
3. **No shortcuts** — Don't implement quick hacks that block future work
4. **Document decisions** — Why was this approach chosen?

### Feature Request Template

```markdown
## Feature: [Name]

**Version:** v[X.Y]
**Priority:** High/Medium/Low
**Effort:** S/M/L

### Problem
What problem does this solve?

### Solution
How does this fit into the roadmap?

### Dependencies
What else needs to be built first?

### Risks
What could go wrong?
```

---

*Document maintained by: Development Team*
*Next Review: 2026-10-01*
