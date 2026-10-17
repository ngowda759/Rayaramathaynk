# M16 - Collection and table field catalogue
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- "What fields does collection X actually have?" - for all 64 Firestore collections and 21 Supabase tables
- "Who writes field Y and who reads it?" - every writer and reader carries `path:line`
- "Which collections have no TypeScript type at all, so the write site *is* the schema?" (19 of them)
- "Is this field declared in `types/`, or invented at a call site?"
- "Which fields are written but never read back?" (dead writes)
- "Which fields are read but never written?" (seed data, manual entry, or a bug)
- "Does `docs/DATA-MODEL.md` describe the collection the code actually uses?" (usually not)
- "What are the columns, defaults and RLS policies of Supabase table Z?"
- "Which Firestore collection does Supabase table Z mirror, and is anything using it?"
- "Where does the seva / booking / donation / event field list live?"
- "Why does the admin announcement filter use `active` but the service query use `isActive`?"
- "Which document ids exist under `settings/` and what is in each one?"
- "Which queries need a composite index that is not declared?"
- "Which collection is empty because the code writes to a differently-named twin?" (`chat_messages` vs `messages`, `aaradhane` vs `aaradhanes`, `unknown_questions` vs `ai_unknown_questions`)
- "If I add a field, which files must I touch, in what order?"
- "Which Supabase tables have a schema but no reader or writer in the app?"
- "Where is the receipt counter and what fields does it hold?"
- "Which fields disagree in name or case between the Firestore document and the Supabase column meant to replace it?"
- "How do I re-run the field harvester, and what does it miss?"
- "Which fields does the AI retrieval layer depend on?"

## Scope and method

This file is the field-level half of the data-model question. M11 lists collections, rules, indexes
and call sites and deliberately stopped short of fields
(`.claude/skills/temple-portal-expert/brain/M11-data-model-persistence-and-migration.md:425-430`
says the field list "is its TypeScript type ... plus the write payload"). This file resolves that
into an actual table per store. The collection and table lists are taken from M11 and not re-derived;
one collection M11 missed is added (`chat_messages`, Firestore - see Coverage).

**The harvester.** `.claude/state/inventory/fields.mjs` - plain Node, built-in modules only,
read-only, no network. Two modes:

```
node .claude/state/inventory/fields.mjs                     # writes .claude/state/inventory/fields.json
node .claude/state/inventory/fields.mjs --expand .claude/skills/temple-portal-expert/brain/M16-collection-field-catalogue.md
```

The second mode rewrites the tables in this file in place from `.claude/state/inventory/fields.json`, so every `path:line`
below comes from the harvest rather than from hand transcription. The `<!--FIELDS ...-->` /
`<!--COLUMNS ...-->` / `<!--INDEX ...-->` markers around each table are the placeholders it fills;
leave them in place or the tables stop regenerating.

What the first mode does, over 735 files under `app/ services/ lib/ hooks/ components/ scripts/
seed/ utils/ context/ data/ types/`:

1. resolves collection-name constants per file - `const COLLECTION_NAME = "sevaBookings"`, and
   object maps such as `COLLECTIONS.CHAT_MESSAGES` (`services/ai-analytics.service.ts:43-50`);
2. finds anchors - `collection(db, X)`, `doc(db, X, "<id>")`, `db.collection(X)`,
   `collectionGroup(db, X)`, `.from(X)`; a `doc(db, "settings", "aboutUs")` anchor also opens a
   per-document bucket `settings/aboutUs`;
3. takes a window around each anchor - the **whole file** when the file touches exactly one store
   (true for most services), otherwise 3 lines back and 45 forward, truncated at the next anchor
   belonging to a different store;
4. records a **write** for every top-level key of an object literal handed to
   `setDoc / addDoc / updateDoc / .set / .update / .add / .insert / .upsert`, and a **read** for
   `where('f'`, `orderBy('f'`, `.eq/.gt/.order(...)`, `.select('a,b')`, `data().f`, `<var>.f` where
   `<var>` was bound from a `.data()` call, and destructuring of a snapshot payload;
5. parses `types/**` plus `lib/ai/knowledge/types.ts` for declared interfaces, and
   `supabase/migrations/*.sql` for `CREATE TABLE`, `CREATE POLICY` and `CREATE INDEX`.

**What it cannot see.** Every table below carries the residue of these blind spots, so open the file
before acting on anything load-bearing:

- **Spread writes.** `addDoc(ref, { ...data, createdAt: serverTimestamp() })` yields exactly two
  field names. This is why `sevas`, `bills`, `dailyPoojas`, `members`, `volunteers`, `galleryAlbums`,
  `aaradhane` and `feedback` look almost write-free. For those the declared type is the truth, and
  the "read by" column is the practical field list.
- **Payloads passed through a variable.** `const messageData = { ... }; addDoc(ref, messageData)`
  (`services/chat.service.ts:91-101`) is invisible; so is `lib/receipt/admin.ts:138`.
- **Computed keys.** `` {[`pages.${data.path}`]: increment(1)} `` (`services/pageviews.service.ts:70`)
  and the dotted `trafficSources.*` / `deviceBreakdown.*` paths at `:59-60`.
- **Mappers far from the anchor in a multi-store file.** Single-store files are read whole, so most
  services are exact; multi-store files such as `lib/ai/ai-settings/repository.ts` leak fields
  across store boundaries - the `ai_settings` blocks showing up under `unknown_questions` are that
  leak, and the note on each affected collection says so.
- **Same-named stores share one bucket.** Firestore `unknown_questions` and the Supabase table of
  that name; likewise `sevas`, `events`, `chat_sessions`, `ai_latency_records`,
  `ai_intent_distribution`. The per-collection note says which writer belongs to which store.
  This is also why the `W`/`R` numbers on a Supabase row of the Index can be non-zero while its
  migration state reads "schema only, no app code" - those counts come from the Firestore twin.
  Twelve tables have **no `.from("<table>")` anywhere in the tree**, verified by grep on
  2026-09-19: `users`, `donations`, `profiles`, `testimonials`, `chat_sessions`, `chat_messages`,
  `donation_campaigns`, `volunteer_requests`, `gallery_albums`, `gallery_media`, `aaradhanes`,
  `seva_bookings`.
- **One-collection-per-line files leak across lines.** `app/admin/content/page.tsx:89-99` and
  `:119-121,168-169` are arrays with a *different* collection on each line, and the window spills
  one line either way. Six collections there carry cells that belong to a neighbour: verified
  attributions are `events` `date`:90 / `updatedAt`:119 / `active`:168, `announcements`
  `active`:92 / `updatedAt`:120, `gallery` count:93, `sevas` count:94, `poojas` count:95,
  `knowledge` `updatedAt`:121, `testimonials` `approved`:98, `volunteer_requests` count:99
  (unfiltered). Any cell in this file that disagrees with that list is bleed.
- **Seed JSON.** Fields that only ever arrive from `seed/ai/*.json`, `data/exports/*.json` or
  `quotes-seed-data.json` never appear as identifiers in the source tree and are not harvested.
- **`tests/` is not scanned**, so a field used only in a test does not appear.

Regex harvesting over- and under-matches. API noise (`count`, `onConflict`, `merge`, `ascending`,
`head`) is filtered inside the script. Fields marked `declared` were matched against a `types/`
interface; fields marked `not in the type` exist only at a call site and were spot-checked by hand
for the collections that carry business data.

## Index

`F` = fields catalogued (columns, for Supabase), `W` = write sites, `R` = read sites.

Three cautions on this table, added by verification. (1) On a **Firestore** row `F` is the
*harvested* field count, not the number of rows in that collection's table below - the tables also
carry type-declared fields with no call site, so `F` sums to 584 while the Firestore tables hold
844 rows. On a Supabase row `F` *is* the column count, and those sum to 277. (2) `W` and `R` on a
Supabase row are the shared-bucket counts of its Firestore twin; read the migration-state column,
not the numbers. (3) Wherever a subsection says "entry *n*" of `firestore.indexes.json`, *n* is the
**zero-based** array position (`entry 0` = `users` `role`+`createdAt`).

<!--INDEX fs | aaradhane | types/aaradhane.ts#Aaradhane | Firestore only;
fs | aaradhanes | types/aaradhane.ts#Aaradhane | duplicate of `aaradhane`;
fs | ai_intent_distribution | types/ai-analytics.ts#IntentDistributionRecord | FS write / SB read;
fs | ai_latency_records | types/ai-analytics.ts#LatencyRecord | FS write / SB read;
fs | ai_settings | types/ai-settings.ts#AISettings | Firestore only;
fs | ai_token_usage | types/ai-analytics.ts#TokenUsageRecord | Firestore only, no table;
fs | ai_unknown_questions | types/ai-analytics.ts#UnknownQuestionRecord | Firestore only, parallel name;
fs | announcements | types/announcement.ts#Announcement | Firestore only;
fs | articles | - | Firestore only, seed script only;
fs | bills | types/billing.ts#Bill | Firestore only, no table;
fs | bookmarks | types/profile.ts#Bookmark | Firestore only;
fs | chat_messages | - | empty twin of `messages`;
fs | chat_metrics | types/analytics.ts#ConversationMetric | Firestore only;
fs | chat_sessions | types/ai.ts#ChatSession | Firestore only;
fs | chatTraining | - | Firestore only;
fs | daily_page_stats | - | Firestore only;
fs | dailyPoojas | types/pooja.ts#DailyPooja | Firestore only, table unused;
fs | donation_campaigns | types/donationCampaign.ts#DonationCampaign | Firestore only;
fs | donations | types/donation.ts#DonationRecord | Firestore only;
fs | events | types/event.ts#TempleEvent | dual, diverging;
fs | featuredContent | - | Firestore only;
fs | feedback | types/ai.ts#ChatFeedback | Firestore only;
fs | futurePlans | - | rule only, no code;
fs | gallery | - | Firestore only, counted only;
fs | galleryAlbums | types/gallery.ts#GalleryAlbum | Firestore only;
fs | galleryMedia | types/gallery.ts#GalleryMedia | Firestore only;
fs | guruParampara | types/aaradhane-generator.ts#GuruParamparaCollection | Firestore only;
fs | homepage | types/homepage.ts#HomepageConfig | Firestore only;
fs | intent_feedback | - | Firestore only;
fs | intent_metrics | types/analytics.ts#IntentMetric | Firestore only;
fs | knowledge | lib/ai/knowledge/types.ts#KnowledgeArticle | Firestore only;
fs | knowledge_articles | - | rule only, no code;
fs | knowledge_audit_log | types/knowledge-workflow.ts#AuditLogEntry | Firestore only;
fs | knowledge_categories | - | rule only, no code;
fs | knowledge_committee_approvals | types/knowledge-workflow.ts#CommitteeApproval | Firestore only;
fs | knowledge_drafts | types/knowledge-workflow.ts#DraftArticle | Firestore only;
fs | knowledge_review_comments | types/knowledge-workflow.ts#ReviewComment | Firestore only;
fs | knowledge_versions | types/knowledge-workflow.ts#ArticleVersion | Firestore only;
fs | knowledge_workflow | types/knowledge-workflow.ts#WorkflowArticle | Firestore only;
fs | knowledge_workflow_actions | types/knowledge-workflow.ts#WorkflowAction | Firestore only;
fs | members | types/volunteer.ts#Member | Firestore only;
fs | messages | types/ai.ts#AIMessage | Firestore only;
fs | notifications | - | Firestore only;
fs | page_views | - | Firestore only, ~47k docs;
fs | panchanga | - | never in a database;
fs | poojas | - | Firestore only, counted only;
fs | profiles | types/profile.ts#DevoteeProfile | Firestore only;
fs | quotes | types/quote.ts#Quote | Firestore only, no table;
fs | receipts | types/receipt.ts#Receipt | Firestore only, no table;
fs | receiptSevas | types/receiptSeva.ts#ReceiptSeva | Firestore only, no table;
fs | sevaBookings | types/seva-booking.ts#SevaBooking | Firestore only, table unused;
fs | sevas | types/seva.ts#Seva | split brain: SB read / FS write;
fs | settings | types/settings.ts#SiteSettings | partly replaced by site_settings;
fs | system | - | Firestore only, server SDK;
fs | temple_areas | types/temple-explorer.ts#TempleArea | Supabase only, FS path unused;
fs | test | - | debug leftover;
fs | testimonials | types/homepage.ts#Testimonial | Firestore only;
fs | timings | - | Firestore only;
fs | trust | - | Firestore only, read by the AI;
fs | trustCommittee | - | rule only, no code;
fs | unknown_questions | types/analytics.ts#UnknownQuestion | both stores, different callers;
fs | users | types/user.ts#UserProfile | Firestore only;
fs | volunteer_requests | types/ai.ts#VolunteerRequest | Firestore only;
fs | volunteers | types/volunteer.ts#Volunteer | Firestore only;
sb | aaradhanes | - | schema only, no app code;
sb | ai_intent_distribution | - | read by the app, written in Firestore;
sb | ai_latency_records | - | read by the app, written in Firestore;
sb | chat_messages | - | schema only, no app code;
sb | chat_sessions | - | schema only, no app code;
sb | daily_poojas | - | script-populated, no reader;
sb | donation_campaigns | - | schema only, no app code;
sb | donations | - | schema only, no app code;
sb | events | - | read + written by the app (anon);
sb | gallery_albums | - | schema only, no app code;
sb | gallery_media | - | schema only, no app code;
sb | profiles | - | schema only, no app code;
sb | seva_bookings | - | schema only, no app code;
sb | sevas | - | read by the app, written in Firestore;
sb | site_settings | - | read (anon) + written (service role);
sb | social_links | - | read by the app, written by nobody;
sb | temple_areas | - | Supabase only, live;
sb | testimonials | - | schema only, no app code;
sb | unknown_questions | - | read + written by the app;
sb | users | - | schema only, no app code;
sb | volunteer_requests | - | schema only, no app code-->
| store | kind | type file | F | W | R | migration state | jump |
|---|---|---|---|---|---|---|---|
| `aaradhane` | Firestore | `types/aaradhane.ts#Aaradhane` | 10 | 2 | 9 | Firestore only | [→](#fs-aaradhane) |
| `aaradhanes` | Firestore | `types/aaradhane.ts#Aaradhane` | 1 | 0 | 1 | duplicate of `aaradhane` | [→](#fs-aaradhanes) |
| `ai_intent_distribution` | Firestore | `types/ai-analytics.ts#IntentDistributionRecord` | 11 | 10 | 12 | FS write / SB read | [→](#fs-ai_intent_distribution) |
| `ai_latency_records` | Firestore | `types/ai-analytics.ts#LatencyRecord` | 16 | 9 | 14 | FS write / SB read | [→](#fs-ai_latency_records) |
| `ai_settings` | Firestore | `types/ai-settings.ts#AISettings` | 2 | 1 | 1 | Firestore only | [→](#fs-ai_settings) |
| `ai_token_usage` | Firestore | `types/ai-analytics.ts#TokenUsageRecord` | 2 | 1 | 5 | Firestore only, no table | [→](#fs-ai_token_usage) |
| `ai_unknown_questions` | Firestore | `types/ai-analytics.ts#UnknownQuestionRecord` | 7 | 8 | 6 | Firestore only, parallel name | [→](#fs-ai_unknown_questions) |
| `announcements` | Firestore | `types/announcement.ts#Announcement` | 8 | 3 | 36 | Firestore only | [→](#fs-announcements) |
| `articles` | Firestore | **none** | 7 | 5 | 3 | Firestore only, seed script only | [→](#fs-articles) |
| `bills` | Firestore | `types/billing.ts#Bill` | 22 | 8 | 30 | Firestore only, no table | [→](#fs-bills) |
| `bookmarks` | Firestore | `types/profile.ts#Bookmark` | 4 | 0 | 6 | Firestore only | [→](#fs-bookmarks) |
| `chat_messages` | Firestore | **none** | 1 | 0 | 2 | empty twin of `messages` | [→](#fs-chat_messages) |
| `chat_metrics` | Firestore | `types/analytics.ts#ConversationMetric` | 2 | 2 | 0 | Firestore only | [→](#fs-chat_metrics) |
| `chat_sessions` | Firestore | `types/ai.ts#ChatSession` | 10 | 13 | 20 | Firestore only | [→](#fs-chat_sessions) |
| `chatTraining` | Firestore | **none** | 7 | 17 | 2 | Firestore only | [→](#fs-chattraining) |
| `daily_page_stats` | Firestore | **none** | 6 | 3 | 3 | Firestore only | [→](#fs-daily_page_stats) |
| `dailyPoojas` | Firestore | `types/pooja.ts#DailyPooja` | 12 | 4 | 35 | Firestore only, table unused | [→](#fs-dailypoojas) |
| `donation_campaigns` | Firestore | `types/donationCampaign.ts#DonationCampaign` | 8 | 3 | 9 | Firestore only | [→](#fs-donation_campaigns) |
| `donations` | Firestore | `types/donation.ts#DonationRecord` | 18 | 10 | 32 | Firestore only | [→](#fs-donations) |
| `events` | Firestore | `types/event.ts#TempleEvent` | 21 | 12 | 114 | dual, diverging | [→](#fs-events) |
| `featuredContent` | Firestore | **none** | 13 | 16 | 14 | Firestore only | [→](#fs-featuredcontent) |
| `feedback` | Firestore | `types/ai.ts#ChatFeedback` | 1 | 0 | 1 | Firestore only | [→](#fs-feedback) |
| `futurePlans` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-futureplans) |
| `gallery` | Firestore | **none** | 2 | 0 | 2 | Firestore only, counted only | [→](#fs-gallery) |
| `galleryAlbums` | Firestore | `types/gallery.ts#GalleryAlbum` | 5 | 3 | 5 | Firestore only | [→](#fs-galleryalbums) |
| `galleryMedia` | Firestore | `types/gallery.ts#GalleryMedia` | 10 | 4 | 16 | Firestore only | [→](#fs-gallerymedia) |
| `guruParampara` | Firestore | `types/aaradhane-generator.ts#GuruParamparaCollection` | 2 | 4 | 3 | Firestore only | [→](#fs-guruparampara) |
| `homepage` | Firestore | `types/homepage.ts#HomepageConfig` | 1 | 1 | 0 | Firestore only | [→](#fs-homepage) |
| `intent_feedback` | Firestore | **none** | 8 | 8 | 8 | Firestore only | [→](#fs-intent_feedback) |
| `intent_metrics` | Firestore | `types/analytics.ts#IntentMetric` | 7 | 5 | 9 | Firestore only | [→](#fs-intent_metrics) |
| `knowledge` | Firestore | `lib/ai/knowledge/types.ts#KnowledgeArticle` | 18 | 11 | 52 | Firestore only | [→](#fs-knowledge) |
| `knowledge_articles` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-knowledge_articles) |
| `knowledge_audit_log` | Firestore | `types/knowledge-workflow.ts#AuditLogEntry` | 8 | 1 | 11 | Firestore only | [→](#fs-knowledge_audit_log) |
| `knowledge_categories` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-knowledge_categories) |
| `knowledge_committee_approvals` | Firestore | `types/knowledge-workflow.ts#CommitteeApproval` | 8 | 10 | 14 | Firestore only | [→](#fs-knowledge_committee_approvals) |
| `knowledge_drafts` | Firestore | `types/knowledge-workflow.ts#DraftArticle` | 9 | 5 | 11 | Firestore only | [→](#fs-knowledge_drafts) |
| `knowledge_review_comments` | Firestore | `types/knowledge-workflow.ts#ReviewComment` | 8 | 9 | 10 | Firestore only | [→](#fs-knowledge_review_comments) |
| `knowledge_versions` | Firestore | `types/knowledge-workflow.ts#ArticleVersion` | 10 | 3 | 25 | Firestore only | [→](#fs-knowledge_versions) |
| `knowledge_workflow` | Firestore | `types/knowledge-workflow.ts#WorkflowArticle` | 19 | 18 | 51 | Firestore only | [→](#fs-knowledge_workflow) |
| `knowledge_workflow_actions` | Firestore | `types/knowledge-workflow.ts#WorkflowAction` | 7 | 7 | 9 | Firestore only | [→](#fs-knowledge_workflow_actions) |
| `members` | Firestore | `types/volunteer.ts#Member` | 2 | 3 | 1 | Firestore only | [→](#fs-members) |
| `messages` | Firestore | `types/ai.ts#AIMessage` | 6 | 0 | 7 | Firestore only | [→](#fs-messages) |
| `notifications` | Firestore | **none** | 14 | 9 | 9 | Firestore only | [→](#fs-notifications) |
| `page_views` | Firestore | **none** | 8 | 8 | 6 | Firestore only, ~47k docs | [→](#fs-page_views) |
| `panchanga` | Firestore | **none** | 0 | 0 | 0 | never in a database | [→](#fs-panchanga) |
| `poojas` | Firestore | **none** | 1 | 0 | 1 | Firestore only, counted only | [→](#fs-poojas) |
| `profiles` | Firestore | `types/profile.ts#DevoteeProfile` | 10 | 7 | 13 | Firestore only | [→](#fs-profiles) |
| `quotes` | Firestore | `types/quote.ts#Quote` | 25 | 7 | 32 | Firestore only, no table | [→](#fs-quotes) |
| `receipts` | Firestore | `types/receipt.ts#Receipt` | 2 | 0 | 4 | Firestore only, no table | [→](#fs-receipts) |
| `receiptSevas` | Firestore | `types/receiptSeva.ts#ReceiptSeva` | 3 | 2 | 1 | Firestore only, no table | [→](#fs-receiptsevas) |
| `sevaBookings` | Firestore | `types/seva-booking.ts#SevaBooking` | 19 | 15 | 39 | Firestore only, table unused | [→](#fs-sevabookings) |
| `sevas` | Firestore | `types/seva.ts#Seva` | 12 | 16 | 43 | split brain: SB read / FS write | [→](#fs-sevas) |
| `settings` | Firestore | `types/settings.ts#SiteSettings` | 89 | 16 | 267 | partly replaced by site_settings | [→](#fs-settings) |
| `system` | Firestore | **none** | 3 | 3 | 0 | Firestore only, server SDK | [→](#fs-system) |
| `temple_areas` | Firestore | `types/temple-explorer.ts#TempleArea` | 13 | 1 | 14 | Supabase only, FS path unused | [→](#fs-temple_areas) |
| `test` | Firestore | **none** | 2 | 2 | 0 | debug leftover | [→](#fs-test) |
| `testimonials` | Firestore | `types/homepage.ts#Testimonial` | 12 | 5 | 45 | Firestore only | [→](#fs-testimonials) |
| `timings` | Firestore | **none** | 6 | 0 | 6 | Firestore only | [→](#fs-timings) |
| `trust` | Firestore | **none** | 3 | 0 | 3 | Firestore only, read by the AI | [→](#fs-trust) |
| `trustCommittee` | Firestore | **none** | 0 | 0 | 0 | rule only, no code | [→](#fs-trustcommittee) |
| `unknown_questions` | Firestore | `types/analytics.ts#UnknownQuestion` | 24 | 38 | 37 | both stores, different callers | [→](#fs-unknown_questions) |
| `users` | Firestore | `types/user.ts#UserProfile` | 14 | 81 | 20 | Firestore only | [→](#fs-users) |
| `volunteer_requests` | Firestore | `types/ai.ts#VolunteerRequest` | 3 | 1 | 3 | Firestore only | [→](#fs-volunteer_requests) |
| `volunteers` | Firestore | `types/volunteer.ts#Volunteer` | 2 | 3 | 1 | Firestore only | [→](#fs-volunteers) |
| `aaradhanes` | Supabase | **none** | 15 | 0 | 1 | schema only, no app code | [→](#sb-aaradhanes) |
| `ai_intent_distribution` | Supabase | **none** | 9 | 10 | 12 | read by the app, written in Firestore | [→](#sb-ai_intent_distribution) |
| `ai_latency_records` | Supabase | **none** | 11 | 9 | 14 | read by the app, written in Firestore | [→](#sb-ai_latency_records) |
| `chat_messages` | Supabase | **none** | 9 | 0 | 2 | schema only, no app code | [→](#sb-chat_messages) |
| `chat_sessions` | Supabase | **none** | 8 | 13 | 20 | schema only, no app code | [→](#sb-chat_sessions) |
| `daily_poojas` | Supabase | **none** | 14 | 0 | 1 | script-populated, no reader | [→](#sb-daily_poojas) |
| `donation_campaigns` | Supabase | **none** | 10 | 3 | 9 | schema only, no app code | [→](#sb-donation_campaigns) |
| `donations` | Supabase | **none** | 16 | 10 | 32 | schema only, no app code | [→](#sb-donations) |
| `events` | Supabase | **none** | 16 | 12 | 114 | read + written by the app (anon) | [→](#sb-events) |
| `gallery_albums` | Supabase | **none** | 10 | 0 | 0 | schema only, no app code | [→](#sb-gallery_albums) |
| `gallery_media` | Supabase | **none** | 15 | 0 | 0 | schema only, no app code | [→](#sb-gallery_media) |
| `profiles` | Supabase | **none** | 16 | 7 | 13 | schema only, no app code | [→](#sb-profiles) |
| `seva_bookings` | Supabase | **none** | 21 | 0 | 0 | schema only, no app code | [→](#sb-seva_bookings) |
| `sevas` | Supabase | **none** | 12 | 16 | 43 | read by the app, written in Firestore | [→](#sb-sevas) |
| `site_settings` | Supabase | **none** | 10 | 6 | 8 | read (anon) + written (service role) | [→](#sb-site_settings) |
| `social_links` | Supabase | **none** | 18 | 0 | 15 | read by the app, written by nobody | [→](#sb-social_links) |
| `temple_areas` | Supabase | **none** | 16 | 1 | 14 | Supabase only, live - full CRUD, `W` undercounts (see note) | [→](#sb-temple_areas) |
| `testimonials` | Supabase | **none** | 13 | 5 | 45 | schema only, no app code | [→](#sb-testimonials) |
| `unknown_questions` | Supabase | **none** | 18 | 38 | 37 | read + written by the app | [→](#sb-unknown_questions) |
| `users` | Supabase | **none** | 10 | 81 | 20 | schema only, no app code | [→](#sb-users) |
| `volunteer_requests` | Supabase | **none** | 10 | 1 | 3 | schema only, no app code | [→](#sb-volunteer_requests) |
<!--END-->

## Firestore collections

One subsection per collection, alphabetical. Each carries four header lines - declared type, rule,
index, migration state - then the field table, then the notes that the table cannot express.

### fs `aaradhane`

**Declared type:** `types/aaradhane.ts#Aaradhane` (`types/aaradhane.ts:1`)  
**Rule:** `firestore.rules:125`  
**Index:** none  
**Migration:** Firestore only. The Supabase `aaradhanes` table exists but no app code touches it.

<!--FIELDS aaradhane | types/aaradhane.ts#Aaradhane-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | `services/aaradhane.service.ts:227` | - | declared |
| `createdBy` | `string` | yes | `services/aaradhane.service.ts:227` | - | declared |
| `dates` | `string[]` | yes | - | `lib/ai/retrieval/aaradhane.ts:37` | declared |
| `description` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:44` | declared |
| `displayOrder` | `number` | yes | - | `services/aaradhane.service.ts:164`<br>`lib/ai/retrieval/aaradhane.ts:66` | declared |
| `guruName` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:42` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | - | - | declared, **no call site** |
| `isUpcoming` | `boolean` | yes | - | - | declared, **no call site** |
| `offerings` | `string[]` | yes | - | `lib/ai/retrieval/aaradhane.ts:47` | declared |
| `rituals` | `string[]` | yes | - | `lib/ai/retrieval/aaradhane.ts:46` | declared |
| `sevaDetails` | `AaradhaneSeva[]` | yes | - | - | declared, **no call site** |
| `significance` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:45` | declared |
| `title` | `string` | yes | - | `lib/ai/retrieval/aaradhane.ts:41` | declared |
<!--END-->

The create payload is a spread (`services/aaradhane.service.ts:227-231`), so only `createdBy` and
`createdAt` are visible as writes; the real written shape is `Aaradhane` minus `id/createdAt/createdBy`.
`updateAaradhane` (`:241`) passes the caller's object straight through with no `updatedAt`, so
aaradhane documents have no modification timestamp at all. The reader that matters is the AI
retriever, `lib/ai/retrieval/aaradhane.ts:37-47`.

### fs `aaradhanes`

**Declared type:** `types/aaradhane.ts#Aaradhane` (same shape as `aaradhane`)  
**Rule:** `firestore.rules:130`  
**Index:** none  
**Migration:** Firestore only - a duplicate of `aaradhane` kept for delete fallback.

<!--FIELDS aaradhanes | types/aaradhane.ts#Aaradhane-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | - | - | declared, **no call site** |
| `createdBy` | `string` | yes | - | - | declared, **no call site** |
| `dates` | `string[]` | yes | - | - | declared, **no call site** |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | `services/aaradhane.service.ts:175` | declared |
| `guruName` | `string` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | - | - | declared, **no call site** |
| `isUpcoming` | `boolean` | yes | - | - | declared, **no call site** |
| `offerings` | `string[]` | yes | - | - | declared, **no call site** |
| `rituals` | `string[]` | yes | - | - | declared, **no call site** |
| `sevaDetails` | `AaradhaneSeva[]` | yes | - | - | declared, **no call site** |
| `significance` | `string` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

Nothing creates documents here. `services/aaradhane.service.ts:175` lists it and `:262` deletes from
it when the delete against `aaradhane` missed (`:249-266`). Two collections, one concept - a rename
that was never finished.

### fs `ai_intent_distribution`

**Declared type:** `types/ai-analytics.ts#IntentDistributionRecord` (`types/ai-analytics.ts:44`)  
**Rule:** `firestore.rules:213`  
**Index:** `firestore.indexes.json` entry 18, single-field `timestamp` DESC - a no-op, Firestore indexes single fields automatically.  
**Migration:** **Firestore write / Supabase read.** Written to Firestore at `app/admin/ai/analytics/page.tsx:245`; read from the Supabase table at `services/ai-analytics.service.ts:170`.

<!--FIELDS ai_intent_distribution | types/ai-analytics.ts#IntentDistributionRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `addedToKnowledge` | `?` inferred | - | `services/ai-analytics.service.ts:204` | - | not in the type |
| `category` | `IntentCategory` | yes | `services/ai-analytics.service.ts:171` | `services/ai-analytics.service.ts:173` | declared |
| `confidence` | `number` | yes | `services/ai-analytics.service.ts:171` | `services/ai-analytics.service.ts:175` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intent` | `Intent` | yes | `services/ai-analytics.service.ts:171` | `services/ai-analytics.service.ts:172` | declared |
| `language` | `"en" \| "kn" \| "mixed"` | yes | `services/ai-analytics.service.ts:171` | `services/ai-analytics.service.ts:174`<br>`services/ai-analytics.service.ts:370` | declared |
| `messageId` | `string` | yes | - | `services/ai-analytics.service.ts:177` | declared |
| `message_id` | `?` inferred | - | `services/ai-analytics.service.ts:171` | - | not in the type |
| `reviewed` | `?` inferred | - | `services/ai-analytics.service.ts:204` | - | not in the type |
| `sessionId` | `string` | yes | - | `services/ai-analytics.service.ts:176` | declared |
| `session_id` | `?` inferred | - | `services/ai-analytics.service.ts:171` | - | not in the type |
| `timestamp` | `number` | yes | `services/ai-analytics.service.ts:171`<br>`services/ai-analytics.service.ts:204` | `app/admin/ai/analytics/page.tsx:245`<br>`services/ai-analytics.service.ts:361`<br>`services/ai-analytics.service.ts:364`<br>+2 more | declared |
<!--END-->

The snake_case rows (`message_id`, `session_id`) are the Supabase columns mapped at
`services/ai-analytics.service.ts:171`; the camelCase rows (`messageId`, `sessionId`) are what the
Firestore record carries and what `:172-177` reads back. Both live in this bucket because the two
stores share a name. `addedToKnowledge` and `reviewed` at `:204` belong to `ai_unknown_questions`
and were pulled in by window overlap.

### fs `ai_latency_records`

**Declared type:** `types/ai-analytics.ts#LatencyRecord` (`types/ai-analytics.ts:27`)  
**Rule:** `firestore.rules:207`  
**Index:** entry 16, single-field `timestamp` DESC (no-op).  
**Migration:** **Firestore write / Supabase read** - the same split as `ai_intent_distribution`.

<!--FIELDS ai_latency_records | types/ai-analytics.ts#LatencyRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `errorType` | `"timeout" \| "rate_limit" \| "api_error" \|` | no | - | `services/ai-analytics.service.ts:141` | declared |
| `error_type` | `?` inferred | - | `services/ai-analytics.service.ts:135` | - | not in the type |
| `generationTime` | `number` | yes | - | `services/ai-analytics.service.ts:139` | declared |
| `generation_time` | `?` inferred | - | `services/ai-analytics.service.ts:135` | - | not in the type |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intent` | `Intent` | yes | - | `services/ai-analytics.service.ts:322` | declared |
| `intentDetectionTime` | `number` | yes | - | `services/ai-analytics.service.ts:137` | declared |
| `intent_detection_time` | `?` inferred | - | `services/ai-analytics.service.ts:135` | - | not in the type |
| `messageId` | `string` | yes | - | - | declared, **no call site** |
| `model` | `?` inferred | - | `services/ai-analytics.service.ts:135` | - | not in the type |
| `retrievalTime` | `number` | yes | - | `services/ai-analytics.service.ts:138` | declared |
| `retrieval_time` | `?` inferred | - | `services/ai-analytics.service.ts:135` | - | not in the type |
| `sessionId` | `string` | yes | - | `services/ai-analytics.service.ts:143` | declared |
| `session_id` | `?` inferred | - | `services/ai-analytics.service.ts:135` | - | not in the type |
| `success` | `boolean` | yes | `services/ai-analytics.service.ts:135` | `services/ai-analytics.service.ts:140` | declared |
| `timestamp` | `number` | yes | `services/ai-analytics.service.ts:135` | `app/admin/ai/analytics/page.tsx:245`<br>`app/admin/ai/analytics/page.tsx:247`<br>`services/ai-analytics.service.ts:313`<br>+3 more | declared |
| `totalLatency` | `number` | yes | - | `services/ai-analytics.service.ts:136` | declared |
| `total_latency` | `?` inferred | - | `services/ai-analytics.service.ts:135` | - | not in the type |
<!--END-->

Same two-store overlay: `total_latency`/`intent_detection_time`/`retrieval_time`/`generation_time`/
`error_type`/`session_id` are Supabase columns (`services/ai-analytics.service.ts:135`),
`totalLatency`/`intentDetectionTime`/`retrievalTime`/`generationTime`/`errorType`/`sessionId` are the
Firestore fields the mapper produces (`:136-143`). `messageId` is declared in the type and written by
neither.

### fs `ai_settings`

**Declared type:** `types/ai-settings.ts#AISettings` (`types/ai-settings.ts:282`)  
**Rule:** `firestore.rules:226` - **`allow write: if true`**, world-writable.  
**Index:** none  
**Migration:** Firestore only. A single document, `ai_settings/main`.

<!--FIELDS ai_settings | types/ai-settings.ts#AISettings-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `aiBehavior` | `AIBehaviorSettings` | yes | - | - | declared, **no call site** |
| `aiResponses` | `AIResponses` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intents` | `IntentSettings` | yes | - | - | declared, **no call site** |
| `prompt` | `PromptSettings` | yes | - | - | declared, **no call site** |
| `templeInformation` | `TempleInformation` | yes | - | - | declared, **no call site** |
| `templePolicies` | `TemplePolicies` | yes | - | - | declared, **no call site** |
| `timestamp` | `?` inferred | - | `services/ai-analytics.service.ts:108` | - | not in the type |
| `updatedAt` | `Date` | yes | - | `lib/ai/ai-settings/admin-repository.ts:56` | declared |
| `updatedBy` | `string` | yes | - | - | declared, **no call site** |
| `visitorInformation` | `VisitorInformation` | yes | - | - | declared, **no call site** |
<!--END-->

One document holding eight nested blocks. `lib/ai/ai-settings/repository.ts:102-177` writes them one
at a time (`templeInformation` `:124`, `visitorInformation` `:136`, `templePolicies` `:148`,
`aiResponses` `:157`, `aiBehavior` `:166`, `prompt` `:177`, `intents` `:323`), each with `updatedAt`
and `updatedBy`. Those writes are filed under `unknown_questions` in `.claude/state/inventory/fields.json` because that file
touches two stores - see UNCLEAR. The admin reader is `lib/ai/ai-settings/admin-repository.ts:39-56`.

### fs `ai_token_usage`

**Declared type:** `types/ai-analytics.ts#TokenUsageRecord` (`types/ai-analytics.ts:10`)  
**Rule:** `firestore.rules:201`  
**Index:** entry 17, single-field `timestamp` DESC (no-op).  
**Migration:** Firestore only - no Supabase table exists for token usage.

<!--FIELDS ai_token_usage | types/ai-analytics.ts#TokenUsageRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `estimatedCost` | `number` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `inputTokens` | `number` | yes | - | - | declared, **no call site** |
| `intent` | `Intent` | yes | - | `services/ai-analytics.service.ts:274` | declared |
| `language` | `"en" \| "kn" \| "mixed"` | yes | - | - | declared, **no call site** |
| `messageId` | `string` | yes | - | - | declared, **no call site** |
| `model` | `string` | yes | - | - | declared, **no call site** |
| `outputTokens` | `number` | yes | - | - | declared, **no call site** |
| `sessionId` | `string` | yes | - | - | declared, **no call site** |
| `timestamp` | `number` | yes | `services/ai-analytics.service.ts:108` | `services/ai-analytics.service.ts:265`<br>`services/ai-analytics.service.ts:268`<br>`services/ai-analytics.service.ts:277`<br>+1 more | declared |
| `totalTokens` | `number` | yes | - | - | declared, **no call site** |
<!--END-->

Only `timestamp` and `intent` surface at call sites; the rest of the record goes in through a
variable at `services/ai-analytics.service.ts:108`, so `TokenUsageRecord` is the schema. Cost
reporting reads it at `:260-283`.

### fs `ai_unknown_questions`

**Declared type:** `types/ai-analytics.ts#UnknownQuestionRecord` (`types/ai-analytics.ts:58`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only - a second, parallel name for `unknown_questions`.

<!--FIELDS ai_unknown_questions | types/ai-analytics.ts#UnknownQuestionRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `addedToKnowledge` | `boolean` | yes | `services/ai-analytics.service.ts:204`<br>`services/ai-analytics.service.ts:232` | - | declared |
| `confidence` | `number` | yes | - | - | declared, **no call site** |
| `detectedIntent` | `Intent` | yes | - | `services/ai-analytics.service.ts:418` | declared |
| `feedback` | `"helpful" \| "not_helpful"` | no | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `knowledgeArticleId` | `string` | no | `services/ai-analytics.service.ts:232` | - | declared |
| `language` | `"en" \| "kn" \| "mixed"` | yes | - | - | declared, **no call site** |
| `messageId` | `string` | yes | - | - | declared, **no call site** |
| `question` | `string` | yes | - | - | declared, **no call site** |
| `reviewed` | `boolean` | yes | `services/ai-analytics.service.ts:204`<br>`services/ai-analytics.service.ts:232` | - | declared |
| `reviewedAt` | `number` | no | `services/ai-analytics.service.ts:232` | `services/ai-analytics.service.ts:428` | declared |
| `reviewedBy` | `string` | no | `services/ai-analytics.service.ts:232` | - | declared |
| `sessionId` | `string` | yes | - | - | declared, **no call site** |
| `timestamp` | `number` | yes | `services/ai-analytics.service.ts:204` | `services/ai-analytics.service.ts:409`<br>`services/ai-analytics.service.ts:412`<br>`services/ai-analytics.service.ts:421`<br>+1 more | declared |
| `userAgent` | `string` | no | - | - | declared, **no call site** |
<!--END-->

The name is defined at `services/ai-analytics.service.ts:47` inside the `COLLECTIONS` map (`:43-50`).
Nothing in the app ever *creates* a document here - `lib/ai/unknown-logger.ts:13` and
`services/analytics.service.ts:31` both write `unknown_questions` - so the review updates at `:204`
and `:232` operate on documents that may not exist. `data/firestore-dump/README.md:52` lists this
name under "code-known collections not present live".

### fs `announcements`

**Declared type:** `types/announcement.ts#Announcement` (`types/announcement.ts:1`)  
**Rule:** `firestore.rules:45`  
**Index:** entry 11 `active` ASC + `priority` ASC; entry 12 `publishedAt` DESC.  
**Migration:** Firestore only - no Supabase table.

<!--FIELDS announcements | types/announcement.ts#Announcement-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:92`<br>`app/admin/content/page.tsx:169` | not in the type (`:168` is the **`events`** draft query - bleed, removed) |
| `createdAt` | `any` | no | `services/announcement.service.ts:58` | `services/announcement.service.ts:37`<br>`services/announcement.service.ts:48`<br>`services/announcement.service.ts:28`<br>+11 more | declared |
| `date` | `?` inferred | - | - | ~~`app/admin/content/page.tsx:90`~~ | **bleed** - `:90` is the `events` upcoming-count; no announcement carries `date` |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `isActive` | `boolean` | yes | - | `services/announcement.service.ts:48`<br>`services/announcement.service.ts:27`<br>`services/daily-spiritual.service.ts:389`<br>+2 more | declared |
| `link` | `string` | no | - | `services/announcement.service.ts:26`<br>`lib/ai/retrieval/announcements.ts:39` | declared |
| `message` | `string` | yes | - | `services/announcement.service.ts:25`<br>`lib/ai/retrieval/announcements.ts:38` | declared |
| `title` | `string` | yes | - | `app/admin/content/page.tsx:191`<br>`services/announcement.service.ts:24`<br>+1 more | declared (`:180` is the `events` draft mapper - bleed) |
| `updatedAt` | `any` | no | `services/announcement.service.ts:58`<br>`services/announcement.service.ts:63` | `app/admin/content/page.tsx:119`<br>`app/admin/content/page.tsx:120`<br>`app/admin/content/page.tsx:182`<br>+2 more | declared |
<!--END-->

**The field-name fault.** The type and every service query use `isActive`
(`services/announcement.service.ts:48`, `lib/ai/retrieval/announcements.ts:59`,
`services/daily-spiritual.service.ts:389`), but the declared composite index names `active`, and
`app/admin/content/page.tsx:92,169` filters on `active` too. The index also orders by `priority`,
which no document carries and no type declares. Net effect: the real query (`isActive` +
`orderBy createdAt desc`) has no index and throws `FAILED_PRECONDITION`, while the declared index
covers a query nobody runs. The `date` read at `app/admin/content/page.tsx:90` is an `events` filter
that the harvester pulled in from the neighbouring line.

### fs `articles`

**Declared type:** none - the seed payload is the only definition of the shape.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS articles-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `category` | `?` inferred | - | - | `scripts/seed-ai-knowledge.ts:71`<br>`scripts/seed-ai-knowledge.ts:72` | not in the type |
| `createdAt` | `?` inferred | - | `scripts/seed-ai-knowledge.ts:145` | - | not in the type |
| `createdBy` | `?` inferred | - | `scripts/seed-ai-knowledge.ts:145` | - | not in the type |
| `published` | `?` inferred | - | - | `scripts/seed-ai-knowledge.ts:66` | not in the type |
| `tags` | `?` inferred | - | `scripts/seed-ai-knowledge.ts:145` | - | not in the type |
| `updatedAt` | `?` inferred | - | `scripts/seed-ai-knowledge.ts:145` | - | not in the type |
| `version` | `?` inferred | - | `scripts/seed-ai-knowledge.ts:145` | - | not in the type |
<!--END-->

Touched by exactly one file: `scripts/seed-ai-knowledge.ts:65` (read, filtering on `published` and
`category`) and `:143-145` (write). Nothing in `app/`, `services/` or `lib/` knows this collection
exists. It is a second, abandoned home for knowledge articles next to `knowledge`.

### fs `bills`

**Declared type:** `types/billing.ts#Bill` (`types/billing.ts:25`)  
**Rule:** `firestore.rules:142`  
**Index:** none  
**Migration:** Firestore only - no Supabase table, although bills carry money.

<!--FIELDS bills | types/billing.ts#Bill-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `amountPaid` | `number` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:50` | declared |
| `balanceDue` | `number` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:51` | declared |
| `billDate` | `Timestamp \| Date` | yes | - | `services/billing.service.ts:38` | declared |
| `createdAt` | `Timestamp \| FieldValue` | yes | - | `services/billing.service.ts:94`<br>`services/billing.service.ts:111`<br>`services/billing.service.ts:122`<br>+1 more | declared |
| `createdBy` | `string` | yes | - | `services/billing.service.ts:58` | declared |
| `customerAddress` | `string` | no | - | `services/billing.service.ts:43` | declared |
| `customerEmail` | `string` | no | - | `services/billing.service.ts:41` | declared |
| `customerGstin` | `string` | no | - | `services/billing.service.ts:44` | declared |
| `customerName` | `string` | yes | - | `services/billing.service.ts:121`<br>`services/billing.service.ts:40` | declared |
| `customerPhone` | `string` | no | - | `services/billing.service.ts:42` | declared |
| `discountAmount` | `number` | yes | - | `services/billing.service.ts:48` | declared |
| `dueDate` | `Timestamp \| Date` | yes | - | `services/billing.service.ts:134`<br>`services/billing.service.ts:135`<br>`services/billing.service.ts:39` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `invoiceNumber` | `string` | yes | - | `services/billing.service.ts:37` | declared |
| `items` | `BillItem[]` | yes | - | `services/billing.service.ts:45` | declared |
| `notes` | `string` | no | - | `services/billing.service.ts:55` | declared |
| `paymentStatus` | `PaymentStatus` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:53` | declared |
| `payments` | `BillPayment[]` | yes | `services/billing.service.ts:258` | `services/billing.service.ts:54` | declared |
| `status` | `BillStatus` | yes | `services/billing.service.ts:226`<br>`services/billing.service.ts:258` | `services/billing.service.ts:110`<br>`services/billing.service.ts:133`<br>`services/billing.service.ts:52` | declared |
| `subtotal` | `number` | yes | - | `services/billing.service.ts:46` | declared |
| `taxAmount` | `number` | yes | - | `services/billing.service.ts:47` | declared |
| `totalAmount` | `number` | yes | - | `services/billing.service.ts:49` | declared |
| `updatedAt` | `Timestamp \| FieldValue` | yes | `services/billing.service.ts:226`<br>`services/billing.service.ts:258` | `services/billing.service.ts:57` | declared |
<!--END-->

Create and update go through spreads (`services/billing.service.ts:101,216`), so most fields appear
read-only; `Bill` is the truth and the mapper at `:37-58` is the practical reader. Three queries
combine `where` with `orderBy` and have no composite index: `status` + `createdAt` (`:108-110`),
`customerName` + `createdAt` (`:119-122`), and `status in` + `dueDate <` + `orderBy dueDate`
(`:131-135`). `amountPaid`, `balanceDue`, `payments` and `paymentStatus` are recomputed on every
payment at `:258`.

### fs `bookmarks`

**Declared type:** `types/profile.ts#Bookmark` (`types/profile.ts:55`)  
**Rule:** **none** - falls through to the default deny, so client SDK access fails.  
**Index:** none  
**Migration:** Firestore only. Supabase keeps bookmarks as a `jsonb` column on `profiles` instead.

<!--FIELDS bookmarks | types/profile.ts#Bookmark-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `Date` | yes | - | `services/profile.service.ts:395` | declared |
| `description` | `string` | no | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `itemId` | `string` | yes | - | `services/profile.service.ts:364` | declared |
| `thumbnail` | `string` | no | - | - | declared, **no call site** |
| `title` | `string` | yes | - | - | declared, **no call site** |
| `type` | `BookmarkType` | yes | - | `services/profile.service.ts:387` | declared |
| `uid` | `?` inferred | - | - | `services/profile.service.ts:363`<br>`services/profile.service.ts:384`<br>`services/profile.service.ts:387` | not in the type |
| `url` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

`services/profile.service.ts:333-395`. Documents carry a `uid` owner field (`:363,384,387`) that no
security rule enforces, and the query at `:384-387` pairs `uid` with `type` with no composite index.
The `title`, `description`, `thumbnail` and `url` fields declared on `Bookmark` never appear at a
call site - the write goes in as a whole object.

### fs `chat_messages`

**Declared type:** none.  
**Rule:** **none**  
**Index:** entry 15, `sessionId` ASC + `timestamp` DESC - declared on *this* name.  
**Migration:** Firestore only; the Supabase `chat_messages` table has no app code either.

<!--FIELDS chat_messages-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `timestamp` | `?` inferred | - | - | `services/ai-analytics.service.ts:611`<br>`services/ai-analytics.service.ts:612` | not in the type |
<!--END-->

**Not in M11's list of 63 - added here.** `services/ai-analytics.service.ts:610` counts documents in
a Firestore collection literally named `chat_messages`, resolved from `COLLECTIONS.CHAT_MESSAGES`
(`:50`). Every chat message the app actually saves goes to `messages`
(`services/chat.service.ts:101`). So: the collection with the composite index is empty, the
collection that needs one does not have it, and the admin "total messages" figure is always zero.

### fs `chat_metrics`

**Declared type:** `types/analytics.ts#ConversationMetric` (`types/analytics.ts:17`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS chat_metrics | types/analytics.ts#ConversationMetric-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `averageConfidence` | `number` | yes | - | - | declared, **no call site** |
| `date` | `string` | yes | `services/analytics.service.ts:54` | - | declared |
| `fallbackQueries` | `number` | yes | - | - | declared, **no call site** |
| `languageBreakdown` | `{` | yes | - | - | declared, **no call site** |
| `successfulQueries` | `number` | yes | - | - | declared, **no call site** |
| `timestamp` | `?` inferred | - | `services/analytics.service.ts:54` | - | not in the type |
| `totalQueries` | `number` | yes | - | - | declared, **no call site** |
| `unknownQuestions` | `number` | yes | - | - | declared, **no call site** |
<!--END-->

Write-only. `services/analytics.service.ts:47-56` appends one document per conversation
(`{...data, timestamp, date}`) and nothing anywhere reads the collection back. With no rule, the
client write is denied outright, so this is dead code that also fails silently (`:58`).

### fs `chat_sessions`

**Declared type:** `types/ai.ts#ChatSession` (`types/ai.ts:15`)  
**Rule:** `firestore.rules:186` - public create.  
**Index:** entry 14, `userId` ASC + `updatedAt` DESC - used by `services/chat.service.ts:72-76`.  
**Migration:** Firestore only; the Supabase `chat_sessions` table has no app code.

<!--FIELDS chat_sessions | types/ai.ts#ChatSession-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `number` | yes | `services/conversation.service.ts:112` | `app/admin/ai/analytics/page.tsx:264`<br>`app/admin/ai/analytics/page.tsx:265`<br>`app/admin/ai/page.tsx:103`<br>+4 more | declared |
| `detectedLanguage` | `DetectedLanguage` | no | - | - | declared, **no call site** |
| `error` | `?` inferred | - | - | `app/admin/ai/page.tsx:70` | not in the type |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `intent` | `?` inferred | - | - | `app/admin/ai/analytics/page.tsx:293` | not in the type |
| `lastIntent` | `?` inferred | - | `services/conversation.service.ts:161`<br>`services/conversation.service.ts:348` | `services/conversation.service.ts:71` | not in the type |
| `lastMessage` | `string` | no | - | - | declared, **no call site** |
| `lastTopic` | `?` inferred | - | `services/conversation.service.ts:161`<br>`services/conversation.service.ts:348` | `services/conversation.service.ts:72` | not in the type |
| `messageCount` | `number` | yes | - | - | declared, **no call site** |
| `messages` | `?` inferred | - | `services/conversation.service.ts:161`<br>`services/conversation.service.ts:199`<br>`services/conversation.service.ts:348` | `services/conversation.service.ts:74`<br>`services/conversation.service.ts:194` | not in the type |
| `preferredLanguage` | `?` inferred | - | `services/conversation.service.ts:161` | `services/conversation.service.ts:73` | not in the type |
| `success` | `?` inferred | - | - | `app/admin/ai/page.tsx:48`<br>`app/admin/ai/page.tsx:66` | not in the type |
| `updatedAt` | `number` | yes | `services/chat.service.ts:49`<br>`services/conversation.service.ts:112`<br>`services/conversation.service.ts:161`<br>+1 more | `services/chat.service.ts:75`<br>`services/conversation.service.ts:79` | declared |
| `userId` | `string \| null` | yes | - | `services/chat.service.ts:74`<br>`services/conversation.service.ts:70` | declared |
<!--END-->

Two writers with different shapes into the same documents: `services/chat.service.ts:31-39` writes
`userId`, `createdAt`, `updatedAt`, `messageCount`, `lastMessage`, while
`services/conversation.service.ts:161` and `:348` write `messages` (an embedded array),
`lastIntent`, `lastTopic`, `preferredLanguage`. `messageCount`, `lastMessage` and `detectedLanguage`
are declared on `ChatSession` but only ever written through the `Partial<ChatSession>` spread at
`services/chat.service.ts:49-52`. The `success`, `error` and `intent` rows come from admin dashboard
code in the same window and are not session fields.

### fs `chatTraining`

**Declared type:** none - the admin form is the schema.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS chatTraining-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | `app/admin/ai/training/page.tsx:207`<br>`app/admin/ai/training/page.tsx:218`<br>`app/admin/ai/training/page.tsx:253` | `lib/ai/firebaseChat.ts:154` | not in the type |
| `category` | `?` inferred | - | `app/admin/ai/training/page.tsx:207`<br>`app/admin/ai/training/page.tsx:218` | - | not in the type |
| `createdAt` | `?` inferred | - | `app/admin/ai/training/page.tsx:138`<br>`app/admin/ai/training/page.tsx:207` | - | not in the type |
| `keywords` | `?` inferred | - | `app/admin/ai/training/page.tsx:207`<br>`app/admin/ai/training/page.tsx:218` | - | not in the type |
| `priority` | `?` inferred | - | `app/admin/ai/training/page.tsx:207`<br>`app/admin/ai/training/page.tsx:218` | `lib/ai/firebaseChat.ts:155` | not in the type |
| `response` | `?` inferred | - | `app/admin/ai/training/page.tsx:207`<br>`app/admin/ai/training/page.tsx:218` | - | not in the type |
| `updatedAt` | `?` inferred | - | `app/admin/ai/training/page.tsx:138`<br>`app/admin/ai/training/page.tsx:207`<br>`app/admin/ai/training/page.tsx:218`<br>+1 more | - | not in the type |
<!--END-->

Written at `app/admin/ai/training/page.tsx:138` (import) and `:207-218` (create/edit), read by the AI
at `lib/ai/firebaseChat.ts:152-155`, which runs `where active == true` + `orderBy priority` - a
composite query with no declared index. `keywords`, `category` and `response` are never read back by
any TypeScript file; they are consumed only through the untyped `doc.data()` spread at
`lib/ai/firebaseChat.ts:158`.

### fs `daily_page_stats`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS daily_page_stats-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `date` | `?` inferred | - | `services/pageviews.service.ts:62` | - | not in the type |
| `deviceType` | `?` inferred | - | - | `services/pageviews.service.ts:60` | not in the type |
| `lastUpdated` | `?` inferred | - | `services/pageviews.service.ts:62` | - | not in the type |
| `pageViews` | `?` inferred | - | `services/pageviews.service.ts:62` | - | not in the type |
| `path` | `?` inferred | - | - | `services/pageviews.service.ts:71` | not in the type |
| `referrer` | `?` inferred | - | - | `services/pageviews.service.ts:59` | not in the type |
<!--END-->

Two document shapes share the collection: `<YYYY-MM-DD>` holding `date`, `pageViews` (an
`increment(1)`) and `lastUpdated` (`services/pageviews.service.ts:62-65`), and `<YYYY-MM-DD>_pages`
holding computed keys of the form `pages.<path>` (`:70`). The `trafficSources.*` and
`deviceBreakdown.*` field paths are built at `:59-60` and then never used - dead code. Computed keys
are invisible to the harvester, so the `path`, `referrer` and `deviceType` rows below are the
*inputs* to those keys, not stored fields.

### fs `dailyPoojas`

**Declared type:** `types/pooja.ts#DailyPooja` (`types/pooja.ts:1`)  
**Rule:** **none** - client access denied by default.  
**Index:** none  
**Migration:** Firestore only. `daily_poojas` exists in Supabase and `scripts/migrate-daily-poojas.ts` fills it, but nothing reads it.

<!--FIELDS dailyPoojas | types/pooja.ts#DailyPooja-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `category` | `PoojaCategory` | yes | - | `services/pooja.service.ts:26`<br>`scripts/migrate-daily-poojas.ts:72`<br>`scripts/migrate-daily-poojas.ts:85` | declared |
| `createdAt` | `string` | yes | `services/pooja.service.ts:63`<br>`scripts/seed-poojas.ts:95` | `services/pooja.service.ts:32`<br>`services/pooja.service.ts:33`<br>`services/pooja.service.ts:34`<br>+2 more | declared |
| `createdBy` | `string` | yes | `services/pooja.service.ts:63`<br>`scripts/seed-poojas.ts:95` | `services/pooja.service.ts:35`<br>`scripts/migrate-daily-poojas.ts:91` | declared |
| `days` | `string[]` | yes | - | `services/pooja.service.ts:30`<br>`scripts/migrate-daily-poojas.ts:74`<br>`scripts/migrate-daily-poojas.ts:89` | declared |
| `description` | `string` | yes | - | `services/pooja.service.ts:23`<br>`scripts/migrate-daily-poojas.ts:69`<br>`scripts/migrate-daily-poojas.ts:82` | declared |
| `displayOrder` | `number` | yes | - | `services/pooja.service.ts:44`<br>`services/pooja.service.ts:29`<br>`scripts/migrate-daily-poojas.ts:88` | declared |
| `duration` | `string` | yes | - | `services/pooja.service.ts:25`<br>`scripts/migrate-daily-poojas.ts:71`<br>`scripts/migrate-daily-poojas.ts:84` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `isActive` | `boolean` | yes | - | `services/pooja.service.ts:28`<br>`scripts/migrate-daily-poojas.ts:87` | declared |
| `notes` | `string` | yes | - | `services/pooja.service.ts:31`<br>`scripts/migrate-daily-poojas.ts:90` | declared |
| `sevaAmount` | `number` | yes | - | `services/pooja.service.ts:27`<br>`scripts/migrate-daily-poojas.ts:73`<br>`scripts/migrate-daily-poojas.ts:86` | declared |
| `startTime` | `string` | yes | - | `services/pooja.service.ts:24`<br>`scripts/migrate-daily-poojas.ts:70`<br>`scripts/migrate-daily-poojas.ts:83` | declared |
| `title` | `string` | yes | - | `services/pooja.service.ts:22`<br>`scripts/migrate-daily-poojas.ts:68`<br>`scripts/migrate-daily-poojas.ts:81` | declared |
<!--END-->

Create and update are spreads (`services/pooja.service.ts:63,76`); the mapper at `:22-35` is the
practical field list and `scripts/migrate-daily-poojas.ts:68-91` is the second, independent copy of
the same mapping. Note `duration` is a `string` here (`"45 min"`), not a number as in `sevas`.

### fs `donation_campaigns`

**Declared type:** `types/donationCampaign.ts#DonationCampaign` (`types/donationCampaign.ts:1`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only; the Supabase `donation_campaigns` table has no app code.

<!--FIELDS donation_campaigns | types/donationCampaign.ts#DonationCampaign-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | `services/donationCampaign.service.ts:49` | declared |
| `createdAt` | `string` | yes | `services/donationCampaign.service.ts:108` | `services/donationCampaign.service.ts:55` | declared |
| `description` | `string` | yes | - | `services/donationCampaign.service.ts:41` | declared |
| `displayOrder` | `number` | yes | - | `services/donationCampaign.service.ts:69`<br>`services/donationCampaign.service.ts:52` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | - | `services/donationCampaign.service.ts:43` | declared |
| `suggestedAmount` | `number` | yes | - | `services/donationCampaign.service.ts:46` | declared |
| `title` | `string` | yes | - | `services/donationCampaign.service.ts:39` | declared |
| `updatedAt` | `string` | yes | `services/donationCampaign.service.ts:108`<br>`services/donationCampaign.service.ts:125` | `services/donationCampaign.service.ts:57` | declared |
<!--END-->

`docs/DATA-MODEL.md:450` documents this as `donationCampaigns` (camelCase) and gives it
`goalAmount`, `currentAmount`, `startDate` and `endDate`. The code uses `donation_campaigns`
(`services/donationCampaign.service.ts:68`) and none of those four fields exist; the real fields are
`suggestedAmount` and `displayOrder`. With no rule, every client read of this collection is denied.

### fs `donations`

**Declared type:** `types/donation.ts#DonationRecord` (`types/donation.ts:13`)  
**Rule:** `firestore.rules:119`  
**Index:** entry 9 `userId` + `collectedAt`; entry 10 `status` + `collectedAt`.  
**Migration:** Firestore only; the Supabase `donations` table has no app code.

<!--FIELDS donations | types/donation.ts#DonationRecord-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `address` | `string` | yes | - | `services/donation.service.ts:20` | declared |
| `adminRemarks` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:28` | declared |
| `amount` | `number` | yes | - | `app/admin/page.tsx:179`<br>`services/donation.service.ts:21`<br>`hooks/useDonationNotifications.ts:52` | declared |
| `campaignId` | `string` | yes | - | `services/donation.service.ts:23` | declared |
| `collectedAt` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:30` | declared |
| `collectedBy` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:29` | declared |
| `createdAt` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:46`<br>`services/donation.service.ts:31`<br>`hooks/useDonationNotifications.ts:35`<br>+1 more | declared |
| `donorName` | `string` | yes | - | `services/donation.service.ts:17`<br>`hooks/useDonationNotifications.ts:51` | declared |
| `email` | `string` | yes | - | `app/admin/page.tsx:177`<br>`app/api/public/stats/route.ts:58`<br>`services/donation.service.ts:18` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `message` | `string` | yes | - | `services/donation.service.ts:24` | declared |
| `name` | `?` inferred | - | - | `services/donation.service.ts:17` | not in the type |
| `paymentMethod` | `?` inferred | - | - | `services/donation.service.ts:25` | not in the type |
| `paymentMode` | `PaymentMode` | yes | - | `services/donation.service.ts:25`<br>`hooks/useDonationNotifications.ts:54` | declared |
| `phone` | `string` | yes | - | `app/admin/page.tsx:178`<br>`app/api/public/stats/route.ts:59`<br>`services/donation.service.ts:19` | declared |
| `purpose` | `string` | yes | - | `services/donation.service.ts:22`<br>`hooks/useDonationNotifications.ts:53` | declared |
| `receiptNumber` | `string` | yes | `services/donation.service.ts:39` | `services/donation.service.ts:27` | declared |
| `status` | `DonationStatus` | yes | `services/donation.service.ts:39`<br>`services/donation.service.ts:68` | `app/admin/page.tsx:172`<br>`app/api/public/stats/route.ts:52`<br>`services/donation.service.ts:26` | declared |
| `updatedAt` | `string` | yes | `services/donation.service.ts:39`<br>`services/donation.service.ts:68`<br>`services/donation.service.ts:73` | `services/donation.service.ts:32` | declared |
<!--END-->

Both declared indexes are dead: no document carries `userId`, and `services/donation.service.ts:46`
orders by `createdAt` with no `where`. The mapper at `:17-32` accepts two spellings for two fields -
`donorName` or `name` (`:17`), `paymentMode` or `paymentMethod` (`:25`) - which is the signature of
two different writers having existed. `hooks/useDonationNotifications.ts:35-54` is a live listener
reading `createdAt`, `donorName`, `amount`, `purpose` and `paymentMode`.

### fs `events`

**Declared type:** `types/event.ts#TempleEvent` (`types/event.ts:8`)  
**Rule:** `firestore.rules:50`  
**Index:** entry 6 `published` + `startDate` (used); entry 7 `featured` + `startDate` (unused).  
**Migration:** **Dual and diverging.** `services/event.service.ts:46-123` reads and writes the Supabase table through the anon client; the admin pages, the aaradhane generator and the AI retriever all still use Firestore.

<!--FIELDS events | types/event.ts#TempleEvent-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:168` | not in the type |
| `autoGenerated` | `?` inferred | - | - | `lib/aaradhane/firestore-admin.ts:34`<br>`lib/aaradhane/firestore-admin.ts:58`<br>`lib/aaradhane/firestore-admin.ts:97`<br>+6 more | not in the type |
| `category` | `string` | no | - | `services/daily-spiritual.service.ts:320`<br>`services/daily-spiritual.service.ts:362`<br>`lib/aaradhane/firestore-admin.ts:36`<br>+4 more | declared |
| `createdAt` | `Timestamp` | no | `lib/aaradhane/firestore.ts:296`<br>`lib/aaradhane/firestore.ts:452`<br>`scripts/generate-events-firestore.ts:219`<br>+1 more | - | declared |
| `date` | `?` inferred | - | - | `app/admin/content/page.tsx:90`<br>`app/admin/page.tsx:111`<br>`app/api/public/stats/route.ts:45` | not in the type |
| `description` | `string` | yes | - | `services/daily-spiritual.service.ts:315`<br>`services/daily-spiritual.service.ts:357`<br>`lib/ai/firebaseChat.ts:95`<br>+1 more | declared |
| `endDate` | `Timestamp` | yes | `scripts/import-events.ts:64` | `services/daily-spiritual.service.ts:302`<br>`services/daily-spiritual.service.ts:342`<br>`lib/ai/retrieval/events.ts:44`<br>+1 more | declared |
| `endTime` | `string` | no | - | `services/daily-spiritual.service.ts:319`<br>`services/daily-spiritual.service.ts:361`<br>`lib/ai/retrieval/events.ts:46` | declared |
| `featured` | `boolean` | yes | - | `services/daily-spiritual.service.ts:294`<br>`lib/ai/retrieval/events.ts:48` | declared |
| `firestore_id` | `?` inferred | - | - | `services/event.service.ts:58`<br>`services/event.service.ts:114`<br>`services/event.service.ts:123` | not in the type |
| `guru` | `?` inferred | - | - | `lib/aaradhane/firestore-admin.ts:56`<br>`lib/aaradhane/firestore-admin.ts:95`<br>`lib/aaradhane/firestore.ts:71`<br>+3 more | not in the type |
| `id` | `string` | no | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | no | - | `services/daily-spiritual.service.ts:321`<br>`services/daily-spiritual.service.ts:363` | declared |
| `location` | `string` | yes | - | `lib/ai/retrieval/events.ts:47` | declared |
| `name` | `?` inferred | - | - | `scripts/check-collections.ts:47`<br>`scripts/check-collections.ts:58` | not in the type |
| `published` | `boolean` | yes | - | `services/daily-spiritual.service.ts:295`<br>`services/daily-spiritual.service.ts:332`<br>`lib/ai/firebaseChat.ts:77`<br>+2 more | declared |
| `raghavendraPhase` | `?` inferred | - | - | `scripts/generate-events-firestore.ts:171`<br>`scripts/generate-events-firestore.ts:180` | not in the type |
| `startDate` | `Timestamp` | yes | `scripts/import-events.ts:64` | `services/daily-spiritual.service.ts:301`<br>`services/daily-spiritual.service.ts:341`<br>`lib/aaradhane/firestore-admin.ts:43`<br>+30 more | declared |
| `startTime` | `string` | no | - | `services/daily-spiritual.service.ts:318`<br>`services/daily-spiritual.service.ts:360`<br>`lib/ai/retrieval/events.ts:45` | declared |
| `status` | `EventStatus` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | `services/daily-spiritual.service.ts:314`<br>`services/daily-spiritual.service.ts:356`<br>`lib/aaradhane/firestore-admin.ts:55`<br>+9 more | declared |
| `updatedAt` | `Timestamp` | no | `lib/aaradhane/firestore.ts:284`<br>`lib/aaradhane/firestore.ts:296`<br>`lib/aaradhane/firestore.ts:438`<br>+3 more | `app/admin/content/page.tsx:119` | declared |
| `year` | `?` inferred | - | - | `lib/aaradhane/firestore-admin.ts:35`<br>`lib/aaradhane/firestore-admin.ts:57`<br>`lib/aaradhane/firestore-admin.ts:96`<br>+8 more | not in the type |
<!--END-->

The aaradhane generator writes four fields no type declares - `autoGenerated`, `guru`, `year`,
`raghavendraPhase` (`lib/aaradhane/firestore.ts:47-49,71-73`, `lib/aaradhane/firestore-admin.ts:34-36`,
`scripts/generate-events-firestore.ts:162-180`) - and uses them as the idempotency key when
regenerating a year. Neither the Supabase `events` table nor `TempleEvent` has a column or property
for any of them, so a Firestore→Supabase migration silently drops the generator's bookkeeping. The
admin counters query `date` (`app/admin/content/page.tsx:90`, `app/admin/page.tsx:111`,
`app/api/public/stats/route.ts:45`), a field neither the type nor any writer produces - those
"upcoming events" counts are always zero. `active` (`app/admin/content/page.tsx:168`) is likewise
not an event field; the real flag is `published`.

### fs `featuredContent`

**Declared type:** none - `app/admin/featured/page.tsx` is the whole definition.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS featuredContent-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `contentId` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:117` | not in the type |
| `contentType` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:118` | not in the type |
| `createdAt` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:128` | not in the type |
| `description` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:120` | not in the type |
| `endDate` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:127` | not in the type |
| `imageUrl` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:121` | not in the type |
| `isActive` | `?` inferred | - | `app/admin/featured/page.tsx:217`<br>`app/admin/featured/page.tsx:234` | `app/admin/featured/page.tsx:125` | not in the type |
| `linkLabel` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:123` | not in the type |
| `linkUrl` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:122` | not in the type |
| `priority` | `?` inferred | - | `app/admin/featured/page.tsx:217`<br>`app/admin/featured/page.tsx:234` | `app/admin/featured/page.tsx:108`<br>`app/admin/featured/page.tsx:124` | not in the type |
| `startDate` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:126` | not in the type |
| `title` | `?` inferred | - | `app/admin/featured/page.tsx:217` | `app/admin/featured/page.tsx:119` | not in the type |
| `updatedAt` | `?` inferred | - | `app/admin/featured/page.tsx:217`<br>`app/admin/featured/page.tsx:234` | `app/admin/featured/page.tsx:129` | not in the type |
<!--END-->

Entirely self-contained in one file: written at `app/admin/featured/page.tsx:217` and `:234`, read
field-by-field at `:117-129`, queried `orderBy priority asc` at `:108`. No rule, so the admin page
depends on the default-deny not applying - it uses the client SDK, so this page cannot work in
production unless a rule is added.

### fs `feedback`

**Declared type:** `types/ai.ts#ChatFeedback` (`types/ai.ts:48`)  
**Rule:** `firestore.rules:245`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS feedback | types/ai.ts#ChatFeedback-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `comment` | `string` | no | - | - | declared, **no call site** |
| `createdAt` | `number` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `messageId` | `string` | yes | - | - | declared, **no call site** |
| `rating` | `"helpful" \| "not_helpful" \| null` | yes | - | `services/chat.service.ts:277` | declared |
| `sessionId` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

Written as a spread (`services/chat.service.ts:255-260`), so `ChatFeedback` is the schema. Only
`rating` is ever read back, and by a full-collection scan at `:271-280` rather than a query - which
will get slower without bound.

### fs `futurePlans`

**Declared type:** none.  
**Rule:** `firestore.rules:155`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS futurePlans-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** The future-plans data lives in the document
`settings/futurePlans` (`app/(public)/future-plans/page.tsx:108`, seeded by
`scripts/seed-future-plans.ts:71`). The rule at `firestore.rules:155` protects an empty name; see
`settings/futurePlans` below for the real fields.

### fs `gallery`

**Declared type:** none.  
**Rule:** `firestore.rules:55`  
**Index:** entry 8 `category` + `featured` - unused.  
**Migration:** Firestore only.

<!--FIELDS gallery-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:92` | not in the type |
| `date` | `?` inferred | - | - | `app/admin/content/page.tsx:90` | not in the type |
<!--END-->

Only ever counted, never read field-by-field (`app/admin/content/page.tsx:93`,
`services/dashboard.service.ts:23`). The media the site actually renders is in `galleryMedia`. The
`active` and `date` rows are neighbouring-line noise from the admin counter block. `docs/DATA-MODEL.md:280`
documents a full `GalleryItem` shape (`url`, `thumbnailUrl`, `tags`, `featured`) that exists nowhere
in the code.

### fs `galleryAlbums`

**Declared type:** `types/gallery.ts#GalleryAlbum` (`types/gallery.ts:30`)  
**Rule:** `firestore.rules:61`  
**Index:** none  
**Migration:** Firestore only; the Supabase `gallery_albums` table has no app code.

<!--FIELDS galleryAlbums | types/gallery.ts#GalleryAlbum-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `coverImage` | `string` | yes | - | `app/admin/media/page.tsx:101`<br>`app/admin/media/page.tsx:104` | declared |
| `createdAt` | `any` | no | `services/gallery.service.ts:137` | `app/admin/media/page.tsx:108` | declared |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | `services/gallery.service.ts:114` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `slug` | `string` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | `app/admin/media/page.tsx:106` | declared |
| `updatedAt` | `any` | no | `services/gallery.service.ts:137`<br>`services/gallery.service.ts:143` | - | declared |
<!--END-->

Create and update are spreads (`services/gallery.service.ts:137,143`); `app/admin/media/page.tsx:101-108`
is the field-by-field reader. `slug`, `description` and `active` are declared and written but never
read anywhere in TypeScript.

### fs `galleryMedia`

**Declared type:** `types/gallery.ts#GalleryMedia` (`types/gallery.ts:42`)  
**Rule:** `firestore.rules:66`  
**Index:** none  
**Migration:** Firestore only; the Supabase `gallery_media` table has no app code.

<!--FIELDS galleryMedia | types/gallery.ts#GalleryMedia-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `albumId` | `string` | yes | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:90`<br>`services/gallery.service.ts:182`<br>`hooks/useGallery.ts:37` | declared |
| `altText` | `string` | yes | - | - | declared, **no call site** |
| `caption` | `?` inferred | - | - | `app/admin/media/page.tsx:89` | not in the type |
| `category` | `GalleryCategory` | yes | - | - | declared, **no call site** |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | `services/gallery.service.ts:157`<br>`services/gallery.service.ts:182`<br>`services/gallery.service.ts:194`<br>+2 more | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imagePath` | `string` | yes | - | - | declared, **no call site** |
| `imageUrl` | `?` inferred | - | - | `app/admin/media/page.tsx:87` | not in the type |
| `isFeatured` | `boolean` | yes | - | `services/gallery.service.ts:194` | declared |
| `tags` | `string[]` | yes | - | - | declared, **no call site** |
| `title` | `string` | yes | - | `app/admin/media/page.tsx:89` | declared |
| `type` | `"photo" \| "video"` | yes | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:88` | declared |
| `uploadedAt` | `any` | no | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:91` | declared |
| `uploadedBy` | `string` | yes | `services/gallery.service.ts:221` | `app/admin/media/page.tsx:92` | declared |
| `url` | `?` inferred | - | - | `app/admin/media/page.tsx:87` | not in the type |
| `videoUrl` | `string` | no | - | - | declared, **no call site** |
<!--END-->

**Two live problems.** (1) Three queries need composite indexes that are not declared: `albumId` +
`orderBy displayOrder` (`services/gallery.service.ts:182`), `isFeatured` + `orderBy displayOrder`
(`:194`), and the same pair again in `hooks/useGallery.ts:37-38`. (2) The admin reader uses `url`,
`imageUrl` and `caption` (`app/admin/media/page.tsx:87-89`) where the type declares `imagePath` and
`altText` - so the admin media grid reads fields the service never writes and falls back to blanks.

### fs `guruParampara`

**Declared type:** `types/aaradhane-generator.ts#GuruParamparaCollection` (`types/aaradhane-generator.ts:78`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS guruParampara | types/aaradhane-generator.ts#GuruParamparaCollection-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `gurus` | `GuruParamparaRecord[]` | yes | `scripts/seed-guru-parampara.ts:378`<br>`scripts/seed-guru-to-firestore.ts:327` | `lib/aaradhane/firestore-source.ts:98`<br>`lib/aaradhane/firestore-source.ts:42`<br>`lib/aaradhane/firestore-source.ts:82` | declared |
| `heading` | `string` | no | - | - | declared, **no call site** |
| `headingKannada` | `string` | no | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `subheading` | `string` | no | - | - | declared, **no call site** |
| `subheadingKannada` | `string` | no | - | - | declared, **no call site** |
| `updatedAt` | `string` | no | `scripts/seed-guru-parampara.ts:378`<br>`scripts/seed-guru-to-firestore.ts:327` | - | declared |
<!--END-->

A single document whose id is misspelled: `guruParampara/aaradhanaes`
(`lib/aaradhane/firestore-source.ts:33`). It holds one `gurus` array of `GuruParamparaRecord`
(`types/aaradhane-generator.ts:31`) that drives the whole aaradhane calendar generator. Seeded by
`scripts/seed-guru-parampara.ts:378` and `scripts/seed-guru-to-firestore.ts:327`, which both write
`gurus` and `updatedAt`. With no rule, the client read at `lib/aaradhane/firestore-source.ts:42` is
denied - the generator only works through the admin SDK path (`lib/aaradhane/firestore-admin.ts`).

### fs `homepage`

**Declared type:** `types/homepage.ts#HomepageConfig` (`types/homepage.ts:1`)  
**Rule:** `firestore.rules:149`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS homepage | types/homepage.ts#HomepageConfig-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `announcement` | `string` | yes | - | - | declared, **no call site** |
| `announcement2` | `string` | yes | - | - | declared, **no call site** |
| `contactEmail` | `string` | yes | - | - | declared, **no call site** |
| `contactPhone` | `string` | yes | - | - | declared, **no call site** |
| `dailyQuote` | `{` | no | - | - | declared, **no call site** |
| `dashboardFeaturedEvent` | `{` | no | - | - | declared, **no call site** |
| `donationCTA` | `{` | no | - | - | declared, **no call site** |
| `donationSubtitle` | `string` | yes | - | - | declared, **no call site** |
| `donationTitle` | `string` | yes | - | - | declared, **no call site** |
| `eveningClose` | `string` | yes | - | - | declared, **no call site** |
| `eveningOpen` | `string` | yes | - | - | declared, **no call site** |
| `eveningSchedule` | `string[]` | yes | - | - | declared, **no call site** |
| `featuredFestival` | `string` | yes | - | - | declared, **no call site** |
| `featuredFestivalDescription` | `string` | yes | - | - | declared, **no call site** |
| `featuredFestivalRef` | `{` | no | - | - | declared, **no call site** |
| `featuredSeva` | `{` | no | - | - | declared, **no call site** |
| `festivalDate` | `string` | yes | - | - | declared, **no call site** |
| `festivalScheduleNote` | `string` | yes | - | - | declared, **no call site** |
| `footerCopyright` | `string` | yes | - | - | declared, **no call site** |
| `heroImage` | `string` | yes | - | - | declared, **no call site** |
| `heroPrimaryButton` | `string` | yes | - | - | declared, **no call site** |
| `heroSecondaryButton` | `string` | yes | - | - | declared, **no call site** |
| `heroStats` | `{` | no | - | - | declared, **no call site** |
| `heroSubtitle` | `string` | yes | - | - | declared, **no call site** |
| `heroTitle` | `string` | yes | - | - | declared, **no call site** |
| `isTempleOpen` | `boolean` | yes | - | - | declared, **no call site** |
| `morningClose` | `string` | yes | - | - | declared, **no call site** |
| `morningOpen` | `string` | yes | - | - | declared, **no call site** |
| `morningSchedule` | `string[]` | yes | - | - | declared, **no call site** |
| `panchanga` | `{` | no | - | - | declared, **no call site** |
| `templeAddress` | `string` | yes | - | - | declared, **no call site** |
| `templeLocation` | `string` | yes | - | - | declared, **no call site** |
| `templeName` | `string` | yes | - | - | declared, **no call site** |
| `testimonials` | `Testimonial[]` | no | - | - | declared, **no call site** |
| `todaySeva` | `string` | yes | - | - | declared, **no call site** |
| `todaySevaTime` | `string` | yes | - | - | declared, **no call site** |
| `updatedAt` | `any` | no | `services/homepage.service.ts:46` | - | declared |
<!--END-->

A single document, `homepage/config` (`services/homepage.service.ts:11-12`). The entire
`HomepageConfig` - 38 top-level fields including nested `panchanga`, `featuredSeva`, `donationCTA`,
`heroStats` and an embedded `testimonials` array - is written in one merged `setDoc` at `:44-50`, so
only `updatedAt` shows as a write. `getHomepage` (`:17-27`) merges the stored document over
`getDefaultConfig()`, which means a missing field is silently replaced by a default rather than
surfacing as an error.

### fs `intent_feedback`

**Declared type:** none in `types/` - declared inline at `services/analytics.service.ts:181-191`.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS intent_feedback-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `adminId` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `correctIntent` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:254`<br>`services/analytics.service.ts:258` | not in the type |
| `detectedIntent` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:254`<br>`services/analytics.service.ts:257` | not in the type |
| `isCorrect` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:247`<br>`services/analytics.service.ts:248`<br>`services/analytics.service.ts:253` | not in the type |
| `notes` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `question` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `sessionId` | `?` inferred | - | `services/analytics.service.ts:204` | - | not in the type |
| `timestamp` | `?` inferred | - | `services/analytics.service.ts:204` | `services/analytics.service.ts:240` | not in the type |
<!--END-->

Admin corrections of the AI's intent detection. Written at `services/analytics.service.ts:204`, read
back at `:239-258` to compute an accuracy rate. The inline `IntentFeedback` interface is exported
from a service file rather than from `types/`, against the `types/` convention in AGENTS.md.

### fs `intent_metrics`

**Declared type:** `types/analytics.ts#IntentMetric` (`types/analytics.ts:31`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS intent_metrics | types/analytics.ts#IntentMetric-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `averageConfidence` | `number` | yes | - | - | declared, **no call site** |
| `confidence` | `?` inferred | - | `services/analytics.service.ts:166` | - | not in the type |
| `count` | `number` | yes | - | - | declared, **no call site** |
| `date` | `?` inferred | - | `services/analytics.service.ts:166` | `services/analytics.service.ts:308` | not in the type |
| `fallback` | `?` inferred | - | - | `services/analytics.service.ts:324`<br>`services/analytics.service.ts:325` | not in the type |
| `fallbackRate` | `number` | yes | - | - | declared, **no call site** |
| `intent` | `string` | yes | `services/analytics.service.ts:166` | - | declared |
| `timestamp` | `?` inferred | - | `services/analytics.service.ts:166` | `services/analytics.service.ts:292`<br>`services/analytics.service.ts:298` | not in the type |
| `total` | `?` inferred | - | - | `services/analytics.service.ts:323`<br>`services/analytics.service.ts:325` | not in the type |
| `usedFallback` | `?` inferred | - | `services/analytics.service.ts:166` | `services/analytics.service.ts:302`<br>`services/analytics.service.ts:313` | not in the type |
<!--END-->

**The written document and the declared type share no field at all.** The writer
(`services/analytics.service.ts:166-171`) stores `intent`, `confidence`, `usedFallback`, `date`,
`timestamp`; `IntentMetric` declares `intent`, `count`, `averageConfidence`, `fallbackRate`. The
reader at `:291-325` aggregates the written shape into something resembling the type, so the type
describes the *return value*, not the stored document. `fallback` and `total` below are locals of
that aggregation, not fields.

### fs `knowledge`

**Declared type:** `lib/ai/knowledge/types.ts#KnowledgeArticle` (`lib/ai/knowledge/types.ts:54`)  
**Rule:** `firestore.rules:258`  
**Index:** entry 21, `approved` + `category` + `title` - the only three-field index in the file, and the only composite index the code genuinely uses (`lib/ai/knowledge/repository.ts:92-95`).  
**Migration:** Firestore only - no Supabase table, although this is the AI's whole knowledge base.

<!--FIELDS knowledge | lib/ai/knowledge/types.ts#KnowledgeArticle-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:134`<br>`app/admin/content/page.tsx:146` | not in the type |
| `approved` | `boolean` | yes | `lib/ai/knowledge/repository.ts:239` | `app/api/ai/knowledge/coverage/route.ts:82`<br>`app/api/ai/knowledge/import/route.ts:74`<br>`lib/ai/knowledge/repository.ts:94`<br>+2 more | declared |
| `category` | `KnowledgeCategory` | yes | - | `app/api/ai/knowledge/coverage/route.ts:89`<br>`app/api/ai/knowledge/coverage/route.ts:90`<br>`app/api/ai/knowledge/coverage/route.ts:92`<br>+4 more | declared |
| `content` | `string` | yes | - | `lib/ai/knowledge/repository.ts:66` | declared |
| `createdAt` | `Date` | yes | `app/api/ai/knowledge/import/route.ts:116`<br>`lib/ai/knowledge/repository.ts:239` | `lib/ai/knowledge/repository.ts:43`<br>`lib/ai/knowledge/repository.ts:44`<br>`lib/ai/knowledge/repository.ts:45`<br>+2 more | declared |
| `createdBy` | `?` inferred | - | `app/api/ai/knowledge/import/route.ts:116` | - | not in the type |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `image` | `?` inferred | - | - | `app/admin/featured/page.tsx:188` | not in the type |
| `imageUrl` | `?` inferred | - | - | `app/admin/featured/page.tsx:155`<br>`app/admin/featured/page.tsx:166`<br>`app/admin/featured/page.tsx:177` | not in the type |
| `kannadaContent` | `string` | no | - | - | declared, **no call site** |
| `kannadaTitle` | `string` | no | - | - | declared, **no call site** |
| `keywords` | `string[]` | yes | - | `lib/ai/knowledge/repository.ts:65` | declared |
| `language` | `KnowledgeLanguage` | yes | - | `lib/ai/knowledge/repository.ts:67` | declared |
| `lastReviewed` | `Date` | no | - | `lib/ai/knowledge/repository.ts:68` | declared |
| `name` | `?` inferred | - | - | `app/admin/featured/page.tsx:176` | not in the type |
| `slug` | `string` | yes | - | `lib/ai/knowledge/repository.ts:62` | declared |
| `status` | `?` inferred | - | - | `app/admin/content/page.tsx:158` | not in the type |
| `tags` | `?` inferred | - | `app/api/ai/knowledge/import/route.ts:116` | - | not in the type |
| `title` | `string` | yes | `app/api/ai/knowledge/coverage/route.ts:90` | `app/admin/content/page.tsx:132`<br>`app/admin/content/page.tsx:144`<br>`app/admin/content/page.tsx:156`<br>+7 more | declared |
| `updatedAt` | `Date` | yes | `app/api/ai/knowledge/coverage/route.ts:90`<br>`app/api/ai/knowledge/import/route.ts:116`<br>`lib/ai/knowledge/repository.ts:239`<br>+1 more | `app/admin/content/page.tsx:119`<br>`app/admin/content/page.tsx:120`<br>`app/admin/content/page.tsx:121`<br>+9 more | declared |
| `version` | `?` inferred | - | `app/api/ai/knowledge/import/route.ts:116` | - | not in the type |
<!--END-->

The type lives under `lib/ai/knowledge/`, not `types/`; `types/knowledge.ts:14` re-exports it.
`app/api/ai/knowledge/import/route.ts:116` writes three fields the type does not declare - `tags`,
`version`, `createdBy` - so an imported article and a UI-created article do not have the same shape.
`kannadaTitle` and `kannadaContent` are declared and never touched by any call site; the Kannada
content path is `language: "kn"` documents instead. The `image`, `imageUrl`, `name` and `status`
rows come from `app/admin/featured/page.tsx` and `app/admin/content/page.tsx` reading a mixed list of
content types in the same window - they are not knowledge fields.

### fs `knowledge_articles`

**Declared type:** none.  
**Rule:** `firestore.rules:263`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS knowledge_articles-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** Rule only - a placeholder for a schema that was never built.

### fs `knowledge_audit_log`

**Declared type:** `types/knowledge-workflow.ts#AuditLogEntry` (`types/knowledge-workflow.ts:115`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_audit_log | types/knowledge-workflow.ts#AuditLogEntry-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `action` | `string` | yes | - | `services/knowledge-workflow.service.ts:620` | declared |
| `entityId` | `string` | yes | - | `services/knowledge-workflow.service.ts:611`<br>`services/knowledge-workflow.service.ts:619` | declared |
| `entityType` | `"article" \| "version" \| "workflow" \| "co` | yes | - | `services/knowledge-workflow.service.ts:610`<br>`services/knowledge-workflow.service.ts:618` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `ipAddress` | `string` | no | - | - | declared, **no call site** |
| `metadata` | `Record<string, unknown>` | no | - | `services/knowledge-workflow.service.ts:625` | declared |
| `newState` | `Record<string, unknown>` | no | - | `services/knowledge-workflow.service.ts:624` | declared |
| `performedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:588` | `services/knowledge-workflow.service.ts:612`<br>`services/knowledge-workflow.service.ts:622` | declared |
| `performedBy` | `string` | yes | - | `services/knowledge-workflow.service.ts:621` | declared |
| `previousState` | `Record<string, unknown>` | no | - | `services/knowledge-workflow.service.ts:623` | declared |
| `userAgent` | `string` | no | - | - | declared, **no call site** |
<!--END-->

`services/knowledge-workflow.service.ts:609-612` queries `entityType` + `entityId` +
`orderBy performedAt desc` - a three-field query with no index, on a collection with no rule.
`ipAddress` and `userAgent` are declared and never written.

### fs `knowledge_categories`

**Declared type:** none.  
**Rule:** `firestore.rules:268`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS knowledge_categories-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** Categories are a union type instead
(`lib/ai/knowledge/types.ts:7-49`).

### fs `knowledge_committee_approvals`

**Declared type:** `types/knowledge-workflow.ts#CommitteeApproval` (`types/knowledge-workflow.ts:92`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_committee_approvals | types/knowledge-workflow.ts#CommitteeApproval-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `approvals` | `CommitteeMemberApproval[]` | yes | `services/knowledge-workflow.service.ts:430`<br>`services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:471`<br>`services/knowledge-workflow.service.ts:474`<br>`services/knowledge-workflow.service.ts:563` | declared |
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:430` | `services/knowledge-workflow.service.ts:549`<br>`services/knowledge-workflow.service.ts:560` | declared |
| `completedAt` | `Date` | no | `services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:567` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:430` | `services/knowledge-workflow.service.ts:550`<br>`services/knowledge-workflow.service.ts:566` | declared |
| `currentApprovals` | `number` | yes | `services/knowledge-workflow.service.ts:430`<br>`services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:562` | declared |
| `deadline` | `Date` | no | - | `services/knowledge-workflow.service.ts:565` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `requiredApprovals` | `number` | yes | `services/knowledge-workflow.service.ts:430` | `services/knowledge-workflow.service.ts:501`<br>`services/knowledge-workflow.service.ts:503`<br>`services/knowledge-workflow.service.ts:561` | declared |
| `status` | `"pending" \| "approved" \| "rejected"` | yes | `services/knowledge-workflow.service.ts:430`<br>`services/knowledge-workflow.service.ts:507` | `services/knowledge-workflow.service.ts:564` | declared |
<!--END-->

`services/knowledge-workflow.service.ts:430` opens the ballot, `:507` appends each member's vote into
the `approvals` array and recomputes `currentApprovals` and `status`. `deadline` is declared and read
(`:565`) but never written by any code path.

### fs `knowledge_drafts`

**Declared type:** `types/knowledge-workflow.ts#DraftArticle` (`types/knowledge-workflow.ts:196`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_drafts | types/knowledge-workflow.ts#DraftArticle-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `category` | `KnowledgeCategory` | yes | - | `services/knowledge-workflow.service.ts:1049` | declared |
| `content` | `string` | yes | - | `services/knowledge-workflow.service.ts:1048` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:1020` | `services/knowledge-workflow.service.ts:1052` | declared |
| `createdBy` | `string` | yes | - | `services/knowledge-workflow.service.ts:1040`<br>`services/knowledge-workflow.service.ts:1054` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `keywords` | `string[]` | yes | - | `services/knowledge-workflow.service.ts:1050` | declared |
| `language` | `KnowledgeLanguage` | yes | - | `services/knowledge-workflow.service.ts:1051` | declared |
| `lastSavedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:1013`<br>`services/knowledge-workflow.service.ts:1020` | `services/knowledge-workflow.service.ts:1055` | declared |
| `title` | `string` | yes | - | `services/knowledge-workflow.service.ts:1047` | declared |
| `updatedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:1013`<br>`services/knowledge-workflow.service.ts:1020` | `services/knowledge-workflow.service.ts:1041`<br>`services/knowledge-workflow.service.ts:1053` | declared |
<!--END-->

Editor autosave. `services/knowledge-workflow.service.ts:1039-1041` queries `createdBy` +
`orderBy updatedAt desc` with no index. The draft body (`title`, `content`, `category`, `keywords`,
`language`) goes in as a spread at `:1013`, so only the two timestamps show as writes.

### fs `knowledge_review_comments`

**Declared type:** `types/knowledge-workflow.ts#ReviewComment` (`types/knowledge-workflow.ts:77`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_review_comments | types/knowledge-workflow.ts#ReviewComment-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:380`<br>`services/knowledge-workflow.service.ts:387` | declared |
| `content` | `string` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:389` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:381`<br>`services/knowledge-workflow.service.ts:391` | declared |
| `createdBy` | `string` | yes | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:390` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `resolved` | `boolean` | yes | `services/knowledge-workflow.service.ts:351`<br>`services/knowledge-workflow.service.ts:410` | `services/knowledge-workflow.service.ts:392` | declared |
| `resolvedAt` | `Date` | no | `services/knowledge-workflow.service.ts:410` | `services/knowledge-workflow.service.ts:394` | declared |
| `resolvedBy` | `string` | no | `services/knowledge-workflow.service.ts:410` | `services/knowledge-workflow.service.ts:393` | declared |
| `versionId` | `string` | no | `services/knowledge-workflow.service.ts:351` | `services/knowledge-workflow.service.ts:388` | declared |
<!--END-->

Two queries pair `articleId` with `orderBy createdAt` and have no index
(`services/knowledge-workflow.service.ts:379-381`, `:547-550`).

### fs `knowledge_versions`

**Declared type:** `types/knowledge-workflow.ts#ArticleVersion` (`types/knowledge-workflow.ts:31`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_versions | types/knowledge-workflow.ts#ArticleVersion-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:96` | `services/knowledge-workflow.service.ts:89`<br>`services/knowledge-workflow.service.ts:124`<br>`services/knowledge-workflow.service.ts:131`<br>+1 more | declared |
| `category` | `KnowledgeCategory` | yes | - | `services/knowledge-workflow.service.ts:136`<br>`services/knowledge-workflow.service.ts:165` | declared |
| `changeDescription` | `string` | yes | - | `services/knowledge-workflow.service.ts:140`<br>`services/knowledge-workflow.service.ts:169` | declared |
| `content` | `string` | yes | - | `services/knowledge-workflow.service.ts:134`<br>`services/knowledge-workflow.service.ts:163` | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:96` | `services/knowledge-workflow.service.ts:138`<br>`services/knowledge-workflow.service.ts:167` | declared |
| `createdBy` | `string` | yes | - | `services/knowledge-workflow.service.ts:139`<br>`services/knowledge-workflow.service.ts:168` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `keywords` | `string[]` | yes | - | `services/knowledge-workflow.service.ts:135`<br>`services/knowledge-workflow.service.ts:164` | declared |
| `language` | `KnowledgeLanguage` | yes | - | `services/knowledge-workflow.service.ts:137`<br>`services/knowledge-workflow.service.ts:166` | declared |
| `title` | `string` | yes | - | `services/knowledge-workflow.service.ts:133`<br>`services/knowledge-workflow.service.ts:162` | declared |
| `version` | `number` | yes | `services/knowledge-workflow.service.ts:96` | `services/knowledge-workflow.service.ts:90`<br>`services/knowledge-workflow.service.ts:125`<br>`services/knowledge-workflow.service.ts:94`<br>+2 more | declared |
<!--END-->

`services/knowledge-workflow.service.ts:88-90` (next version number) and `:123-125` (history) both
query `articleId` + `orderBy version desc` with no index. The version body is a spread at `:96`, so
`title`/`content`/`keywords`/`category`/`language`/`changeDescription` show as read-only - the
readers at `:133-140` and `:162-169` are the field list.

### fs `knowledge_workflow`

**Declared type:** `types/knowledge-workflow.ts#WorkflowArticle` (`types/knowledge-workflow.ts:132`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_workflow | types/knowledge-workflow.ts#WorkflowArticle-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `__name__` | `?` inferred | - | - | `services/knowledge-workflow.service.ts:518` | not in the type |
| `category` | `KnowledgeCategory` | yes | - | `services/knowledge-workflow.service.ts:720`<br>`services/knowledge-workflow.service.ts:771`<br>`services/knowledge-workflow.service.ts:788`<br>+1 more | declared |
| `committeeApprovals` | `CommitteeApproval` | no | - | - | declared, **no call site** |
| `content` | `string` | yes | - | `services/knowledge-workflow.service.ts:715`<br>`services/knowledge-workflow.service.ts:718`<br>`services/knowledge-workflow.service.ts:787`<br>+1 more | declared |
| `createdAt` | `Date` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:792`<br>`services/knowledge-workflow.service.ts:845` | declared |
| `createdBy` | `string` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:775`<br>`services/knowledge-workflow.service.ts:795`<br>`services/knowledge-workflow.service.ts:848` | declared |
| `currentVersion` | `number` | yes | `services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:729` | `services/knowledge-workflow.service.ts:733`<br>`services/knowledge-workflow.service.ts:799`<br>`services/knowledge-workflow.service.ts:852` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `isArchived` | `boolean` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:802`<br>`services/knowledge-workflow.service.ts:855` | declared |
| `isFeatured` | `boolean` | yes | `services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:801`<br>`services/knowledge-workflow.service.ts:854` | declared |
| `keywords` | `string[]` | yes | - | `services/knowledge-workflow.service.ts:719`<br>`services/knowledge-workflow.service.ts:789`<br>`services/knowledge-workflow.service.ts:842` | declared |
| `language` | `KnowledgeLanguage` | yes | - | `services/knowledge-workflow.service.ts:721`<br>`services/knowledge-workflow.service.ts:790`<br>`services/knowledge-workflow.service.ts:843` | declared |
| `lastReviewedAt` | `Date` | no | - | - | declared, **no call site** |
| `lastReviewedBy` | `string` | no | - | - | declared, **no call site** |
| `publishedAt` | `Date` | no | - | `services/knowledge-workflow.service.ts:794`<br>`services/knowledge-workflow.service.ts:847` | declared |
| `reviewedAt` | `?` inferred | - | - | `services/knowledge-workflow.service.ts:798`<br>`services/knowledge-workflow.service.ts:851` | not in the type |
| `reviewedBy` | `?` inferred | - | - | `services/knowledge-workflow.service.ts:797`<br>`services/knowledge-workflow.service.ts:850` | not in the type |
| `slug` | `string` | yes | - | `services/knowledge-workflow.service.ts:785`<br>`services/knowledge-workflow.service.ts:838` | declared |
| `status` | `WorkflowStatus` | yes | `services/knowledge-workflow.service.ts:522`<br>`services/knowledge-workflow.service.ts:651` | `services/knowledge-workflow.service.ts:220`<br>`services/knowledge-workflow.service.ts:767`<br>`services/knowledge-workflow.service.ts:791`<br>+1 more | declared |
| `title` | `string` | yes | - | `services/knowledge-workflow.service.ts:715`<br>`services/knowledge-workflow.service.ts:717`<br>`services/knowledge-workflow.service.ts:786`<br>+1 more | declared |
| `updatedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:522`<br>`services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:729`<br>+1 more | `services/knowledge-workflow.service.ts:778`<br>`services/knowledge-workflow.service.ts:793`<br>`services/knowledge-workflow.service.ts:846` | declared |
| `updatedBy` | `string` | yes | `services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:729`<br>`services/knowledge-workflow.service.ts:737` | `services/knowledge-workflow.service.ts:796`<br>`services/knowledge-workflow.service.ts:849` | declared |
| `versionId` | `string` | yes | `services/knowledge-workflow.service.ts:651`<br>`services/knowledge-workflow.service.ts:672`<br>`services/knowledge-workflow.service.ts:729` | `services/knowledge-workflow.service.ts:724`<br>`services/knowledge-workflow.service.ts:800`<br>`services/knowledge-workflow.service.ts:853` | declared |
<!--END-->

The editorial twin of `knowledge`: the same article exists in both, in two different shapes, with no
synchronisation code between them. `:518` orders by the `__name__` document-id sentinel (a Firestore
pseudo-field, not a stored one). `:1038` queries `createdBy` + `orderBy updatedAt desc` with no
index. `lastReviewedBy`/`lastReviewedAt` are declared on the type, but the stored fields are
`reviewedBy`/`reviewedAt`; the mapper at `:797-798` renames them on the way out, so the declared
names never exist in a document.

### fs `knowledge_workflow_actions`

**Declared type:** `types/knowledge-workflow.ts#WorkflowAction` (`types/knowledge-workflow.ts:48`)  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS knowledge_workflow_actions | types/knowledge-workflow.ts#WorkflowAction-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `action` | `WorkflowActionType` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:327` | declared |
| `articleId` | `string` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:319`<br>`services/knowledge-workflow.service.ts:326` | declared |
| `comment` | `string` | no | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:332` | declared |
| `fromStatus` | `WorkflowStatus` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:328` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `newVersionId` | `string` | no | - | - | declared, **no call site** |
| `performedAt` | `Date` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:320`<br>`services/knowledge-workflow.service.ts:331` | declared |
| `performedBy` | `string` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:330` | declared |
| `previousVersionId` | `string` | no | - | - | declared, **no call site** |
| `toStatus` | `WorkflowStatus` | yes | `services/knowledge-workflow.service.ts:224` | `services/knowledge-workflow.service.ts:329` | declared |
<!--END-->

The state-transition log. `services/knowledge-workflow.service.ts:318-320` queries `articleId` +
`orderBy performedAt desc` with no index. `previousVersionId` and `newVersionId` are declared and
never written.

### fs `members`

**Declared type:** `types/volunteer.ts#Member` (`types/volunteer.ts:1`)  
**Rule:** `firestore.rules:174`  
**Index:** none  
**Migration:** Firestore only - no Supabase table (the `volunteer_requests` table covers volunteers only).

<!--FIELDS members | types/volunteer.ts#Member-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `address` | `string` | yes | - | - | declared, **no call site** |
| `createdAt` | `string` | yes | `services/volunteer.service.ts:66` | `services/volunteer.service.ts:42` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `memberId` | `string` | yes | - | - | declared, **no call site** |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `phone` | `string` | yes | - | - | declared, **no call site** |
| `sex` | `"Male" \| "Female" \| "Other"` | yes | - | - | declared, **no call site** |
| `updatedAt` | `string` | yes | `services/volunteer.service.ts:66`<br>`services/volunteer.service.ts:73` | - | declared |
<!--END-->

Create and update are spreads (`services/volunteer.service.ts:66,73`); the written shape is
`MemberRequest` (`types/volunteer.ts:13`) plus `createdAt`/`updatedAt`. `services/volunteer.service.ts:42`
orders by `createdAt` with no `where`, so no index is needed.

### fs `messages`

**Declared type:** `types/ai.ts#AIMessage` (`types/ai.ts:5`)  
**Rule:** `firestore.rules:237`  
**Index:** **none for this name** - entry 15 declares `sessionId` + `timestamp` on `chat_messages` instead.  
**Migration:** Firestore only.

<!--FIELDS messages | types/ai.ts#AIMessage-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `content` | `string` | yes | - | `services/chat.service.ts:130` | declared |
| `detectedLanguage` | `DetectedLanguage` | no | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `latency` | `number` | no | - | `services/chat.service.ts:133` | declared |
| `model` | `string` | no | - | `services/chat.service.ts:132` | declared |
| `role` | `"user" \| "assistant" \| "system"` | yes | - | `services/chat.service.ts:129` | declared |
| `sessionId` | `?` inferred | - | - | `services/chat.service.ts:120` | not in the type |
| `timestamp` | `number` | yes | - | `services/chat.service.ts:121`<br>`services/chat.service.ts:131` | declared |
<!--END-->

The write payload is the variable `messageData` at `services/chat.service.ts:91-99`:
`sessionId`, `id`, `role`, `content`, `timestamp`, `model`, `latency`. Note `id` is stored *inside*
the document as well as being the doc id, and the reader at `:130` takes the stored one. The query at
`:118-121` (`sessionId` + `orderBy timestamp asc`) throws `FAILED_PRECONDITION` because the declared
index names the wrong collection - this is the single most consequential naming slip in the data
layer.

### fs `notifications`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS notifications-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `approved` | `?` inferred | - | - | `services/testimonial.service.ts:400` | not in the type |
| `createdAt` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `image` | `?` inferred | - | - | `services/testimonial.service.ts:399` | not in the type |
| `location` | `?` inferred | - | - | `services/testimonial.service.ts:396` | not in the type |
| `message` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `name` | `?` inferred | - | - | `services/testimonial.service.ts:395` | not in the type |
| `quote` | `?` inferred | - | - | `services/testimonial.service.ts:397` | not in the type |
| `read` | `?` inferred | - | `services/testimonial.service.ts:361`<br>`services/testimonial.service.ts:437` | `services/testimonial.service.ts:431` | not in the type |
| `readAt` | `?` inferred | - | `services/testimonial.service.ts:437` | - | not in the type |
| `relatedId` | `?` inferred | - | `services/testimonial.service.ts:361` | `services/testimonial.service.ts:429` | not in the type |
| `relatedType` | `?` inferred | - | `services/testimonial.service.ts:361` | `services/testimonial.service.ts:430` | not in the type |
| `title` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `type` | `?` inferred | - | `services/testimonial.service.ts:361` | - | not in the type |
| `years` | `?` inferred | - | - | `services/testimonial.service.ts:398` | not in the type |
<!--END-->

Written only when a public testimonial arrives (`services/testimonial.service.ts:361`), read back at
`:429-431` and marked read at `:437`. The `name`, `location`, `quote`, `years`, `image` and
`approved` rows below are testimonial fields harvested from `:395-400` by window proximity - treat
them as belonging to `testimonials`, not to a notification document. Real fields: `type`, `title`,
`message`, `relatedId`, `relatedType`, `read`, `readAt`, `createdAt`.

### fs `page_views`

**Declared type:** none - `services/pageviews.service.ts:46-55` is the schema.  
**Rule:** `firestore.rules:193` - public create.  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS page_views-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `country` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:51` | not in the type |
| `date` | `?` inferred | - | `services/pageviews.service.ts:46` | - | not in the type |
| `deviceType` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:49` | not in the type |
| `language` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:50` | not in the type |
| `path` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:47` | not in the type |
| `referrer` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:48` | not in the type |
| `timestamp` | `?` inferred | - | `services/pageviews.service.ts:46` | `services/pageviews.service.ts:115` | not in the type |
| `visitorId` | `?` inferred | - | `services/pageviews.service.ts:46` | - | not in the type |
<!--END-->

The largest collection in the project: `data/firestore-dump/README.md` puts it near 47,000
documents, which is why one full `npm run firestore:dump` exhausts the free-tier 50k daily read
quota. `visitorId` comes from `getOrCreateVisitorId()` and is written but never queried; `date` is
written but never filtered on. The analytics reader at `:114-115` orders by `timestamp` only.

### fs `panchanga`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** never lived in a database.

<!--FIELDS panchanga-->
_No field observed at any call site and no declared type._
<!--END-->

**Documented at `docs/DATA-MODEL.md:708-746` with a complete field list (`tithi`, `nakshatra`, `yoga`,
`karana`, `sunrise`, `sunset`, `rahuKaal`, `yamaganda`, `isEkadashi`, ...), and no code has ever
queried it.** The data is 730 JSON files under `data/panchanga/<year>/` plus
`public/data/panchanga/current.json`, read by `lib/ai/retrieval/panchanga.ts:42` and
`lib/aaradhane/panchanga.ts:65`. Anyone planning a Supabase migration from this document will
migrate an empty collection.

### fs `poojas`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS poojas-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `app/admin/content/page.tsx:92` | not in the type |
<!--END-->

Referenced exactly once, as a document count on the admin content dashboard
(`app/admin/content/page.tsx:95`). Distinct from `dailyPoojas`, which is the collection
`services/pooja.service.ts` actually uses - so the admin "poojas" tile counts a collection the pooja
admin never writes to. The `active` row is neighbouring-line noise.

### fs `profiles`

**Declared type:** `types/profile.ts#DevoteeProfile` (`types/profile.ts:38`)  
**Rule:** **none** - client access denied by default.  
**Index:** none  
**Migration:** Firestore only; the Supabase `profiles` table exists with no app code and folds
`bookmarks` into a `jsonb` column.

<!--FIELDS profiles | types/profile.ts#DevoteeProfile-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `bio` | `string` | no | - | - | declared, **no call site** |
| `bookmarks` | `Bookmark[]` | yes | - | - | declared, **no call site** |
| `createdAt` | `Timestamp \| Date` | yes | - | - | declared, **no call site** |
| `device` | `?` inferred | - | - | `services/profile.service.ts:180`<br>`services/profile.service.ts:181` | not in the type |
| `email` | `string` | yes | - | `services/profile.service.ts:111` | declared |
| `favorites` | `string[]` | yes | `services/profile.service.ts:269`<br>`services/profile.service.ts:290` | - | declared |
| `gotra` | `string` | no | - | - | declared, **no call site** |
| `language` | `?` inferred | - | - | `services/profile.service.ts:166`<br>`services/profile.service.ts:167` | not in the type |
| `nakshatra` | `string` | no | - | - | declared, **no call site** |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `notifications` | `?` inferred | - | - | `services/profile.service.ts:175`<br>`services/profile.service.ts:176` | not in the type |
| `phone` | `string` | no | - | - | declared, **no call site** |
| `preferences` | `UserPreferences` | yes | - | `services/profile.service.ts:114`<br>`services/profile.service.ts:115` | declared |
| `profileImage` | `string` | no | - | - | declared, **no call site** |
| `recentlyViewed` | `string[]` | yes | `services/profile.service.ts:314` | - | declared |
| `theme` | `?` inferred | - | - | `services/profile.service.ts:172`<br>`services/profile.service.ts:173` | not in the type |
| `timezone` | `?` inferred | - | - | `services/profile.service.ts:169`<br>`services/profile.service.ts:170` | not in the type |
| `uid` | `string` | yes | - | - | declared, **no call site** |
| `updatedAt` | `Timestamp \| Date` | yes | `services/profile.service.ts:141`<br>`services/profile.service.ts:269`<br>`services/profile.service.ts:290`<br>+1 more | - | declared |
<!--END-->

`services/profile.service.ts:106-121` writes with `{ merge: true }` (the `merge` key is a `setDoc`
option, filtered out of the table). The nested preference keys are read individually at `:166-181` -
`preferences.language`, `.timezone`, `.theme`, `.notifications`, `.device` - so a partial write of
`preferences` silently drops the others. `favorites` (`:269,290`) and `recentlyViewed` (`:314`) are
array fields written with `arrayUnion`-style replacement and never read back through a typed path.

### fs `quotes`

**Declared type:** `types/quote.ts#Quote` (`types/quote.ts:107`)  
**Rule:** `firestore.rules:274`  
**Index:** entry 19 `active` + `priority`; entry 20 `active` + `category` + `priority`.  
**Migration:** Firestore only - no Supabase table.

<!--FIELDS quotes | types/quote.ts#Quote-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | `services/quote.service.ts:263`<br>`services/quote.service.ts:198` | declared |
| `author` | `string` | no | - | `services/quote.service.ts:195` | declared |
| `category` | `QuoteCategory` | yes | - | `services/quote.service.ts:266`<br>`services/quote.service.ts:190` | declared |
| `content` | `QuoteContent` | yes | - | `services/quote.service.ts:193` | declared |
| `createdAt` | `string` | yes | `services/quote.service.ts:367`<br>`scripts/seed-quotes.ts:821` | `services/quote.service.ts:210` | declared |
| `createdBy` | `string` | no | - | `services/quote.service.ts:212` | declared |
| `displayFrom` | `string` | no | - | `services/quote.service.ts:205` | declared |
| `displayTo` | `string` | no | - | `services/quote.service.ts:206` | declared |
| `displayWeight` | `number` | yes | - | `services/quote.service.ts:207` | declared |
| `eventRules` | `{` | no | - | `services/quote.service.ts:204` | declared |
| `featured` | `boolean` | yes | - | `services/quote.service.ts:274`<br>`services/quote.service.ts:199` | declared |
| `festivalNames` | `FestivalName[]` | yes | - | `services/quote.service.ts:201` | declared |
| `festivalOnly` | `boolean` | yes | - | `services/quote.service.ts:278`<br>`services/quote.service.ts:200` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `language` | `QuoteLanguage` | yes | - | `services/quote.service.ts:270`<br>`services/quote.service.ts:192` | declared |
| `panchangaRules` | `PanchangaRules` | no | - | `services/quote.service.ts:203` | declared |
| `priority` | `number` | yes | - | `services/quote.service.ts:191` | declared |
| `rotationGroup` | `string` | no | - | `services/quote.service.ts:208` | declared |
| `slug` | `string` | yes | - | `services/quote.service.ts:349`<br>`services/quote.service.ts:188` | declared |
| `source` | `string` | yes | - | `services/quote.service.ts:194` | declared |
| `stats` | `{` | no | `services/quote.service.ts:367`<br>`scripts/seed-quotes.ts:821` | `services/quote.service.ts:209` | declared |
| `tags` | `string[]` | yes | - | `services/quote.service.ts:197` | declared |
| `title` | `string` | yes | - | `services/quote.service.ts:189` | declared |
| `updatedAt` | `string` | yes | `services/quote.service.ts:367`<br>`services/quote.service.ts:385`<br>`scripts/seed-quotes.ts:821` | `services/quote.service.ts:211` | declared |
| `verseNumber` | `number` | no | - | `services/quote.service.ts:196` | declared |
| `weekdayOnly` | `Weekday \| null` | yes | - | `services/quote.service.ts:282`<br>`services/quote.service.ts:202` | declared |
<!--END-->

The richest schema in the repo. `services/quote.service.ts:263-283` builds up to six equality
`where` constraints (`active`, `category`, `language`, `featured`, `festivalOnly`, `weekdayOnly`)
and then deliberately omits `orderBy` - the comment at `:287` says "sort in memory" and `:296` sorts
by `priority` in JavaScript. That is why the two declared composite indexes (`active`+`priority`,
`active`+`category`+`priority`) are never used: no query pairs a `where` with an `orderBy`. The
mapper at `:188-212` is the field list; `stats` is a nested counter object updated at `:367`.

### fs `receipts`

**Declared type:** `types/receipt.ts#Receipt` (`types/receipt.ts:11`)  
**Rule:** `firestore.rules:102` - server write only.  
**Index:** none  
**Migration:** Firestore only, despite holding money.

<!--FIELDS receipts | types/receipt.ts#Receipt-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | `lib/receipt/admin.ts:134` | `app/api/admin/receipts/route.ts:44`<br>`app/api/admin/receipts/route.ts:51`<br>`app/api/admin/receipts/route.ts:39` | declared |
| `createdBy` | `string` | yes | `lib/receipt/admin.ts:135` | - | declared |
| `devoteeAddress` | `string` | no | `lib/receipt/admin.ts:126` | - | declared |
| `devoteeEmail` | `string` | no | `lib/receipt/admin.ts:125` | - | declared |
| `devoteeName` | `string` | yes | `lib/receipt/admin.ts:123` | - | declared |
| `devoteePhone` | `string` | no | `lib/receipt/admin.ts:124` | - | declared |
| `emailDelivery` | `{ status: "not_requested" \| "pending" \| ` | no | - | - | declared, **no call site** - genuinely never written, `lib/receipt/admin.ts:121-136` omits it |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `items` | `ReceiptItem[]` | yes | `lib/receipt/admin.ts:127` | - | declared; built at `:104-110` (`sevaId`, `sevaName`, `rate`, `quantity`, `amount`) |
| `notes` | `string` | no | `lib/receipt/admin.ts:133` | - | declared |
| `paymentMode` | `PaymentMode` | yes | `lib/receipt/admin.ts:131` | - | declared |
| `paymentReference` | `string` | no | `lib/receipt/admin.ts:132` | - | declared |
| `receiptNumber` | `string` | yes | `lib/receipt/admin.ts:122` | - | declared; value allocated in a transaction at `:44-57` |
| `sevaIds` | `?` inferred | - | `lib/receipt/admin.ts:128` | `app/api/admin/receipts/route.ts:55` | not in the type - a denormalised filter key |
| `subtotal` | `number` | yes | `lib/receipt/admin.ts:129` | - | declared |
| `totalAmount` | `number` | yes | `lib/receipt/admin.ts:130` | - | declared |
| `whatsappDelivery` | `{ status: "not_requested" \| "pending" \| ` | no | - | - | declared, **no call site** - genuinely never written, `lib/receipt/admin.ts:121-136` omits it |
<!--END-->

Admin SDK only. Created by the receipt engine at `lib/receipt/admin.ts:139`, from the object literal
built at `:121-136`; the harvester could not see it because the payload goes through the variable
`receiptDoc`, so the write column above was filled in by hand on 2026-09-19. Listed at
`app/api/admin/receipts/route.ts:38-55` with an optional `sevaIds` filter and an `orderBy createdAt`.
The two nested delivery blocks (`emailDelivery`, `whatsappDelivery`, `types/receipt-extensions.ts:9`)
are **not** in that payload - nothing in the repository writes them, so a receipt on disk has no
delivery state at all. Fourteen of the seventeen fields are written here and read by nothing:
`app/api/admin/receipts/route.ts` returns whole documents to the client, which is why no per-field
read shows up. **Missing index.** That route composes `where("sevaIds", "array-contains", …)`
(`:55`) with `orderBy("createdAt", "desc")` (`:39`) and an optional `createdAt` range (`:44,51`);
an `array-contains` plus an order-by on another field needs a composite index, and
`firestore.indexes.json` declares nothing for `receipts`, so filtering the receipt list by seva
throws `FAILED_PRECONDITION`.

### fs `receiptSevas`

**Declared type:** `types/receiptSeva.ts#ReceiptSeva` (`types/receiptSeva.ts:1`)  
**Rule:** `firestore.rules:85` - the **only** rule block in the file that validates a payload.  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS receiptSevas | types/receiptSeva.ts#ReceiptSeva-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `amount` | `number` | yes | - | - | declared, **no call site** |
| `createdAt` | `string` | yes | `scripts/seed-receipt-sevas.ts:110` | - | declared |
| `description` | `string` | yes | - | - | declared, **no call site** |
| `displayOrder` | `number` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `name` | `string` | yes | - | `scripts/seed-receipt-sevas.ts:100` | declared |
| `updatedAt` | `string` | yes | `scripts/seed-receipt-sevas.ts:110` | - | declared |
<!--END-->

The receipt line-item catalogue, separate from `sevas`. Seeded idempotently by
`scripts/seed-receipt-sevas.ts:98-110`, which checks `name` before inserting. The admin API writes
the full shape at `app/api/admin/receipt-sevas/route.ts:75` and patches at
`app/api/admin/receipt-sevas/[id]/route.ts:55`; both are filed under `sevas` in `.claude/state/inventory/fields.json`
because the route resolves its collection constant to that name - see UNCLEAR.

### fs `sevaBookings`

**Declared type:** `types/seva-booking.ts#SevaBooking` (`types/seva-booking.ts:9`)  
**Rule:** `firestore.rules:113`  
**Index:** entry 4 `userId` + `preferredDate` DESC; entry 5 `status` + `createdAt` DESC.  
**Migration:** Firestore only; the Supabase `seva_bookings` table exists with no app code.

<!--FIELDS sevaBookings | types/seva-booking.ts#SevaBooking-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `string` | yes | `services/sevaBooking.service.ts:36` | `app/api/public/receipts/route.ts:28`<br>`app/api/public/receipts/route.ts:62`<br>`services/sevaBooking.service.ts:43`<br>+2 more | declared |
| `gotra` | `string` | no | - | `services/sevaBooking.service.ts:18` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `nakshatra` | `string` | no | - | `services/sevaBooking.service.ts:19` | declared |
| `notes` | `string` | yes | - | `app/api/public/receipts/route.ts:56`<br>`services/sevaBooking.service.ts:22` | declared |
| `paymentDate` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:60`<br>`services/sevaBooking.service.ts:26` | declared |
| `paymentMethod` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:61`<br>`services/sevaBooking.service.ts:27` | declared |
| `paymentReference` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:36`<br>`services/sevaBooking.service.ts:24` | declared |
| `paymentStatus` | `PaymentStatus` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:59`<br>`services/sevaBooking.service.ts:25` | declared |
| `preferredDate` | `string` | yes | - | `app/api/public/receipts/route.ts:55`<br>`services/sevaBooking.service.ts:21` | declared |
| `raashi` | `string` | no | - | `services/sevaBooking.service.ts:20` | declared |
| `sevaAmount` | `number` | yes | - | `app/api/public/receipts/route.ts:50`<br>`services/sevaBooking.service.ts:13` | declared |
| `sevaId` | `string` | yes | - | `app/api/public/receipts/route.ts:48`<br>`services/sevaBooking.service.ts:11` | declared |
| `sevaTitle` | `string` | yes | - | `app/api/public/receipts/route.ts:49`<br>`services/sevaBooking.service.ts:12` | declared |
| `status` | `SevaBookingStatus` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:78`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:57`<br>`services/sevaBooking.service.ts:23` | declared |
| `updatedAt` | `string` | yes | `services/sevaBooking.service.ts:36`<br>`services/sevaBooking.service.ts:78`<br>`services/sevaBooking.service.ts:83` | `app/api/public/receipts/route.ts:63`<br>`services/sevaBooking.service.ts:29` | declared |
| `userEmail` | `string` | yes | - | `app/api/public/receipts/route.ts:35`<br>`services/sevaBooking.service.ts:16` | declared |
| `userId` | `string` | yes | - | `app/api/public/receipts/route.ts:51`<br>`services/sevaBooking.service.ts:55`<br>`services/sevaBooking.service.ts:14` | declared |
| `userName` | `string` | yes | - | `app/api/public/receipts/route.ts:52`<br>`services/sevaBooking.service.ts:15` | declared |
| `userPhone` | `string` | yes | - | `app/api/public/receipts/route.ts:34`<br>`services/sevaBooking.service.ts:17` | declared |
<!--END-->

**Index mismatch.** `services/sevaBooking.service.ts:55` queries `userId` + `orderBy createdAt desc`,
but the declared index pairs `userId` with `preferredDate`, so "my bookings" throws. **Doc
mismatch.** `docs/DATA-MODEL.md:130-134` names the devotee fields `devoteeName`, `devoteeEmail`,
`devoteePhone`; the code uses `userName`, `userEmail`, `userPhone` (`types/seva-booking.ts:14-17`).
The document also claims `preferredTime`, `statusHistory`, `paymentId`, `paymentMode`, `bookedBy`,
`confirmedBy` and `confirmedAt` - none exist. `app/api/public/receipts/route.ts:20-63` reads this
collection (not `receipts`) to build public receipts, so a booking is also the receipt record.

### fs `sevas`

**Declared type:** `types/seva.ts#Seva` (`types/seva.ts:1`); the write shape is `SevaRequest` (`types/seva.ts:25`).  
**Rule:** `firestore.rules:76`  
**Index:** entry 2 `category` + `displayOrder` (unused); entry 3 `active` + `displayOrder` (used by `lib/ai/retrieval/sevas.ts:124-127`).  
**Migration:** **Split brain.** Reads come from Supabase (`app/actions/sevas.ts:6,13`, called by `services/seva.service.ts:11,44`); writes go to Firestore (`:76,81`).

<!--FIELDS sevas | types/seva.ts#Seva-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/admin/content/page.tsx:92`<br>`app/api/admin/receipt-sevas/route.ts:38`<br>`lib/ai/retrieval/sevas.ts:126`<br>+3 more | declared |
| `amount` | `number` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:37`<br>`lib/ai/firebaseChat.ts:111`<br>`lib/ai/retrieval/sevas.ts:105`<br>+3 more | declared |
| `category` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75` | `lib/ai/retrieval/sevas.ts:104`<br>`scripts/migrate-sevas.ts:68`<br>`scripts/migrate-sevas.ts:80` | declared |
| `createdAt` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75`<br>`services/seva.service.ts:76`<br>`scripts/seed-sevas.ts:93` | `app/api/admin/receipt-sevas/route.ts:40`<br>`scripts/migrate-sevas.ts:72`<br>`scripts/migrate-sevas.ts:73` | declared |
| `description` | `string` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:36`<br>`lib/ai/firebaseChat.ts:110`<br>`lib/ai/retrieval/sevas.ts:103`<br>+2 more | declared |
| `displayOrder` | `number` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:39`<br>`lib/ai/retrieval/sevas.ts:127`<br>`scripts/migrate-sevas.ts:85` | declared |
| `duration` | `number` | yes | `app/api/admin/receipt-sevas/route.ts:75` | `lib/ai/retrieval/sevas.ts:106`<br>`scripts/migrate-sevas.ts:70`<br>`scripts/migrate-sevas.ts:82` | declared |
| `firestore_id` | `?` inferred | - | - | `app/actions/sevas.ts:13`<br>`scripts/migrate-sevas.ts:143` | not in the type |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75` | `scripts/migrate-sevas.ts:83` | declared |
| `name` | `string` | yes | `app/api/admin/receipt-sevas/[id]/route.ts:55` | `app/api/admin/receipt-sevas/route.ts:35`<br>`lib/ai/firebaseChat.ts:109`<br>`lib/ai/retrieval/sevas.ts:102`<br>+5 more | declared |
| `price` | `?` inferred | - | - | `lib/ai/firebaseChat.ts:111` | not in the type |
| `updatedAt` | `string` | yes | `app/api/admin/receipt-sevas/route.ts:75`<br>`app/api/admin/receipt-sevas/[id]/route.ts:55`<br>`services/seva.service.ts:76`<br>+2 more | `app/api/admin/receipt-sevas/route.ts:41`<br>`scripts/migrate-sevas.ts:74` | declared |
<!--END-->

An admin edit writes Firestore and the public list keeps serving the Supabase row until someone
re-runs `scripts/migrate-sevas.ts`. The Supabase reader maps snake_case back to camelCase at
`services/seva.service.ts:12-25` (`image_url`→`imageUrl`, `display_order`→`displayOrder`,
`created_at`→`createdAt`) and, notably, uses `firestore_id` as the object's `id` (`:13,46`), so the
public seva id is the Firestore document id even when the row came from Postgres. The Firestore
fallback at `:34` returns raw `doc.data()` with no mapping, so the two paths return different shapes
on the same call. `lib/ai/firebaseChat.ts:111` reads a `price` field that no writer ever sets - but the same
expression is `data.price || data.amount || ""`, so the AI still gets the amount; the dead field
costs nothing at runtime.
The `receiptSevas` admin routes (`app/api/admin/receipt-sevas/*`) also land in this bucket.

### fs `settings`

**Declared type:** `types/settings.ts#SiteSettings` covers one document only; the rest have no type.  
**Rule:** `firestore.rules:136` **and** `firestore.rules:231` - a duplicate `match /settings/{docId}` whose second copy is `allow write: if true`.  
**Index:** none  
**Migration:** partly replaced by Supabase `site_settings` and `social_links`; everything else is Firestore only.

<!--FIELDS settings | types/settings.ts#SiteSettings-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `aboutContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:195`<br>`app/admin/settings/about/page.tsx:373` | not in the type |
| `aboutContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:196`<br>`app/(public)/about/page.tsx:197`<br>`app/admin/settings/about/page.tsx:384` | not in the type |
| `aboutTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:191`<br>`app/admin/settings/about/page.tsx:363` | not in the type |
| `activities` | `?` inferred | - | - | `app/(public)/about/page.tsx:233`<br>`app/admin/settings/about/page.tsx:419`<br>`app/admin/settings/about/page.tsx:422`<br>+1 more | not in the type |
| `activitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:229`<br>`app/admin/settings/about/page.tsx:403` | not in the type |
| `address` | `string` | yes | - | `app/(public)/about/page.tsx:317`<br>`app/admin/settings/about/page.tsx:547`<br>`app/admin/settings/footer/page.tsx:262`<br>+3 more | declared |
| `amenities` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:218`<br>`app/(public)/facilities/page.tsx:231`<br>`app/admin/settings/facilities/page.tsx:469`<br>+1 more | not in the type |
| `amenitiesSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:227`<br>`app/admin/settings/facilities/page.tsx:451` | not in the type |
| `amenitiesTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:224`<br>`app/admin/settings/facilities/page.tsx:441` | not in the type |
| `billing` | `?` inferred | - | `app/admin/billing/settings/page.tsx:78` | `app/admin/billing/create/page.tsx:54`<br>`app/admin/billing/create/page.tsx:56`<br>`app/admin/billing/settings/page.tsx:50`<br>+25 more | not in the type |
| `billingEnabled` | `?` inferred | - | `app/admin/billing/settings/page.tsx:78` | `app/admin/billing/page.tsx:53`<br>`app/admin/billing/page.tsx:54`<br>`app/admin/settings/finance/page.tsx:35`<br>+3 more | not in the type |
| `calendarLinks` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:166`<br>`app/admin/settings/footer/page.tsx:371` | not in the type |
| `categories` | `?` inferred | - | - | `app/admin/settings/shlokas/page.tsx:301` | not in the type |
| `communityContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:360`<br>`app/admin/settings/about/page.tsx:611` | not in the type |
| `communityContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:361`<br>`app/(public)/about/page.tsx:362`<br>`app/admin/settings/about/page.tsx:622` | not in the type |
| `communityQuote` | `?` inferred | - | - | `app/(public)/about/page.tsx:365`<br>`app/admin/settings/about/page.tsx:634` | not in the type |
| `communityQuoteKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:367`<br>`app/(public)/about/page.tsx:369`<br>`app/admin/settings/about/page.tsx:645` | not in the type |
| `communityTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:356`<br>`app/admin/settings/about/page.tsx:601` | not in the type |
| `contactEmail` | `string` | yes | - | `app/api/admin/receipts/[id]/pdf/route.ts:37`<br>`lib/ai/retrieval/settings.ts:59`<br>`scripts/migrate-settings.ts:36` | declared |
| `contactPhone` | `string` | yes | - | `app/api/admin/receipts/[id]/pdf/route.ts:36`<br>`lib/ai/retrieval/settings.ts:58` | declared |
| `copyrightText` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:403` | not in the type |
| `currentYear` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:412` | not in the type |
| `email` | `?` inferred | - | - | `app/(public)/about/page.tsx:337`<br>`app/(public)/about/page.tsx:340`<br>`app/(public)/about/page.tsx:341`<br>+5 more | not in the type |
| `eveningClose` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:380`<br>`lib/ai/retrieval/settings.ts:67` | not in the type |
| `eveningOpen` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:369`<br>`lib/ai/retrieval/settings.ts:66` | not in the type |
| `eveningSchedule` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:150`<br>`app/admin/settings/puja-schedule/page.tsx:398` | not in the type |
| `eveningTitle` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:358` | not in the type |
| `facebook` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:176`<br>`app/admin/settings/social-links/page.tsx:181`<br>`app/admin/settings/social-links/page.tsx:183` | not in the type |
| `facilities` | `?` inferred | - | - | `app/(public)/about/page.tsx:203`<br>`app/(public)/about/page.tsx:213`<br>`app/(public)/facilities/page.tsx:180`<br>+3 more | not in the type |
| `facilitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:209` | not in the type |
| `festivalNote` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:427` | not in the type |
| `festivalNoteKannada` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:438` | not in the type |
| `footerText` | `string` | no | - | - | declared, **no call site** |
| `googleMapsUrl` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:70` | not in the type |
| `gurus` | `?` inferred | - | - | `app/admin/settings/guru-parampara/page.tsx:225`<br>`app/admin/settings/guru-parampara/page.tsx:246`<br>`app/admin/settings/guru-parampara/page.tsx:361`<br>+2 more | not in the type |
| `heading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:159`<br>`app/(public)/trust/page.tsx:114`<br>`app/admin/settings/ekadashi-calendar/page.tsx:194`<br>+7 more | not in the type |
| `headingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:162`<br>`app/(public)/trust/page.tsx:117`<br>`app/admin/settings/ekadashi-calendar/page.tsx:205`<br>+6 more | not in the type |
| `heroImageUrl` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:155`<br>`app/(public)/facilities/page.tsx:158`<br>`app/(public)/facilities/page.tsx:247`<br>+3 more | not in the type |
| `heroSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:173`<br>`app/admin/settings/facilities/page.tsx:301` | not in the type |
| `heroTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:170`<br>`app/admin/settings/facilities/page.tsx:291` | not in the type |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `instagram` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:221`<br>`app/admin/settings/social-links/page.tsx:226`<br>`app/admin/settings/social-links/page.tsx:228` | not in the type |
| `isTempleOpen` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:217` | not in the type |
| `linkedin` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:387` | not in the type |
| `logoUrl` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:245` | not in the type |
| `mapUrl` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:307`<br>`app/admin/settings/social-links/page.tsx:420`<br>`app/admin/settings/social-links/page.tsx:425`<br>+1 more | not in the type |
| `members` | `?` inferred | - | - | `app/(public)/trust/page.tsx:76`<br>`app/admin/settings/trust-committee/page.tsx:114`<br>`app/admin/settings/trust-committee/page.tsx:233`<br>+3 more | not in the type |
| `morningClose` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:310`<br>`lib/ai/retrieval/settings.ts:63` | not in the type |
| `morningOpen` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:299`<br>`lib/ai/retrieval/settings.ts:62` | not in the type |
| `morningSchedule` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:130`<br>`app/admin/settings/puja-schedule/page.tsx:328` | not in the type |
| `morningTitle` | `?` inferred | - | - | `app/admin/settings/puja-schedule/page.tsx:288` | not in the type |
| `pageSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:185`<br>`app/admin/settings/facilities/page.tsx:343` | not in the type |
| `pageTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:184`<br>`app/admin/settings/facilities/page.tsx:332` | not in the type |
| `phone` | `?` inferred | - | - | `app/(public)/about/page.tsx:329`<br>`app/admin/settings/about/page.tsx:560`<br>`app/admin/settings/footer/page.tsx:274`<br>+3 more | not in the type |
| `phone2` | `?` inferred | - | - | `app/(public)/about/page.tsx:331`<br>`app/(public)/about/page.tsx:334`<br>`app/admin/settings/about/page.tsx:571`<br>+2 more | not in the type |
| `plans` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:123`<br>`app/admin/settings/future-plans/page.tsx:189`<br>`app/admin/settings/future-plans/page.tsx:307`<br>+3 more | not in the type |
| `quickLinks` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:154`<br>`app/admin/settings/footer/page.tsx:319` | not in the type |
| `resourcesContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:288` | not in the type |
| `resourcesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:279` | not in the type |
| `sacredMotto` | `?` inferred | - | - | `app/(public)/about/page.tsx:167`<br>`app/(public)/about/page.tsx:171`<br>`app/(public)/about/page.tsx:174`<br>+1 more | not in the type |
| `samvatsara` | `?` inferred | - | - | `app/admin/settings/ekadashi-calendar/page.tsx:216`<br>`app/admin/settings/festival-calendar/page.tsx:206` | not in the type |
| `samvatsaraKannada` | `?` inferred | - | - | `app/admin/settings/ekadashi-calendar/page.tsx:227`<br>`app/admin/settings/festival-calendar/page.tsx:217` | not in the type |
| `sectionSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:275`<br>`app/admin/settings/facilities/page.tsx:514` | not in the type |
| `sectionTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:272`<br>`app/admin/settings/facilities/page.tsx:504` | not in the type |
| `sevaContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:252`<br>`app/admin/settings/about/page.tsx:476` | not in the type |
| `sevaContentKannada` | `?` inferred | - | - | `app/admin/settings/about/page.tsx:487` | not in the type |
| `sevaItems` | `?` inferred | - | - | `app/(public)/about/page.tsx:254`<br>`app/admin/settings/about/page.tsx:505` | not in the type |
| `sevaTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:248`<br>`app/admin/settings/about/page.tsx:466` | not in the type |
| `sevasLinks` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:160`<br>`app/admin/settings/footer/page.tsx:345` | not in the type |
| `shlokas` | `?` inferred | - | - | `app/admin/settings/shlokas/page.tsx:133`<br>`app/admin/settings/shlokas/page.tsx:141`<br>`app/admin/settings/shlokas/page.tsx:147`<br>+3 more | not in the type |
| `showFacebook` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:166` | not in the type |
| `showInstagram` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:211` | not in the type |
| `showLinkedin` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:378` | not in the type |
| `showMap` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:410` | not in the type |
| `showTwitter` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:346` | not in the type |
| `showWhatsapp` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:301` | not in the type |
| `showYoutube` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:256` | not in the type |
| `subheading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:165`<br>`app/(public)/trust/page.tsx:120`<br>`app/admin/settings/future-plans/page.tsx:277`<br>+4 more | not in the type |
| `subheadingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:168`<br>`app/(public)/trust/page.tsx:123`<br>`app/admin/settings/future-plans/page.tsx:288`<br>+4 more | not in the type |
| `subtitle` | `?` inferred | - | - | `app/api/admin/receipts/[id]/pdf/route.ts:34` | not in the type |
| `tagline` | `?` inferred | - | - | `app/admin/settings/about/page.tsx:294` | not in the type |
| `tagline2` | `?` inferred | - | - | `app/(public)/about/page.tsx:160`<br>`app/admin/settings/about/page.tsx:316` | not in the type |
| `taglineKannada` | `?` inferred | - | - | `app/admin/settings/about/page.tsx:305` | not in the type |
| `templeName` | `string` | yes | - | `app/(public)/about/page.tsx:157`<br>`app/admin/settings/about/page.tsx:272`<br>`app/admin/settings/footer/page.tsx:223`<br>+3 more | declared |
| `templeNameKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:154`<br>`app/admin/settings/about/page.tsx:283` | not in the type |
| `templeSubtitle` | `?` inferred | - | - | `app/admin/settings/footer/page.tsx:234` | not in the type |
| `twitter` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:355` | not in the type |
| `updatedAt` | `any` | no | `app/admin/billing/settings/page.tsx:78`<br>`app/admin/settings/about/page.tsx:153`<br>`app/admin/settings/ekadashi-calendar/page.tsx:89`<br>+11 more | `app/api/admin/receipts/[id]/pdf/route.ts:27`<br>`lib/ai/retrieval/settings.ts:45` | declared |
| `visitTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:307`<br>`app/admin/settings/about/page.tsx:536`<br>`scripts/check-about-us.ts:58` | not in the type |
| `welcomeMessage` | `string` | no | - | - | declared, **no call site** |
| `whatsapp` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:311`<br>`app/admin/settings/social-links/page.tsx:316`<br>`app/admin/settings/social-links/page.tsx:318` | not in the type |
| `youtube` | `?` inferred | - | - | `app/admin/settings/social-links/page.tsx:266`<br>`app/admin/settings/social-links/page.tsx:271`<br>`app/admin/settings/social-links/page.tsx:273` | not in the type |
<!--END-->

**This is not one schema but eleven documents keyed by id**, each with its own shape. The table above
is their union. Confirmed document ids and their owners:

| document | written by | read by | shape |
|---|---|---|---|
| `settings/aboutUs` | `app/admin/settings/about/page.tsx:153` | `app/(public)/about/page.tsx:112` | 26 fields - see sub-table below |
| `settings/facilities` | `app/admin/settings/facilities/page.tsx:166` | `app/(public)/facilities/page.tsx:126` | 11 fields |
| `settings/futurePlans` | `app/admin/settings/future-plans/page.tsx:152`, `scripts/seed-future-plans.ts:71` | `app/(public)/future-plans/page.tsx:108` | 5 fields |
| `settings/trustCommittee` | `app/admin/settings/trust-committee/page.tsx:78`, `scripts/seed-trust-committee.ts:218` | `app/(public)/trust/page.tsx:61` | 5 fields |
| `settings/footer` | `app/admin/settings/footer/page.tsx:114` | `components/layout/Footer.tsx:70` | `logoUrl`, `templeName`, `templeSubtitle`, `address`, `phone`, `phone2`, `email`, `mapUrl`, `quickLinks`, `sevasLinks`, `calendarLinks`, `copyrightText`, `currentYear` |
| `settings/socialLinks` | `app/admin/settings/social-links/page.tsx:88` | nothing - the site reads Supabase `social_links` instead | `facebook`, `instagram`, `youtube`, `whatsapp`, `twitter`, `linkedin`, `mapUrl` + seven `show*` booleans |
| `settings/ai` | `lib/ai/settings.ts:68` | `lib/ai/settings.ts:39` | AI prompt/config block + `updatedAt` |
| `settings/device` | `lib/device/settings.ts:89` | `lib/device/settings.ts:53` | `types/device.ts#DeviceSettings` (`types/device.ts:236`) |
| `settings/config` | none | `services/proof-report/database-export.service.ts:85` | read-only diagnostic |
| `settings/financeSettings` | `app/admin/settings/finance/page.tsx:70`, `scripts/update-finance-settings.ts:52` | `hooks/useFinanceSettings.ts:22` | `types/finance.ts#FinanceSettings` (`types/finance.ts:1`) |
| `settings/<billing>` | `app/admin/billing/settings/page.tsx:78` | `app/admin/billing/create/page.tsx:47`, `app/admin/billing/page.tsx:49` | `billing` (a `BillingSettings` block), `billingEnabled`, `updatedAt` |

Per-document field harvests (the harvester opens a bucket per literal document id):

<!--FIELDS settings/aboutUs-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `aboutContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:195` | not in the type |
| `aboutContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:196`<br>`app/(public)/about/page.tsx:197` | not in the type |
| `aboutTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:191` | not in the type |
| `activities` | `?` inferred | - | - | `app/(public)/about/page.tsx:233` | not in the type |
| `activitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:229` | not in the type |
| `address` | `?` inferred | - | - | `app/(public)/about/page.tsx:317` | not in the type |
| `communityContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:360` | not in the type |
| `communityContentKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:361`<br>`app/(public)/about/page.tsx:362` | not in the type |
| `communityQuote` | `?` inferred | - | - | `app/(public)/about/page.tsx:365` | not in the type |
| `communityQuoteKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:367`<br>`app/(public)/about/page.tsx:369` | not in the type |
| `communityTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:356` | not in the type |
| `email` | `?` inferred | - | - | `app/(public)/about/page.tsx:337`<br>`app/(public)/about/page.tsx:340`<br>`app/(public)/about/page.tsx:341` | not in the type |
| `facilities` | `?` inferred | - | - | `app/(public)/about/page.tsx:203`<br>`app/(public)/about/page.tsx:213` | not in the type |
| `facilitiesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:209` | not in the type |
| `phone` | `?` inferred | - | - | `app/(public)/about/page.tsx:329` | not in the type |
| `phone2` | `?` inferred | - | - | `app/(public)/about/page.tsx:331`<br>`app/(public)/about/page.tsx:334` | not in the type |
| `resourcesContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:288` | not in the type |
| `resourcesTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:279` | not in the type |
| `sacredMotto` | `?` inferred | - | - | `app/(public)/about/page.tsx:167`<br>`app/(public)/about/page.tsx:171`<br>`app/(public)/about/page.tsx:174` | not in the type |
| `sevaContent` | `?` inferred | - | - | `app/(public)/about/page.tsx:252` | not in the type |
| `sevaItems` | `?` inferred | - | - | `app/(public)/about/page.tsx:254` | not in the type |
| `sevaTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:248` | not in the type |
| `tagline2` | `?` inferred | - | - | `app/(public)/about/page.tsx:160` | not in the type |
| `templeName` | `?` inferred | - | - | `app/(public)/about/page.tsx:157` | not in the type |
| `templeNameKannada` | `?` inferred | - | - | `app/(public)/about/page.tsx:154` | not in the type |
| `visitTitle` | `?` inferred | - | - | `app/(public)/about/page.tsx:307` | not in the type |
<!--END-->

<!--FIELDS settings/facilities-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `amenities` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:218`<br>`app/(public)/facilities/page.tsx:231` | not in the type |
| `amenitiesSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:227` | not in the type |
| `amenitiesTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:224` | not in the type |
| `facilities` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:180`<br>`app/(public)/facilities/page.tsx:189` | not in the type |
| `heroImageUrl` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:155`<br>`app/(public)/facilities/page.tsx:158`<br>`app/(public)/facilities/page.tsx:247`<br>+1 more | not in the type |
| `heroSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:173` | not in the type |
| `heroTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:170` | not in the type |
| `pageSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:185` | not in the type |
| `pageTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:184` | not in the type |
| `sectionSubtitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:275` | not in the type |
| `sectionTitle` | `?` inferred | - | - | `app/(public)/facilities/page.tsx:272` | not in the type |
<!--END-->

<!--FIELDS settings/futurePlans-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `heading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:159` | not in the type |
| `headingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:162` | not in the type |
| `plans` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:123` | not in the type |
| `subheading` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:165` | not in the type |
| `subheadingKannada` | `?` inferred | - | - | `app/(public)/future-plans/page.tsx:168` | not in the type |
<!--END-->

<!--FIELDS settings/trustCommittee-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `heading` | `?` inferred | - | - | `app/(public)/trust/page.tsx:114` | not in the type |
| `headingKannada` | `?` inferred | - | - | `app/(public)/trust/page.tsx:117` | not in the type |
| `members` | `?` inferred | - | - | `app/(public)/trust/page.tsx:76` | not in the type |
| `subheading` | `?` inferred | - | - | `app/(public)/trust/page.tsx:120` | not in the type |
| `subheadingKannada` | `?` inferred | - | - | `app/(public)/trust/page.tsx:123` | not in the type |
<!--END-->

Three things follow from this. (1) `docs/DATA-MODEL.md:488-495` claims a single document
`settings/main` holding a `TempleSettings` object with `{en, kn}` sub-objects - that document does
not exist. (2) The AI reads a *different* set of keys again through
`lib/ai/retrieval/settings.ts:56-70` (`templeName`, `contactPhone`, `contactEmail`, `address`,
`morningOpen`, `morningClose`, `eveningOpen`, `eveningClose`, `googleMapsUrl`), scanning the whole
collection rather than naming a document (`:44`). (3) The duplicate rule at `firestore.rules:231`
makes every settings document world-writable, which is the highest-severity item in this file.

### fs `system`

**Declared type:** none.  
**Rule:** `firestore.rules:108` - deny all; server SDK only.  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS system-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `lastNumber` | `?` inferred | - | `lib/receipt/admin.ts:53` | - | not in the type |
| `prefix` | `?` inferred | - | `lib/receipt/admin.ts:53` | - | not in the type |
| `year` | `?` inferred | - | `lib/receipt/admin.ts:53` | - | not in the type |
<!--END-->

One document, the receipt counter. `lib/receipt/admin.ts:46-56` runs a transaction that reads
`counterSnap.data()` (invisible to the harvester) and writes `{ year, lastNumber, prefix }` with
`{ merge: false }` at `:53`. `merge: false` means any future field added to this document is wiped on
the next receipt.

### fs `temple_areas`

**Declared type:** `types/temple-explorer.ts#TempleArea` (`types/temple-explorer.ts:6`)  
**Rule:** `firestore.rules:252`  
**Index:** none  
**Migration:** **Supabase only** - the Firestore path is dead.

<!--FIELDS temple_areas | types/temple-explorer.ts#TempleArea-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `bestTimeToVisit` | `string` | no | - | - | declared, **no call site** |
| `best_time_to_visit` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:180` | not in the type |
| `category` | `TempleAreaCategory` | yes | - | `services/temple-areas.supabase.service.ts:178` | declared |
| `description` | `string` | yes | - | `services/temple-areas.supabase.service.ts:174` | declared |
| `features` | `string[]` | no | - | `services/temple-areas.supabase.service.ts:179` | declared |
| `firestore_id` | `?` inferred | - | `scripts/seed-temple-areas.ts:37` | - | not in the type |
| `has360View` | `boolean` | no | - | - | declared, **no call site** |
| `has360_view` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:182` | not in the type |
| `icon` | `string` | yes | - | `services/temple-areas.supabase.service.ts:176` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `imageUrl` | `string` | no | - | - | declared, **no call site** |
| `image_url` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:177` | not in the type |
| `name` | `string` | yes | - | `services/temple-areas.supabase.service.ts:172` | declared |
| `nameKannada` | `string` | no | - | - | declared, **no call site** |
| `name_kannada` | `?` inferred | - | - | `services/temple-areas.supabase.service.ts:173` | not in the type |
| `order` | `number` | no | - | `services/temple-areas.supabase.service.ts:18`<br>`services/temple-areas.supabase.service.ts:41`<br>`services/temple-areas.supabase.service.ts:183` | declared |
| `significance` | `string` | no | - | `services/temple-areas.supabase.service.ts:175` | declared |
| `tips` | `string[]` | no | - | `services/temple-areas.supabase.service.ts:181` | declared |
<!--END-->

The rule guards a collection no code reads; `services/temple-areas.supabase.service.ts` is the only
reader and it targets Postgres. The rows below are the Supabase column reads, filed here because the
two stores share a name - see `sb temple_areas` for the authoritative column list.
`types/temple-explorer.ts` also exports the `TEMPLE_AREAS` constant used as a static fallback.

### fs `test`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** n/a.

<!--FIELDS test-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `createdAt` | `?` inferred | - | `app/admin/test/page.tsx:15` | - | not in the type |
| `message` | `?` inferred | - | `app/admin/test/page.tsx:15` | - | not in the type |
<!--END-->

Debug leftover. `app/admin/test/page.tsx:15` writes `{ message, createdAt }` from a page that ships
in the production build.

### fs `testimonials`

**Declared type:** `types/homepage.ts#Testimonial` (`types/homepage.ts:133`); `types/ai.ts:58` declares a second, different `Testimonial`.  
**Rule:** `firestore.rules:167` - public create.  
**Index:** entry 13, `approved` + `createdAt` DESC.  
**Migration:** Firestore only; the Supabase `testimonials` table exists with no app code.

<!--FIELDS testimonials | types/homepage.ts#Testimonial-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `approved` | `boolean` | no | `services/chat.service.ts:193`<br>`services/testimonial.service.ts:120` | `app/admin/content/page.tsx:98`<br>`services/chat.service.ts:160`<br>`services/chat.service.ts:178`<br>+5 more | declared |
| `createdAt` | `number \| Date` | no | - | `services/chat.service.ts:161`<br>`services/chat.service.ts:179`<br>`services/chat.service.ts:169`<br>+8 more | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `image` | `string` | no | - | `services/testimonial.service.ts:94`<br>`services/testimonial.service.ts:160`<br>`services/testimonial.service.ts:203`<br>+2 more | declared |
| `location` | `string` | yes | - | `services/testimonial.service.ts:91`<br>`services/testimonial.service.ts:157`<br>`services/testimonial.service.ts:200`<br>+1 more | declared |
| `name` | `string` | yes | - | `services/testimonial.service.ts:90`<br>`services/testimonial.service.ts:156`<br>`services/testimonial.service.ts:199`<br>+1 more | declared |
| `phone` | `string` | no | - | `services/testimonial.service.ts:95` | declared |
| `quote` | `string` | yes | - | `services/testimonial.service.ts:92`<br>`services/testimonial.service.ts:158`<br>`services/testimonial.service.ts:201`<br>+1 more | declared |
| `rejected` | `boolean` | no | `services/testimonial.service.ts:120` | `services/testimonial.service.ts:97` | declared |
| `rejectionReason` | `string` | no | `services/testimonial.service.ts:120` | `services/testimonial.service.ts:98` | declared |
| `reviewedAt` | `?` inferred | - | `services/testimonial.service.ts:120` | - | not in the type |
| `submittedBy` | `'admin' \| 'public'` | no | - | `services/testimonial.service.ts:79`<br>`services/testimonial.service.ts:99` | declared |
| `years` | `string` | yes | - | `services/testimonial.service.ts:93`<br>`services/testimonial.service.ts:159`<br>`services/testimonial.service.ts:202`<br>+1 more | declared |
<!--END-->

`services/testimonial.service.ts:77-81` queries `submittedBy` + `approved` + `orderBy createdAt` -
three fields against a two-field index, so it throws. Public submissions upload an image to Firebase
Storage under `testimonials/**`, which `storage.rules:5-8` leaves readable and writable by anyone.
`phone` is collected (`:95`) and never shown. Two competing `Testimonial` types exist; the chat flow
(`services/chat.service.ts:193`) writes the `types/ai.ts` shape into the same collection.

### fs `timings`

**Declared type:** none.  
**Rule:** `firestore.rules:71`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS timings-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `close` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:97` | not in the type |
| `eveningClose` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:101` | not in the type |
| `eveningOpen` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:100` | not in the type |
| `morningClose` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:97` | not in the type |
| `morningOpen` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:96` | not in the type |
| `open` | `?` inferred | - | - | `lib/ai/retrieval/settings.ts:96` | not in the type |
<!--END-->

Read by one file, `lib/ai/retrieval/settings.ts:87-101`, which takes only `snapshot.docs[0]` and
accepts two competing shapes in the same document - `morningOpen`/`morningClose`/`eveningOpen`/
`eveningClose`, or bare `open`/`close` as a fallback (`:96-97`). Nothing writes it; the admin edits
opening hours in `settings/aboutUs` and `settings/<pujaSchedule>` instead, so this collection is
whatever was seeded once.

### fs `trust`

**Declared type:** none.  
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS trust-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `name` | `?` inferred | - | - | `lib/ai/firebaseChat.ts:124` | not in the type |
| `position` | `?` inferred | - | - | `lib/ai/firebaseChat.ts:125` | not in the type |
| `role` | `?` inferred | - | - | `lib/ai/firebaseChat.ts:125` | not in the type |
<!--END-->

Read exactly once, by the AI (`lib/ai/firebaseChat.ts:120-125`), which accepts either `role` or
`position` for the same concept. Nothing writes it. The trust committee the admin actually edits is
the document `settings/trustCommittee`, so the AI answers trust questions from a stale, separately
seeded collection.

### fs `trustCommittee`

**Declared type:** none.  
**Rule:** `firestore.rules:161`  
**Index:** none  
**Migration:** n/a.

<!--FIELDS trustCommittee-->
_No field observed at any call site and no declared type._
<!--END-->

**No code touches this collection.** The data is in the document `settings/trustCommittee`
(`app/(public)/trust/page.tsx:61`).

### fs `unknown_questions`

**Declared type:** `types/analytics.ts#UnknownQuestion` (`types/analytics.ts:5`) for the Firestore  
document; `types/ai-settings.ts#UnknownQuestion` (`types/ai-settings.ts:163`) for the Supabase row.
**Rule:** `firestore.rules:219`  
**Index:** none  
**Migration:** **Both stores, written by different callers.** Firestore: `services/analytics.service.ts:31`
and `lib/ai/unknown-logger.ts:13`. Supabase: `lib/ai/ai-settings/repository.ts:391-392`.

<!--FIELDS unknown_questions | types/analytics.ts#UnknownQuestion-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `aiBehavior` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:166` | - | not in the type |
| `aiResponses` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:157` | - | not in the type |
| `assigned_to` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:392` | `lib/ai/ai-settings/repository.ts:456` | not in the type |
| `confidence` | `number` | yes | `lib/ai/ai-settings/repository.ts:392` | `app/admin/ai/analytics/page.tsx:353`<br>`lib/ai/unknown-logger.ts:161` | declared |
| `createdAt` | `?` inferred | - | - | `app/admin/ai/analytics/page.tsx:379`<br>`app/admin/ai/analytics/page.tsx:380` | not in the type |
| `detectedIntent` | `string` | yes | - | `app/admin/ai/analytics/page.tsx:354`<br>`services/analytics.service.ts:138`<br>`lib/ai/unknown-logger.ts:160`<br>+1 more | declared |
| `detected_intent` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:392` | - | not in the type |
| `id` | `string` | no | - | - | declared, **no call site**; doc id, not a stored field |
| `intents` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:323` | - | not in the type |
| `language` | `"en" \| "kn" \| "mixed"` | yes | `lib/ai/ai-settings/repository.ts:392` | `lib/ai/unknown-logger.ts:162`<br>`lib/ai/unknown-logger.ts:219` | declared |
| `last_asked` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:428` | - | not in the type |
| `metadata` | `Record<string, unknown>` | no | - | - | declared, **no call site** |
| `processed` | `?` inferred | - | `services/analytics.service.ts:31` | - | not in the type |
| `prompt` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:177` | - | not in the type |
| `question` | `string` | yes | `lib/ai/ai-settings/repository.ts:392` | `app/admin/ai/analytics/page.tsx:352`<br>`services/analytics.service.ts:36`<br>`lib/ai/unknown-logger.ts:158` | declared |
| `question_lower` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:392` | `lib/ai/ai-settings/repository.ts:418` | not in the type |
| `reviewed` | `?` inferred | - | - | `app/admin/ai/analytics/page.tsx:356`<br>`lib/ai/unknown-logger.ts:163`<br>`lib/ai/unknown-logger.ts:210` | not in the type |
| `sessionId` | `string` | no | - | - | declared, **no call site** |
| `session_id` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:392` | - | not in the type |
| `status` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:392` | `lib/ai/ai-settings/admin-repository.ts:274`<br>`lib/ai/ai-settings/repository.ts:455` | not in the type |
| `templeInformation` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:124` | - | not in the type |
| `templePolicies` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:148` | - | not in the type |
| `times_asked` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:392`<br>`lib/ai/ai-settings/repository.ts:428` | `lib/ai/ai-settings/repository.ts:429`<br>`lib/ai/ai-settings/repository.ts:417` | not in the type |
| `timestamp` | `Date` | yes | `services/analytics.service.ts:31`<br>`lib/ai/ai-settings/repository.ts:392` | `app/admin/ai/analytics/page.tsx:247`<br>`app/admin/ai/analytics/page.tsx:249`<br>`app/admin/ai/analytics/page.tsx:350`<br>+11 more | declared |
| `updatedAt` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:102`<br>`lib/ai/ai-settings/repository.ts:112`<br>`lib/ai/ai-settings/repository.ts:124`<br>+6 more | `lib/ai/ai-settings/repository.ts:70` | not in the type |
| `updatedBy` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:112`<br>`lib/ai/ai-settings/repository.ts:124`<br>`lib/ai/ai-settings/repository.ts:136`<br>+5 more | - | not in the type |
| `userAgent` | `string` | no | - | - | declared, **no call site** |
| `visitorInformation` | `?` inferred | - | `lib/ai/ai-settings/repository.ts:136` | - | not in the type |
<!--END-->

The two shapes are not the same. Firestore gets `question`, `detectedIntent`, `confidence`,
`language`, `sessionId`, `timestamp` and `processed`. Supabase gets snake_case columns plus the
triage set `status`, `assigned_to`, `times_asked`, `last_asked`, `question_lower`, which Firestore
has no equivalent for - so the admin triage console
(`lib/ai/ai-settings/admin-repository.ts:272-337`) can only see questions that came in through the
Supabase path. The `aiBehavior`, `aiResponses`, `intents`, `prompt`, `templeInformation`,
`templePolicies`, `visitorInformation`, `updatedBy` rows are `ai_settings` blocks that the harvester
attributed here because `lib/ai/ai-settings/repository.ts` touches both stores - see UNCLEAR.

### fs `users`

**Declared type:** `types/user.ts#UserProfile` (`types/user.ts:46`); `types/user.ts:74` declares a second, narrower `TempleUser`.  
**Rule:** `firestore.rules:34`  
**Index:** entry 0 `role` + `createdAt`; entry 1 `templeId` + `createdAt`. Neither is used by any query.  
**Migration:** Firestore only; the Supabase `users` table exists with no app code and uses
`display_name`/`phone_number`/`photo_url` where Firestore has `name`/`phone`/`profileImage`.

<!--FIELDS users | types/user.ts#UserProfile-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `?` inferred | - | - | `services/user.service.ts:25`<br>`services/user.service.ts:48` | not in the type |
| `createdAt` | `Timestamp` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/user.service.ts:64`<br>+2 more | `services/user.service.ts:34`<br>`services/user.service.ts:57` | declared |
| `email` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `app/api/admin/users/set-role/route.ts:64`<br>`services/user.service.ts:29`<br>`services/user.service.ts:52`<br>+1 more | declared |
| `emailVerified` | `boolean` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | - | declared |
| `isActive` | `boolean` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `lib/auth/admin-auth.ts:55`<br>`lib/auth/admin.ts:75` | declared |
| `isApproved` | `boolean` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/auth.service.ts:108`<br>`lib/auth.ts:106` | declared; read only to echo itself forward on re-login, never checked as a gate |
| `lastLogin` | `Timestamp \| null` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | - | declared |
| `name` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/user.service.ts:28`<br>`services/user.service.ts:51` | declared |
| `phone` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/user.service.ts:30`<br>`services/user.service.ts:53` | declared |
| `profileImage` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/auth.service.ts:107`<br>`lib/auth.ts:105` | declared; carried forward on re-login only |
| `role` | `UserRole` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`app/api/admin/users/set-role/route.ts:79`<br>`services/auth.service.ts:57`<br>+4 more | `services/user.service.ts:31`<br>`services/user.service.ts:54`<br>`lib/auth/admin-auth.ts:60`<br>+1 more | declared |
| `templeId` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | `services/auth.service.ts:106`<br>`lib/auth.ts:104` | declared; carried forward on re-login only |
| `uid` | `string` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more | - | declared |
| `updatedAt` | `Timestamp` | yes | `app/api/admin/users/create-admin/route.ts:65`<br>`app/api/admin/users/set-role/route.ts:79`<br>`services/auth.service.ts:57`<br>+6 more | `services/user.service.ts:35`<br>`services/user.service.ts:58` | declared |
<!--END-->

Five separate writers write the same full profile - `app/api/admin/users/create-admin/route.ts:65`,
`services/auth.service.ts:57` and `:96`, `lib/auth.ts:44` and `:94`, `scripts/setup-admin.ts:54` -
so a field added to one of them and not the others produces documents with different shapes.
`uid` is stored inside the document *and* used as the document id. `docs/DATA-MODEL.md:64-67` claims
indexes on `email` (unique), `templeId, role` and `isActive, role`; none of those three exist, and
the two that do exist are unused. The guard at `lib/auth/admin-auth.ts:55` and `lib/auth/admin.ts:75`
reads `isActive`, while `services/user.service.ts:25,48` reads `active` - two names for one flag,
and only `isActive` is ever written. Because both of those read sites default to `true`
(`data.active ?? true`), the admin user list shows every account as active regardless of the stored
value. The login path at `services/auth.service.ts:104-111` (and `lib/auth.ts:102-109`) re-reads the
existing document and echoes `name`, `email`, `phone`, `role`, `templeId`, `profileImage`,
`isApproved` and `isActive` straight back with `{ merge: true }`; that is the only reader those last
three fields have, and nothing anywhere branches on `isApproved`.

### fs `volunteer_requests`

**Declared type:** `types/ai.ts#VolunteerRequest` (`types/ai.ts:71`) - the shape actually written;  
`types/volunteer.ts#VolunteerRequest` (`types/volunteer.ts:34`) is a different, unrelated interface with the same name.
**Rule:** **none**  
**Index:** none  
**Migration:** Firestore only; the Supabase `volunteer_requests` table mirrors the *other* shape
(`volunteer_id`, `sex`, `address`), which nothing writes.

<!--FIELDS volunteer_requests | types/ai.ts#VolunteerRequest-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| ~~`approved`~~ | - | - | - | - | **refuted 2026-09-19**: `app/admin/content/page.tsx:98` is a `testimonials` count (`where("approved","==",false)`); `volunteer_requests` is counted unfiltered at `:99`. No such field. |
| `createdAt` | `number` | yes | - | `services/chat.service.ts:226`<br>`services/chat.service.ts:233` | declared |
| `email` | `string` | yes | - | - | declared, **no call site** |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `phone` | `string` | yes | - | - | declared, **no call site** |
| `preferredDate` | `string` | no | - | - | declared, **no call site** |
| `service` | `string` | yes | - | - | declared, **no call site** |
| `sessionId` | `string` | yes | - | - | declared, **no call site** |
| `status` | `"pending" \| "contacted" \| "completed"` | yes | `services/chat.service.ts:243` | - | declared |
<!--END-->

`services/chat.service.ts:217` creates the chat-driven request (`sessionId`, `name`, `phone`,
`email`, `service`, `preferredDate`, `status`, `createdAt`) and `:243` updates `status`.
`app/admin/content/page.tsx:99` counts the collection **unfiltered** - the `where("approved", "==", false)`
one line above at `:98` belongs to `testimonials`, not here, so the pending-volunteer figure is simply
hard-coded `0` at `:114` rather than wrong. With no rule, the client write at `:217` is denied in
production.

### fs `volunteers`

**Declared type:** `types/volunteer.ts#Volunteer` (`types/volunteer.ts:22`)  
**Rule:** `firestore.rules:180`  
**Index:** none  
**Migration:** Firestore only.

<!--FIELDS volunteers | types/volunteer.ts#Volunteer-->
| field | type | required? | written by | read by | notes |
|---|---|---|---|---|---|
| `active` | `boolean` | yes | - | - | declared, **no call site** |
| `address` | `string` | yes | - | - | declared, **no call site** |
| `createdAt` | `string` | yes | `services/volunteer.service.ts:111` | `services/volunteer.service.ts:87` | declared |
| `id` | `string` | yes | - | - | declared, **no call site**; doc id, not a stored field |
| `name` | `string` | yes | - | - | declared, **no call site** |
| `phone` | `string` | yes | - | - | declared, **no call site** |
| `sex` | `"Male" \| "Female" \| "Other"` | yes | - | - | declared, **no call site** |
| `updatedAt` | `string` | yes | `services/volunteer.service.ts:111`<br>`services/volunteer.service.ts:118` | - | declared |
| `volunteerId` | `string` | yes | - | - | declared, **no call site** |
<!--END-->

Create and update are spreads (`services/volunteer.service.ts:111,118`); the written shape is
`VolunteerRequest` from `types/volunteer.ts:34` plus timestamps. Distinct from `volunteer_requests`,
which the chat writes: `volunteers` is the roster, `volunteer_requests` is the inbox, and no code
promotes one to the other.

## Supabase tables

Columns come from `supabase/migrations/*.sql`. There are **no generated Supabase types** - `supabase
gen types` is not wired up - so every `.from(...)` call returns `any` and the mapping to camelCase is
hand-written in each service. Twelve of the twenty-one tables have a schema and no app code at all.

Four migration files are dated after today (2026-09-19): `supabase/migrations/20260920000000_create_seva_bookings.sql`,
`supabase/migrations/20260930000000_create_ai_tables.sql`, `supabase/migrations/20261001000000_create_content_tables.sql`,
`supabase/migrations/20261010000000_create_settings.sql`. Any migration added today with a real date sorts *before* them.

### sb `aaradhanes`

Mirrors Firestore `aaradhane` (and its duplicate `aaradhanes`).

<!--COLUMNS aaradhanes-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `title` | `text` | NOT NULL | - | - |
| `guru_name` | `text` | NOT NULL | - | - |
| `dates` | `text[]` | NOT NULL | `'{}'` | - |
| `description` | `text` | NOT NULL | - | - |
| `significance` | `text` | NOT NULL | - | - |
| `rituals` | `text[]` | NOT NULL | `'{}'` | - |
| `offerings` | `text[]` | NOT NULL | `'{}'` | - |
| `image_url` | `text` | NOT NULL | - | - |
| `seva_details` | `jsonb` | NOT NULL | `'[]'` | - |
| `is_upcoming` | `boolean` | NOT NULL | `false` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_by` | `text` | NOT NULL | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to aaradhanes` (`supabase/migrations/20261001000000_create_content_tables.sql:196`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:176`
<!--END-->

**No app code.** `seva_details` is a `jsonb` array where Firestore stores `AaradhaneSeva[]`; there is
no `updated_at` column, matching the Firestore side missing `updatedAt`.

### sb `ai_intent_distribution`

Mirrors Firestore `ai_intent_distribution`.

<!--COLUMNS ai_intent_distribution-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `intent` | `text` | NOT NULL | - | W `services/ai-analytics.service.ts:171`<br>R `services/ai-analytics.service.ts:172` |
| `category` | `text` | yes | - | W `services/ai-analytics.service.ts:171`<br>R `services/ai-analytics.service.ts:173` |
| `language` | `text` | yes | - | W `services/ai-analytics.service.ts:171`<br>R `services/ai-analytics.service.ts:174`<br>`services/ai-analytics.service.ts:370` |
| `confidence` | `numeric(5,2)` | yes | - | W `services/ai-analytics.service.ts:171`<br>R `services/ai-analytics.service.ts:175` |
| `timestamp` | `timestamptz` | yes | `now()` | W `services/ai-analytics.service.ts:171`<br>`services/ai-analytics.service.ts:204`<br>R `app/admin/ai/analytics/page.tsx:245`<br>`services/ai-analytics.service.ts:361`<br>`services/ai-analytics.service.ts:364`<br>+2 more |
| `session_id` | `text` | yes | - | W `services/ai-analytics.service.ts:171` |
| `message_id` | `text` | yes | - | W `services/ai-analytics.service.ts:171` |

**RLS:** ALL `Deny all public access to ai_intent_distribution` (`supabase/migrations/20260930000000_create_ai_tables.sql:95`)  
**Indexes:** `idx_ai_intent_dist_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:57`
<!--END-->

Read by `services/ai-analytics.service.ts:170` through the **anon** client, against a deny-all RLS
policy - so this read returns zero rows in a correctly configured project. Written by nobody; the
Firestore copy is what `app/admin/ai/analytics/page.tsx:245` fills.

### sb `ai_latency_records`

Mirrors Firestore `ai_latency_records`.

<!--COLUMNS ai_latency_records-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `total_latency` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:135` |
| `intent_detection_time` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:135` |
| `retrieval_time` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:135` |
| `generation_time` | `numeric(10,2)` | NOT NULL | - | W `services/ai-analytics.service.ts:135` |
| `timestamp` | `timestamptz` | yes | `now()` | W `services/ai-analytics.service.ts:135`<br>R `app/admin/ai/analytics/page.tsx:245`<br>`app/admin/ai/analytics/page.tsx:247`<br>`services/ai-analytics.service.ts:313`<br>+3 more |
| `success` | `boolean` | NOT NULL | `true` | W `services/ai-analytics.service.ts:135`<br>R `services/ai-analytics.service.ts:140` |
| `error_type` | `text` | yes | - | W `services/ai-analytics.service.ts:135` |
| `model` | `text` | yes | - | W `services/ai-analytics.service.ts:135` |
| `session_id` | `text` | yes | - | W `services/ai-analytics.service.ts:135` |

**RLS:** ALL `Deny all public access to ai_latency_records` (`supabase/migrations/20260930000000_create_ai_tables.sql:96`)  
**Indexes:** `idx_ai_latency_records_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:70`
<!--END-->

Same pattern as above: anon read at `services/ai-analytics.service.ts:134` against deny-all RLS, no
writer. `message_id` and `intent`, which the Firestore record and `LatencyRecord` both carry, have
no column here.

### sb `chat_messages`

Mirrors Firestore `messages` (not the empty Firestore `chat_messages`).

<!--COLUMNS chat_messages-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `session_id` | `text` | NOT NULL | - | - |
| `role` | `text` | NOT NULL | - | - |
| `content` | `text` | NOT NULL | - | - |
| `timestamp` | `timestamptz` | NOT NULL | - | R `services/ai-analytics.service.ts:611`<br>`services/ai-analytics.service.ts:612` |
| `model` | `text` | yes | - | - |
| `latency` | `numeric(10,2)` | yes | - | - |
| `detected_language` | `text` | yes | - | - |

**RLS:** ALL `Deny all public access to chat_messages` (`supabase/migrations/20260930000000_create_ai_tables.sql:93`)  
**Indexes:** `idx_chat_messages_session_id(session_id)`, `idx_chat_messages_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:22`
<!--END-->

**No app code.** Note `session_id` is `text`, not a foreign key to `chat_sessions.id uuid`, so the
relationship is unenforced.

### sb `chat_sessions`

Mirrors Firestore `chat_sessions`.

<!--COLUMNS chat_sessions-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `user_id` | `text` | yes | - | - |
| `message_count` | `integer` | NOT NULL | `0` | - |
| `last_message` | `text` | yes | - | - |
| `detected_language` | `text` | yes | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to chat_sessions` (`supabase/migrations/20260930000000_create_ai_tables.sql:92`)  
**Indexes:** `idx_chat_sessions_user_id(user_id)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:4`
<!--END-->

**No app code.** `message_count` is absent from the CREATE TABLE although the Firestore document and
`types/ai.ts#ChatSession:20` both carry it, and the embedded `messages` array written by
`services/conversation.service.ts:161` has no home here at all.

### sb `daily_poojas`

Mirrors Firestore `dailyPoojas`.

<!--COLUMNS daily_poojas-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | R `scripts/migrate-daily-poojas.ts:140` |
| `title` | `text` | NOT NULL | - | - |
| `description` | `text` | NOT NULL | - | - |
| `start_time` | `text` | NOT NULL | - | - |
| `duration` | `text` | NOT NULL | - | - |
| `category` | `text` | NOT NULL | - | - |
| `seva_amount` | `numeric(10,2)` | NOT NULL | `0` | - |
| `is_active` | `boolean` | NOT NULL | `true` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `days` | `text[]` | NOT NULL | - | - |
| `notes` | `text` | yes | - | - |
| `created_by` | `text` | yes | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to daily_poojas` (`supabase/migrations/20260907112632_create_core_tables.sql:92`)  
**Indexes:** `idx_daily_poojas_display_order_is_active(display_order, is_active)`  
**Declared in:** `supabase/migrations/20260907112632_create_core_tables.sql:35`
<!--END-->

Populated by `scripts/migrate-daily-poojas.ts:111-140` and read by nothing - a grep for
`from("daily_poojas")` over `app/ services/ lib/` returns nothing. No `updated_at` column.

### sb `donation_campaigns`

Mirrors Firestore `donation_campaigns`.

<!--COLUMNS donation_campaigns-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `title` | `text` | NOT NULL | - | R `services/donationCampaign.service.ts:39` |
| `description` | `text` | NOT NULL | - | R `services/donationCampaign.service.ts:41` |
| `image_url` | `text` | NOT NULL | - | - |
| `suggested_amount` | `numeric(10,2)` | NOT NULL | - | - |
| `active` | `boolean` | NOT NULL | `true` | R `services/donationCampaign.service.ts:49` |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to donation_campaigns` (`supabase/migrations/20261001000000_create_content_tables.sql:78`)  
**Indexes:** `idx_donation_campaigns_display_order(display_order)`  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:61`
<!--END-->

**No app code.**

### sb `donations`

Mirrors Firestore `donations`.

<!--COLUMNS donations-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `donor_name` | `text` | NOT NULL | - | - |
| `email` | `text` | NOT NULL | - | R `app/admin/page.tsx:177`<br>`app/api/public/stats/route.ts:58`<br>`services/donation.service.ts:18` |
| `phone` | `text` | NOT NULL | - | R `app/admin/page.tsx:178`<br>`app/api/public/stats/route.ts:59`<br>`services/donation.service.ts:19` |
| `address` | `text` | NOT NULL | - | R `services/donation.service.ts:20` |
| `amount` | `numeric(10,2)` | NOT NULL | - | R `app/admin/page.tsx:179`<br>`services/donation.service.ts:21`<br>`hooks/useDonationNotifications.ts:52` |
| `purpose` | `text` | NOT NULL | - | R `services/donation.service.ts:22`<br>`hooks/useDonationNotifications.ts:53` |
| `campaign_id` | `uuid` | yes | - | - |
| `message` | `text` | NOT NULL | - | R `services/donation.service.ts:24` |
| `payment_mode` | `text` | NOT NULL | - | - |
| `status` | `text` | NOT NULL | - | W `services/donation.service.ts:39`<br>`services/donation.service.ts:68`<br>R `app/admin/page.tsx:172`<br>`app/api/public/stats/route.ts:52`<br>`services/donation.service.ts:26` |
| `receipt_number` | `text` | NOT NULL | - | - |
| `admin_remarks` | `text` | NOT NULL | - | - |
| `collected_by` | `text` | NOT NULL | - | - |
| `collected_at` | `timestamptz` | yes | - | - |

**RLS:** ALL `Deny all public access to donations` (`supabase/migrations/20261001000000_create_content_tables.sql:104`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:83`
<!--END-->

**No app code.** `campaign_id` is a real `uuid` here while Firestore stores a loose string
`campaignId` (`types/donation.ts:24`), so a migration has to resolve campaign ids first. There is no
`created_at`/`updated_at` pair, although `DonationRecord` declares both.

### sb `events`

Mirrors Firestore `events`. **The one content table the app genuinely uses.**

<!--COLUMNS events-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | R `services/event.service.ts:58`<br>`services/event.service.ts:114`<br>`services/event.service.ts:123` |
| `title` | `text` | NOT NULL | - | R `services/daily-spiritual.service.ts:314`<br>`services/daily-spiritual.service.ts:356`<br>`lib/aaradhane/firestore-admin.ts:55`<br>+9 more |
| `description` | `text` | NOT NULL | - | R `services/daily-spiritual.service.ts:315`<br>`services/daily-spiritual.service.ts:357`<br>`lib/ai/firebaseChat.ts:95`<br>+1 more |
| `location` | `text` | NOT NULL | - | R `lib/ai/retrieval/events.ts:47` |
| `start_date` | `timestamptz` | NOT NULL | - | - |
| `end_date` | `timestamptz` | NOT NULL | - | - |
| `start_time` | `text` | yes | - | - |
| `end_time` | `text` | yes | - | - |
| `featured` | `boolean` | NOT NULL | `false` | R `services/daily-spiritual.service.ts:294`<br>`lib/ai/retrieval/events.ts:48` |
| `published` | `boolean` | NOT NULL | `false` | R `services/daily-spiritual.service.ts:295`<br>`services/daily-spiritual.service.ts:332`<br>`lib/ai/firebaseChat.ts:77`<br>+2 more |
| `category` | `text` | yes | - | R `services/daily-spiritual.service.ts:320`<br>`services/daily-spiritual.service.ts:362`<br>`lib/aaradhane/firestore-admin.ts:36`<br>+4 more |
| `image_url` | `text` | yes | - | - |
| `status` | `text` | NOT NULL | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to events` (`supabase/migrations/20260907112632_create_core_tables.sql:98`)  
**Indexes:** `idx_events_start_date(start_date)`, `idx_events_featured_published(featured, published)`  
**Declared in:** `supabase/migrations/20260907112632_create_core_tables.sql:53`
<!--END-->

`services/event.service.ts:46,58,90,114,123` reads *and* writes this table through the **anon**
client while RLS is deny-all (`supabase/migrations/20260907112632_create_core_tables.sql:98`), so
every call fails unless RLS was disabled by hand in the live project. The mapper is
`mapSupabaseEventToTempleEvent` (`services/event.service.ts:21`). The four generator fields
(`autoGenerated`, `guru`, `year`, `raghavendraPhase`) have no column.

### sb `gallery_albums`

Mirrors Firestore `galleryAlbums`.

<!--COLUMNS gallery_albums-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `title` | `text` | NOT NULL | - | - |
| `slug` | `text` | NOT NULL | - | - |
| `description` | `text` | NOT NULL | - | - |
| `cover_image` | `text` | NOT NULL | - | - |
| `active` | `boolean` | NOT NULL | `true` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to gallery_albums` (`supabase/migrations/20261001000000_create_content_tables.sql:125`)  
**Indexes:** `idx_gallery_albums_display_order(display_order)`  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:108`
<!--END-->

**No app code.**

### sb `gallery_media`

Mirrors Firestore `galleryMedia`.

<!--COLUMNS gallery_media-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `album_id` | `uuid` | yes | - | - |
| `title` | `text` | NOT NULL | - | - |
| `description` | `text` | NOT NULL | - | - |
| `category` | `text` | NOT NULL | - | - |
| `type` | `text` | NOT NULL | - | - |
| `image_path` | `text` | NOT NULL | - | - |
| `video_url` | `text` | yes | - | - |
| `alt_text` | `text` | NOT NULL | - | - |
| `is_featured` | `boolean` | NOT NULL | `false` | - |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `tags` | `text[]` | NOT NULL | `'{}'` | - |
| `uploaded_by` | `text` | NOT NULL | - | - |
| `uploaded_at` | `timestamptz` | yes | - | - |

**RLS:** ALL `Deny all public access to gallery_media` (`supabase/migrations/20261001000000_create_content_tables.sql:150`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:130`
<!--END-->

**No app code.** `album_id` is a `uuid` FK while Firestore stores a document-id string, so the
migration must map ids first. `image_path` and `alt_text` match the *type*, not what the admin UI
reads (`url`, `caption`) - see the `galleryMedia` note above.

### sb `profiles`

Mirrors Firestore `profiles` plus the whole `bookmarks` collection.

<!--COLUMNS profiles-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `uid` | `text` | NOT NULL | - | - |
| `name` | `text` | NOT NULL | - | - |
| `email` | `text` | NOT NULL | - | R `services/profile.service.ts:111` |
| `phone` | `text` | yes | - | - |
| `profile_image` | `text` | yes | - | - |
| `bio` | `text` | yes | - | - |
| `gotra` | `text` | yes | - | - |
| `nakshatra` | `text` | yes | - | - |
| `preferences` | `jsonb` | NOT NULL | `'{}'` | R `services/profile.service.ts:114`<br>`services/profile.service.ts:115` |
| `favorites` | `text[]` | NOT NULL | `'{}'` | W `services/profile.service.ts:269`<br>`services/profile.service.ts:290` |
| `recently_viewed` | `text[]` | NOT NULL | `'{}'` | - |
| `bookmarks` | `jsonb` | NOT NULL | `'[]'` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to profiles` (`supabase/migrations/20261001000000_create_content_tables.sql:57`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:34`
<!--END-->

**No app code.** This is the only table that folds an entire Firestore collection (`bookmarks`) into
a `jsonb` column.

### sb `seva_bookings`

Mirrors Firestore `sevaBookings`.

<!--COLUMNS seva_bookings-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `seva_id` | `uuid` | NOT NULL | - | - |
| `seva_title` | `text` | NOT NULL | - | - |
| `seva_amount` | `numeric(10,2)` | NOT NULL | - | - |
| `user_id` | `text` | NOT NULL | - | - |
| `user_name` | `text` | NOT NULL | - | - |
| `user_email` | `text` | NOT NULL | - | - |
| `user_phone` | `text` | NOT NULL | - | - |
| `gotra` | `text` | yes | - | - |
| `nakshatra` | `text` | yes | - | - |
| `raashi` | `text` | yes | - | - |
| `preferred_date` | `text` | NOT NULL | - | - |
| `notes` | `text` | NOT NULL | - | - |
| `status` | `text` | NOT NULL | - | - |
| `payment_reference` | `text` | NOT NULL | - | - |
| `payment_status` | `text` | NOT NULL | - | - |
| `payment_date` | `text` | NOT NULL | - | - |
| `payment_method` | `text` | NOT NULL | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to seva_bookings` (`supabase/migrations/20260920000000_create_seva_bookings.sql:40`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20260920000000_create_seva_bookings.sql:6`
<!--END-->

**No app code.** `seva_id` is `uuid NOT NULL` while Firestore stores a document-id string, so every
row needs a resolved seva before it can be inserted - the hardest of the pending migrations. No
index at all, not even on `user_id`, although the Firestore query pattern is "bookings by user".

### sb `sevas`

Mirrors Firestore `sevas`. **The read side of the seva split brain.**

<!--COLUMNS sevas-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | R `app/actions/sevas.ts:13`<br>`scripts/migrate-sevas.ts:143` |
| `name` | `text` | NOT NULL | - | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/api/admin/receipt-sevas/route.ts:35`<br>`lib/ai/firebaseChat.ts:109`<br>`lib/ai/retrieval/sevas.ts:102`<br>+5 more |
| `description` | `text` | NOT NULL | - | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/api/admin/receipt-sevas/route.ts:36`<br>`lib/ai/firebaseChat.ts:110`<br>`lib/ai/retrieval/sevas.ts:103`<br>+2 more |
| `category` | `text` | NOT NULL | - | W `app/api/admin/receipt-sevas/route.ts:75`<br>R `lib/ai/retrieval/sevas.ts:104`<br>`scripts/migrate-sevas.ts:68`<br>`scripts/migrate-sevas.ts:80` |
| `amount` | `numeric(10,2)` | NOT NULL | - | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/api/admin/receipt-sevas/route.ts:37`<br>`lib/ai/firebaseChat.ts:111`<br>`lib/ai/retrieval/sevas.ts:105`<br>+3 more |
| `duration` | `integer` | NOT NULL | - | W `app/api/admin/receipt-sevas/route.ts:75`<br>R `lib/ai/retrieval/sevas.ts:106`<br>`scripts/migrate-sevas.ts:70`<br>`scripts/migrate-sevas.ts:82` |
| `image_url` | `text` | yes | - | - |
| `active` | `boolean` | NOT NULL | `true` | W `app/api/admin/receipt-sevas/[id]/route.ts:55`<br>R `app/admin/content/page.tsx:92`<br>`app/api/admin/receipt-sevas/route.ts:38`<br>`lib/ai/retrieval/sevas.ts:126`<br>+3 more |
| `display_order` | `integer` | NOT NULL | `0` | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to sevas` (`supabase/migrations/20260907112632_create_core_tables.sql:86`); ALL `Deny all public access to sevas` (`supabase/migrations/20260908120000_create_sevas_table.sql:43`)  
**Indexes:** `idx_sevas_display_order_active(display_order, active)`, `idx_sevas_display_order_active(display_order, active)`  
**Declared in:** `supabase/migrations/20260907112632_create_core_tables.sql:13`, `supabase/migrations/20260908120000_create_sevas_table.sql:18`
<!--END-->

Read by `app/actions/sevas.ts:6,13` through the **service-role** client, which bypasses the deny-all
RLS policy - that is why this one path works. Written only by `scripts/migrate-sevas.ts:115-120` and
`scripts/seed-supabase-sevas.ts:150`. Declared twice, at
`supabase/migrations/20260907112632_create_core_tables.sql:13` and
`supabase/migrations/20260908120000_create_sevas_table.sql:18`, both with `IF NOT EXISTS`, so the
second is a no-op.

### sb `site_settings`

Replaces part of the Firestore `settings/*` family.

<!--COLUMNS site_settings-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `temple_name` | `text` | NOT NULL | `'Sri Raghavendra Swamy Temple'` | W `services/settings.service.ts:76`<br>R `services/settings.service.ts:59` |
| `contact_email` | `text` | NOT NULL | `'info@example.com'` | W `services/settings.service.ts:76`<br>R `services/settings.service.ts:60` |
| `contact_phone` | `text` | NOT NULL | `''` | W `services/settings.service.ts:76`<br>R `services/settings.service.ts:61` |
| `address` | `text` | NOT NULL | `''` | W `services/settings.service.ts:76`<br>R `services/settings.service.ts:62` |
| `footer_text` | `text` | yes | - | W `services/settings.service.ts:76`<br>R `services/settings.service.ts:63` |
| `welcome_message` | `text` | yes | - | W `services/settings.service.ts:76`<br>R `services/settings.service.ts:64` |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | R `services/settings.service.ts:45`<br>`services/settings.service.ts:65` |

**RLS:** SELECT `Allow public read access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:57`); INSERT `Deny all public write access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:70`); UPDATE `Deny all public update access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:76`); DELETE `Deny all public delete access to site_settings` (`supabase/migrations/20261010000000_create_settings.sql:82`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261010000000_create_settings.sql:4`
<!--END-->

One of only three tables with a **public SELECT** policy. Read with the anon client at
`services/settings.service.ts:43`, written with the service-role client at `:75` and `:107`. It
covers six fields; the Firestore `settings` collection carries around ninety, so this table replaces
roughly a tenth of what it is meant to replace.

### sb `social_links`

Replaces the Firestore document `settings/socialLinks`.

<!--COLUMNS social_links-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `facebook` | `text` | yes | - | R `services/settings.service.ts:137` |
| `instagram` | `text` | yes | - | R `services/settings.service.ts:138` |
| `youtube` | `text` | yes | - | R `services/settings.service.ts:139` |
| `whatsapp` | `text` | yes | - | R `services/settings.service.ts:140` |
| `twitter` | `text` | yes | - | R `services/settings.service.ts:141` |
| `linkedin` | `text` | yes | - | R `services/settings.service.ts:142` |
| `map_url` | `text` | yes | - | R `services/settings.service.ts:143` |
| `show_facebook` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:144` |
| `show_instagram` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:145` |
| `show_youtube` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:146` |
| `show_whatsapp` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:147` |
| `show_twitter` | `boolean` | NOT NULL | `false` | R `services/settings.service.ts:148` |
| `show_linkedin` | `boolean` | NOT NULL | `false` | R `services/settings.service.ts:149` |
| `show_map` | `boolean` | NOT NULL | `true` | R `services/settings.service.ts:150` |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | R `services/settings.service.ts:123` |

**RLS:** SELECT `Allow public read access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:63`); INSERT `Deny all public write access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:88`); UPDATE `Deny all public update access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:94`); DELETE `Deny all public delete access to social_links` (`supabase/migrations/20261010000000_create_settings.sql:100`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261010000000_create_settings.sql:24`
<!--END-->

**The second split brain.** Public SELECT is allowed; INSERT, UPDATE and DELETE are denied. The site
reads this table (`services/settings.service.ts:121-150`), the admin editor writes Firestore
`settings/socialLinks` (`app/admin/settings/social-links/page.tsx:88`), and the only writer of the
table anywhere in the repo is `scripts/migrate-settings.ts:102-103`. Editing social links in the
admin therefore has no visible effect, and `services/settings.service.ts:131,134` returns
`defaultSocialLinks` on both error and empty, which hides the failure.

### sb `temple_areas`

The only domain that is Supabase-only and actually working.

<!--COLUMNS temple_areas-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `UUID` | yes | `gen_random_uuid()` | W `services/temple-areas.supabase.service.ts:103` (a slug, not a uuid) |
| `firestore_id` | `TEXT` | yes | - | W `scripts/seed-temple-areas.ts:37` |
| `name` | `TEXT` | NOT NULL | - | W `services/temple-areas.supabase.service.ts:104`<br>`services/temple-areas.supabase.service.ts:131`<br>R `services/temple-areas.supabase.service.ts:172` |
| `name_kannada` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:105`<br>`services/temple-areas.supabase.service.ts:132`<br>R `services/temple-areas.supabase.service.ts:173` |
| `description` | `TEXT` | NOT NULL | - | W `services/temple-areas.supabase.service.ts:106`<br>`services/temple-areas.supabase.service.ts:133`<br>R `services/temple-areas.supabase.service.ts:174` |
| `significance` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:107`<br>`services/temple-areas.supabase.service.ts:134`<br>R `services/temple-areas.supabase.service.ts:175` |
| `icon` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:108`<br>`services/temple-areas.supabase.service.ts:135`<br>R `services/temple-areas.supabase.service.ts:176` |
| `category` | `TEXT` | NOT NULL | - | W `services/temple-areas.supabase.service.ts:110`<br>`services/temple-areas.supabase.service.ts:137`<br>R `services/temple-areas.supabase.service.ts:178` |
| `features` | `JSONB` | yes | `'[]'::jsonb` | W `services/temple-areas.supabase.service.ts:111`<br>`services/temple-areas.supabase.service.ts:138`<br>R `services/temple-areas.supabase.service.ts:179` |
| `best_time_to_visit` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:112`<br>`services/temple-areas.supabase.service.ts:139`<br>R `services/temple-areas.supabase.service.ts:180` |
| `tips` | `JSONB` | yes | `'[]'::jsonb` | W `services/temple-areas.supabase.service.ts:113`<br>`services/temple-areas.supabase.service.ts:140`<br>R `services/temple-areas.supabase.service.ts:181` |
| `order` | `INTEGER` | yes | `0` | W `services/temple-areas.supabase.service.ts:115`<br>`services/temple-areas.supabase.service.ts:142`<br>R `services/temple-areas.supabase.service.ts:18`<br>`services/temple-areas.supabase.service.ts:41`<br>`services/temple-areas.supabase.service.ts:183` |
| `created_at` | `TIMESTAMPTZ` | yes | `NOW()` | - |
| `updated_at` | `TIMESTAMPTZ` | yes | `NOW()` | W `services/temple-areas.supabase.service.ts:145` |
| `image_url` | `TEXT` | yes | - | W `services/temple-areas.supabase.service.ts:109`<br>`services/temple-areas.supabase.service.ts:136`<br>R `services/temple-areas.supabase.service.ts:177` |
| `has360_view` | `BOOLEAN` | yes | - | W `services/temple-areas.supabase.service.ts:114`<br>`services/temple-areas.supabase.service.ts:141`<br>R `services/temple-areas.supabase.service.ts:182` |

**RLS:** SELECT `Allow public read access to temple_areas` (`supabase/migrations/20240523000000_create_temple_areas.sql:32`); SELECT `Allow public read access to temple_areas` (`supabase/migrations/20240915_create_temple_areas.sql:30`)  
**Indexes:** `temple_areas_order_idx("order")`, `temple_areas_category_idx(category)`  
**Declared in:** `supabase/migrations/20240523000000_create_temple_areas.sql:1`, `supabase/migrations/20240915_create_temple_areas.sql:1`
<!--END-->

Public SELECT. Read by `services/temple-areas.supabase.service.ts:16,39,63,81` and mapped to
`types/temple-explorer.ts#TempleArea` at `:172-183`. **The same service also writes it** - the
harvester missed every write because `addArea` hands `.insert()` a variable
(`insertData`, built at `:102-116`, inserted at `:119-120`) and `updateArea` assigns keys one at a
time onto `updateData` (`:129-145`, applied at `:148-149`); `deleteArea` removes rows at `:161-162`.
All three take the **service-role** client (`createAdminClient()` at `:98,129,159`), so they bypass
the public-read-only RLS. That makes this the one domain with a complete Supabase CRUD, and it means
the Index `W` of 1 for this table is wrong - only the `firestore_id` seed write was harvested. Declared by **two conflicting migrations**,
`supabase/migrations/20240523000000_create_temple_areas.sql` and
`supabase/migrations/20240915_create_temple_areas.sql`, which disagree on the primary-key type
(`uuid` vs `text`) and on whether `image_url` and `has360_view` exist. Both use `IF NOT EXISTS`, so
whichever ran first won and the tree cannot tell you which. The column is `has360_view` while the
type property is `has360View`, and `"order"` is a reserved word that has to stay quoted.

### sb `testimonials`

Mirrors Firestore `testimonials`.

<!--COLUMNS testimonials-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `name` | `text` | NOT NULL | - | R `services/testimonial.service.ts:90`<br>`services/testimonial.service.ts:156`<br>`services/testimonial.service.ts:199`<br>+1 more |
| `location` | `text` | NOT NULL | - | R `services/testimonial.service.ts:91`<br>`services/testimonial.service.ts:157`<br>`services/testimonial.service.ts:200`<br>+1 more |
| `quote` | `text` | NOT NULL | - | R `services/testimonial.service.ts:92`<br>`services/testimonial.service.ts:158`<br>`services/testimonial.service.ts:201`<br>+1 more |
| `years` | `text` | NOT NULL | - | R `services/testimonial.service.ts:93`<br>`services/testimonial.service.ts:159`<br>`services/testimonial.service.ts:202`<br>+1 more |
| `image` | `text` | yes | - | R `services/testimonial.service.ts:94`<br>`services/testimonial.service.ts:160`<br>`services/testimonial.service.ts:203`<br>+2 more |
| `phone` | `text` | yes | - | R `services/testimonial.service.ts:95` |
| `approved` | `boolean` | yes | `false` | W `services/chat.service.ts:193`<br>`services/testimonial.service.ts:120`<br>R `app/admin/content/page.tsx:98`<br>`services/chat.service.ts:160`<br>`services/chat.service.ts:178`<br>+5 more |
| `rejected` | `boolean` | yes | `false` | W `services/testimonial.service.ts:120`<br>R `services/testimonial.service.ts:97` |
| `rejection_reason` | `text` | yes | - | - |
| `submitted_by` | `text` | yes | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to testimonials` (`supabase/migrations/20261001000000_create_content_tables.sql:172`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:154`
<!--END-->

**No app code.** There is no `reviewed_at` column although `services/testimonial.service.ts:120`
writes one.

### sb `unknown_questions`

Mirrors Firestore `unknown_questions`, and extends it.

<!--COLUMNS unknown_questions-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `question` | `text` | NOT NULL | - | W `lib/ai/ai-settings/repository.ts:392`<br>R `app/admin/ai/analytics/page.tsx:352`<br>`services/analytics.service.ts:36`<br>`lib/ai/unknown-logger.ts:158` |
| `question_lower` | `text` | yes | - | W `lib/ai/ai-settings/repository.ts:392`<br>R `lib/ai/ai-settings/repository.ts:418` |
| `detected_intent` | `text` | yes | - | W `lib/ai/ai-settings/repository.ts:392` |
| `confidence` | `numeric(5,2)` | yes | - | W `lib/ai/ai-settings/repository.ts:392`<br>R `app/admin/ai/analytics/page.tsx:353`<br>`lib/ai/unknown-logger.ts:161` |
| `language` | `text` | yes | - | W `lib/ai/ai-settings/repository.ts:392`<br>R `lib/ai/unknown-logger.ts:162`<br>`lib/ai/unknown-logger.ts:219` |
| `timestamp` | `timestamptz` | yes | `now()` | W `services/analytics.service.ts:31`<br>`lib/ai/ai-settings/repository.ts:392`<br>R `app/admin/ai/analytics/page.tsx:247`<br>`app/admin/ai/analytics/page.tsx:249`<br>`app/admin/ai/analytics/page.tsx:350`<br>+11 more |
| `session_id` | `text` | yes | - | W `lib/ai/ai-settings/repository.ts:392` |
| `times_asked` | `integer` | yes | `1` | W `lib/ai/ai-settings/repository.ts:392`<br>`lib/ai/ai-settings/repository.ts:428`<br>R `lib/ai/ai-settings/repository.ts:429`<br>`lib/ai/ai-settings/repository.ts:417` |
| `status` | `text` | NOT NULL | `'pending'` | W `lib/ai/ai-settings/repository.ts:392`<br>R `lib/ai/ai-settings/admin-repository.ts:274`<br>`lib/ai/ai-settings/repository.ts:455` |
| `assigned_to` | `text` | yes | `'unassigned'` | W `lib/ai/ai-settings/repository.ts:392`<br>R `lib/ai/ai-settings/repository.ts:456` |
| `last_asked` | `timestamptz` | yes | - | W `lib/ai/ai-settings/repository.ts:428` |
| `reviewed_by` | `text` | yes | - | - |
| `reviewed_at` | `timestamptz` | yes | - | - |
| `response` | `text` | yes | - | - |
| `added_to_knowledge_article_id` | `text` | yes | - | - |
| `notes` | `text` | yes | - | - |

**RLS:** ALL `Deny all public access to unknown_questions` (`supabase/migrations/20260930000000_create_ai_tables.sql:94`)  
**Indexes:** `idx_unknown_questions_timestamp(timestamp)`  
**Declared in:** `supabase/migrations/20260930000000_create_ai_tables.sql:35`
<!--END-->

The only AI table with both a reader and a writer in the app:
`lib/ai/ai-settings/repository.ts:391,416,427,453,513,523` (anon client) and
`lib/ai/ai-settings/admin-repository.ts:272,327,337` (service role). Indexed only on `timestamp`,
although `lib/ai/ai-settings/repository.ts:453-456` filters on `status` and `assigned_to`. The five
triage columns (`status`, `assigned_to`, `times_asked`, `last_asked`, `response`) have no Firestore
equivalent, so a question logged through the Firestore path never reaches the triage console.

### sb `users`

Mirrors Firestore `users`.

<!--COLUMNS users-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `email` | `text` | NOT NULL | - | W `app/api/admin/users/create-admin/route.ts:65`<br>`services/auth.service.ts:57`<br>`services/auth.service.ts:96`<br>+3 more<br>R `app/api/admin/users/set-role/route.ts:64`<br>`services/user.service.ts:29`<br>`services/user.service.ts:52`<br>+1 more |
| `display_name` | `text` | yes | - | - |
| `phone_number` | `text` | yes | - | - |
| `photo_url` | `text` | yes | - | - |
| `role` | `text` | NOT NULL | `'user'` | W `app/api/admin/users/create-admin/route.ts:65`<br>`app/api/admin/users/set-role/route.ts:79`<br>`services/auth.service.ts:57`<br>+4 more<br>R `services/user.service.ts:31`<br>`services/user.service.ts:54`<br>`lib/auth/admin-auth.ts:60`<br>+1 more |
| `active` | `boolean` | NOT NULL | `true` | R `services/user.service.ts:25`<br>`services/user.service.ts:48` |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to users` (`supabase/migrations/20261001000000_create_content_tables.sql:30`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:13`
<!--END-->

**No app code.** The column names diverge from Firestore: `display_name` vs `name`, `phone_number`
vs `phone`, `photo_url` vs `profileImage`, and there is no column for `templeId`, `isApproved`,
`emailVerified` or `lastLogin`. Auth migrates separately through Supabase Auth, so this table would
hold profile data only.

### sb `volunteer_requests`

Mirrors the Firestore collection of the same name - but the *other* `VolunteerRequest` type.

<!--COLUMNS volunteer_requests-->
| column | type | nullable | default | read/written by |
|---|---|---|---|---|
| `id` | `uuid` | yes | `gen_random_uuid()` | - |
| `firestore_id` | `text` | yes | - | - |
| `volunteer_id` | `text` | NOT NULL | - | - |
| `name` | `text` | NOT NULL | - | - |
| `phone` | `text` | NOT NULL | - | - |
| `sex` | `text` | NOT NULL | - | - |
| `active` | `boolean` | NOT NULL | `true` | - |
| `address` | `text` | NOT NULL | - | - |
| `created_at` | `timestamptz` | yes | `now()` | - |
| `updated_at` | `timestamptz` | yes | `now()` | - |

**RLS:** ALL `Deny all public access to volunteer_requests` (`supabase/migrations/20261001000000_create_content_tables.sql:217`)  
**Indexes:** none declared  
**Declared in:** `supabase/migrations/20261001000000_create_content_tables.sql:200`
<!--END-->

**No app code.** The columns follow `types/volunteer.ts#VolunteerRequest:34` (`volunteer_id`, `sex`,
`address`), while the code writes `types/ai.ts#VolunteerRequest:71` (`sessionId`, `email`, `service`,
`preferredDate`, `status`). The table cannot accept a single row the application currently produces.

## Orphans and mismatches

Counts are over the 607 field entries the harvester produced for the 62 stores that have at least
one call site (the per-document `settings/*` buckets are excluded to avoid double counting).
Reproduce them with `node .claude/state/inventory/fields.mjs` and a pass over `.claude/state/inventory/fields.json`.

| class | count |
|---|---|
| fields with both a write site and a read site | 167 |
| **written, never read** | **86** |
| **read, never written** | **354** |
| collections with no TypeScript type at all | 19 |

### Written but never read (86)

The ones worth deleting:

| field | written at | why it is dead |
|---|---|---|
| `chat_metrics.date`, `chat_metrics.timestamp` | `services/analytics.service.ts:54` | nothing reads the collection |
| `page_views.date` | `services/pageviews.service.ts:46` | never queried or aggregated - every read path filters on `timestamp` instead (`:112-116`). (`visitorId` was on this row and is **not** dead: `services/pageviews.service.ts:126-129` folds it into the unique-visitor set.) |
| `daily_page_stats.date`, `.pageViews`, `.lastUpdated` | `services/pageviews.service.ts:62` | the dashboard reads `page_views` directly instead |
| `articles.tags`, `.version`, `.createdBy`, `.createdAt`, `.updatedAt` | `scripts/seed-ai-knowledge.ts:145` | only the seed script knows this collection |
| `chatTraining.category`, `.keywords`, `.response` | `app/admin/ai/training/page.tsx:207` | consumed only through an untyped spread at `lib/ai/firebaseChat.ts:158` |
| `intent_feedback.adminId`, `.notes`, `.question`, `.sessionId` | `services/analytics.service.ts:204` | the reader at `:247-258` uses only `isCorrect` and the two intents |
| `ai_unknown_questions.reviewed`, `.reviewedBy`, `.addedToKnowledge`, `.knowledgeArticleId` | `services/ai-analytics.service.ts:204,232` | the collection has no creator |
| `users.uid`, `.lastLogin`, `.emailVerified` | five writers, e.g. `services/auth.service.ts:57` | no reader anywhere. (`templeId`, `profileImage` and `isApproved` were on this row and are **not** unread: `services/auth.service.ts:106-108` and `lib/auth.ts:104-106` re-read them on login - but only to echo them back, and nothing branches on `isApproved`.) |
| `test.message`, `test.createdAt` | `app/admin/test/page.tsx:15` | debug page that ships in the build |
| `notifications.title`, `.type`, `.message`, `.createdAt`, `.readAt` | `services/testimonial.service.ts:361,437` | there is no notifications UI |
| `volunteer_requests.status` | `services/chat.service.ts:243` | no admin screen filters on it; the one counter over this collection (`app/admin/content/page.tsx:99`) is unfiltered |
| `updatedAt` on `members`, `volunteers`, `galleryAlbums`, `guruParampara`, `homepage`, `profiles`, `receiptSevas` | various | written for hygiene, never displayed or sorted on |

Two rows in that 86 are harvester false positives: `system.year/.lastNumber/.prefix` are read back
inside the same transaction at `lib/receipt/admin.ts:51` through `counterSnap.data()`, and
`temple_areas.firestore_id` is a traceability column by design.

### Read but never written (354)

Most of this is the spread-write blind spot rather than a real orphan. Three classes:

1. **Harvester artefact - the write is a spread.** `bills` (22 fields), `quotes` (25),
   `donations` (19), `dailyPoojas` (12), `donation_campaigns` (8), `aaradhane` (8),
   `galleryAlbums`, `galleryMedia`, `knowledge_versions`, `knowledge_drafts`. The declared type is
   written whole; treat these as normal fields.
2. **Seed-only or manual-entry data - genuinely never written by the application.**
   - `timings.morningOpen/.morningClose/.eveningOpen/.eveningClose/.open/.close`
     (`lib/ai/retrieval/settings.ts:96-101`) - no writer exists anywhere in the repo.
   - `trust.name/.role/.position` (`lib/ai/firebaseChat.ts:124-125`) - no writer; the admin edits
     `settings/trustCommittee` instead, so the AI answers from a separately seeded collection.
   - `guruParampara.gurus` is written only by `scripts/seed-guru-parampara.ts:378` and
     `scripts/seed-guru-to-firestore.ts:327`, never by the running application.
   - `receiptSevas.name` is read by the seed guard at `scripts/seed-receipt-sevas.ts:100` before the
     admin API creates the document.
3. **Real bugs - a reader for a field nothing ever writes.**

| field read | read at | why it is a bug |
|---|---|---|
| `events.date` | `app/admin/content/page.tsx:90`, `app/admin/page.tsx:111`, `app/api/public/stats/route.ts:45` | events carry `startDate`/`endDate`; the upcoming-events counters are always 0 |
| `events.active` | `app/admin/content/page.tsx:168` (draft query), `:134` (recent-event status badge) | the flag is `published`; the "draft events" panel is always empty and every recent event shows as "Draft" |
| `announcements.active` | `app/admin/content/page.tsx:92,169`, `:146` (recent-item status badge) | the flag is `isActive` (`types/announcement.ts:6`); the active count is 0, the draft panel is empty, and every recent announcement shows as "Draft" |
| `sevas.price` | `lib/ai/firebaseChat.ts:111` | the field is `amount` - but the expression is `data.price \|\| data.amount \|\| ""`, so this one degrades cleanly. Harmless, not a bug. |
| `galleryMedia.url`, `.imageUrl` | `app/admin/media/page.tsx:87` | the type and the service write `imagePath`; `url \|\| imageUrl \|\| ""` has no third fallback, so every thumbnail in the admin media grid is blank. (`caption` at `:89` falls back to `title`, a real field, so the label is fine.) |
| `users.active` | `services/user.service.ts:25,48` | every writer writes `isActive` |
| `knowledge_workflow.lastReviewedBy`, `.lastReviewedAt` | declared `types/knowledge-workflow.ts:150-151` | the document stores `reviewedBy`/`reviewedAt`; the mapper at `services/knowledge-workflow.service.ts:797-798` renames them on read, so the declared names never exist on disk |
| `ai_latency_records.messageId` | declared `types/ai-analytics.ts:30` | neither store has it |

### Collections with no TypeScript type (19)

`articles`, `chat_messages`, `chatTraining`, `daily_page_stats`, `featuredContent`, `futurePlans`,
`gallery`, `intent_feedback`, `knowledge_articles`, `knowledge_categories`, `notifications`,
`page_views`, `panchanga`, `poojas`, `system`, `test`, `timings`, `trust`, `trustCommittee`.

M11 named nine typeless collections. Two of those nine do have a type after all: `chat_metrics` maps
to `types/analytics.ts#ConversationMetric:17` and `intent_metrics` to
`types/analytics.ts#IntentMetric:31` - although in the `intent_metrics` case the type and the stored
document share no field, so the type is effectively fiction. Twelve collections M11 did not name are
also typeless: `chat_messages`, `futurePlans`, `gallery`, `knowledge_articles`,
`knowledge_categories`, `notifications`, `page_views`, `panchanga`, `poojas`, `system`, `timings`,
`trustCommittee`. 9 - 2 + 12 = **19**, which is also the number of Firestore rows carrying
**none** in the Index. For all 19, the write site is the only definition of the shape.

### Fields declared in a type that no code writes

`Bookmark.title/.description/.thumbnail/.url` (`types/profile.ts:59-62`),
`ChatSession.detectedLanguage` (`types/ai.ts:22`),
`CommitteeApproval.deadline` (`types/knowledge-workflow.ts:99`),
`WorkflowAction.previousVersionId/.newVersionId` (`types/knowledge-workflow.ts:57-58`),
`AuditLogEntry.ipAddress/.userAgent` (`types/knowledge-workflow.ts:125-126`),
`KnowledgeArticle.kannadaTitle/.kannadaContent` (`lib/ai/knowledge/types.ts:59,64`),
`UnknownQuestionRecord.feedback/.userAgent` (`types/ai-analytics.ts:72-73`).
`Testimonial.phone` (`types/homepage.ts:140`) is written at
`services/testimonial.service.ts:95` and never displayed.

### Where `docs/DATA-MODEL.md` disagrees with the code (16)

| # | section | the document says | the code does |
|---|---|---|---|
| 1 | §1 `users` (`docs/DATA-MODEL.md:64-67`) | indexes `email` unique, `templeId, role`, `isActive, role` | `firestore.indexes.json` has `role+createdAt` and `templeId+createdAt`, both unused |
| 2 | §2 `sevas` (`docs/DATA-MODEL.md:80-85`) | `name` and `description` are `{en, kn}` objects | plain strings (`types/seva.ts:2-3`) |
| 3 | §2 `sevas` (`docs/DATA-MODEL.md:94-97`) | `maxPerDay`, `requiresAdvanceBooking`, `bookingWindowDays` | none of the three exist |
| 4 | §3 `sevaBookings` (`docs/DATA-MODEL.md:130-134`) | `devoteeName`, `devoteeEmail`, `devoteePhone` | `userName`, `userEmail`, `userPhone` (`types/seva-booking.ts:14-17`) |
| 5 | §3 `sevaBookings` (`docs/DATA-MODEL.md:141-158`) | `preferredTime`, `statusHistory`, `paymentId`, `paymentMode`, `bookedBy`, `confirmedBy`, `confirmedAt` | none exist |
| 6 | §4 `events` (`docs/DATA-MODEL.md:208-250`) | `{en,kn}` title and description, `allDay`, `type`, `videoUrl`, `displayOrder`, `metaTitle`, `metaDescription`; `status` is `draft/published/cancelled` | flat strings, none of those fields, and `status` is `Upcoming/Ongoing/Completed` (`types/event.ts:3-6`) |
| 7 | §5 `gallery` (`docs/DATA-MODEL.md:283-300`) | a `GalleryItem` with `url`, `thumbnailUrl`, `tags`, `featured` | `gallery` is only counted; the real media collection is `galleryMedia`, keyed on `imagePath` |
| 8 | §6 `announcements` (`docs/DATA-MODEL.md:335-357`) | `content`, `active`, `pinned`, `publishedAt`, `expiresAt`, `type`, `targetAudience`, `priority` | `message`, `isActive`, `link` (`types/announcement.ts:1-8`) |
| 9 | §7 `donations` (`docs/DATA-MODEL.md:385-420`) | `donorEmail`, `donorPhone`, `donorAddress`, `pan`, `eligible80G`, `paymentStatus`, `transactionId`, `receiptUrl`, `certificateNumber`, `approvedBy`, `approvedAt` | `email`, `phone`, `address`, `status`, `paymentMode`, `adminRemarks`, `collectedBy`, `collectedAt` (`types/donation.ts:13-31`) |
| 10 | §8 (`docs/DATA-MODEL.md:450`) | the collection is `donationCampaigns`, with `goalAmount`, `currentAmount`, `startDate`, `endDate` | the collection is `donation_campaigns`, with `suggestedAmount` and `displayOrder` |
| 11 | §9 `settings` (`docs/DATA-MODEL.md:491-495`) | one document `settings/main` holding a `TempleSettings` object | eleven documents keyed by feature name; there is no `main` |
| 12 | §10 `knowledge` (`docs/DATA-MODEL.md:561-596`) | `{en,kn}` title, content and keywords, plus `summary`, `tags`, `featured`, `active`, `author`, `reviewedBy` | flat `title` and `content`, plus `kannadaTitle`, `kannadaContent`, `approved`, `slug` (`lib/ai/knowledge/types.ts:54-71`) |
| 13 | §11 `chat_sessions` (`docs/DATA-MODEL.md:624-655`) | an embedded `messages[]`, `sessionToken`, `status`, `endedAt`, `lastLanguage` | messages live in the `messages` collection (`services/chat.service.ts:101`); the session has `preferredLanguage`, no `status`, no `endedAt` |
| 14 | §12 `aaradhane` (`docs/DATA-MODEL.md:674-698`) | `dayOfWeek`, `startTime`, `endTime`, `active`, `{en,kn}` name and description | `guruName`, `dates[]`, `rituals[]`, `offerings[]`, `sevaDetails`, `isUpcoming`, `displayOrder` (`types/aaradhane.ts:1-16`) |
| 15 | §13 `panchanga` (`docs/DATA-MODEL.md:708-746`) | a Firestore collection with a full field list | no code ever queries it; the data is 730 JSON files under `data/panchanga/` |
| 16 | §14 `unknown_questions` (`docs/DATA-MODEL.md:751-781`) | `aiResponse`, `userId`, `addedToKnowledge`, `knowledgeArticleId`, `createdAt` | Firestore writes `timestamp` and `processed`; Supabase adds `times_asked`, `status`, `assigned_to`, `last_asked` |

`docs/SUPABASE_DATABASE_SCHEMA.md` fares better: its column lists for `sevas`
(`docs/SUPABASE_DATABASE_SCHEMA.md:66-77`), `daily_poojas` (`:84-97`) and `events` (`:104-119`)
match the migrations exactly. Its failing is omission rather than error - it labels `settings`
"Legacy / Not Required" (`:56`) and never mentions `receiptSevas`, `receipts`, `bills`, `quotes` or
`knowledge`, five collections holding live business data, two of them money.

## How to change it

### Add a field end to end (worked example: `sevas.sevaTypeCode`)

1. **Type.** `types/seva.ts:1` add it to `Seva`, and `types/seva.ts:25` add it to `SevaRequest` if
   the admin form sets it. Mark it optional or every existing document fails the cast.
2. **Service write.** Nothing to do when the write is a spread - `services/seva.service.ts:76,81`
   pass `{...data}`. When it is an explicit literal (for example `services/sevaBooking.service.ts:36`
   or `app/api/admin/receipt-sevas/route.ts:75`), add the key there.
3. **Service read / mapper.** This is the real gate. For sevas it is
   `services/seva.service.ts:12-25` (Supabase columns to camelCase) **and** the untyped Firestore
   fallback at `:34`, which returns raw `doc.data()` and therefore behaves differently. Miss the
   mapper and the field is stored but never surfaces.
4. **Firestore rule.** `firestore.rules`. Only `receiptSevas` (`:85-100`) validates a payload, so
   most collections need no rule change; if the target is `receiptSevas`, extend the checks there.
5. **Composite index.** Needed only when you will filter on the new field and order by another.
   Add an entry to `firestore.indexes.json` (22 today) and check it names the collection you
   actually query - `messages` versus `chat_messages` is the standing trap in this repo.
6. **Supabase column.** New file under `supabase/migrations/`. Use a timestamp that sorts after
   `20261010000000`, because four existing files are stamped in the future. There are no generated
   Supabase types, so nothing will warn you if the service mapper forgets the column.
7. **Migration script.** `scripts/migrate-sevas.ts:67-85`, or the matching mapper in
   `scripts/migrate-core-to-supabase.ts`, so a re-run carries the new field across.
8. **Admin form.** The page under `app/admin/...` that edits the collection.
9. **Public reader.** The page or the AI retriever - for sevas, `lib/ai/retrieval/sevas.ts:102-107`.
10. **Docs.** `docs/DATA-MODEL.md` and `docs/SUPABASE_DATABASE_SCHEMA.md`. Both already drift from
    the code; do not widen the gap.

### Find every site that touches a field

```
node .claude/state/inventory/fields.mjs
node -e "const d=require('./.claude/state/inventory/fields.json');console.log(d.stores.sevas.fields.amount)"
```

`.claude/state/inventory/fields.json` gives `{ writes: [path:line], reads: [path:line] }` per field. Always cross-check with
a plain grep, because the harvester cannot see spread writes.

### Rename a field safely

Rename in the type first and let the compiler find the call sites, then grep for the **string
literal** form, which the compiler cannot see: `where("<old>"`, `orderBy("<old>"`, the
`firestore.indexes.json` entry, the Supabase mapper, and `firestore.rules`. The `active` versus
`isActive` pair on `announcements` is exactly what happens when that second pass is skipped.

### Add a collection or a table

Follow M11 Recipe 2 (Firestore) and Recipe 3 (Supabase). Then re-run the harvester so this
catalogue picks the new store up, and add a subsection here with its four header lines.

## Coverage

- **Firestore collections in M11: 63. Catalogued here: 64.** All 63, plus `chat_messages`
  (`services/ai-analytics.service.ts:610`, resolved from `COLLECTIONS.CHAT_MESSAGES` at `:50`),
  which M11 mentions only as an index name and not as a collection.
- **Supabase tables in M11: 21. Catalogued here: 21 of 21**, every one parsed from its
  `CREATE TABLE` in `supabase/migrations/`.
- **Fields catalogued: 1121 rows** - 844 Firestore field rows across the 64 collection tables and
  277 Supabase column rows across the 21 table tables. Those rows are the union of the harvest
  (656 entries in `.claude/state/inventory/fields.json`: 607 across the 62 stores with a call site,
  plus 49 in the six per-document buckets `settings/aboutUs`, `settings/facilities`,
  `settings/futurePlans`, `settings/trustCommittee`, `settings/ai`, `guruParampara/aaradhanaes`)
  with 233 parsed TypeScript interfaces and 21 parsed `CREATE TABLE` statements. All orphan and
  mismatch counts in this file are quoted over the 607, so that a field is not counted twice.
- **Stores with no call site anywhere** - subsection present, table empty by design: `futurePlans`,
  `trustCommittee`, `knowledge_articles`, `knowledge_categories`, `panchanga`, and Firestore
  `temple_areas`. Twelve Supabase tables have a schema and no app code; they are named in the Index.
- **30 anchors could not be resolved** to a store name (`.claude/state/inventory/fields.json`, key `unresolvedAnchors`).
  All 30 were checked: 22 are `.from(...)` or `.doc(...)` calls on things that are not databases
  (`document.images`, `pdfBytes`, `screenshotBuffer`, `categorySet`, `uniqueMonths`), and 8 are the
  loop variables `collectionName` and `tableName` in `scripts/migrate-ai-to-supabase.ts`,
  `scripts/migrate-content-to-supabase.ts` and `scripts/migrate-core-to-supabase.ts`, whose values
  are collection names already catalogued.
- **Not scanned:** `tests/`, `data/panchanga/**` (730 files - counted, not opened, per RULES.md),
  `node_modules`, and every binary file. A field used only in a test does not appear here.
- **Path check:** every `path:line` in this file was extracted by script and existence-checked
  against disk before the file was returned.

## UNCLEAR

- **Where the `ai_settings` blocks really belong in `.claude/state/inventory/fields.json`.**
  `lib/ai/ai-settings/repository.ts` writes `ai_settings/main` in Firestore and the Supabase
  `unknown_questions` table from the same file, so the harvester filed `templeInformation`,
  `visitorInformation`, `templePolicies`, `aiResponses`, `aiBehavior`, `prompt`, `intents` and
  `updatedBy` under `unknown_questions`. Reading `lib/ai/ai-settings/repository.ts:96-180` confirms
  they are `ai_settings` blocks, and both subsections say so. Settled properly by splitting that
  repository into one file per store, after which the harvester attributes them correctly.
- **Whether the `receiptSevas` writes are correctly attributed.**
  `app/api/admin/receipt-sevas/route.ts` resolves its collection constant to `sevas` during the
  harvest, so the writes at `:75` and at `app/api/admin/receipt-sevas/[id]/route.ts:55` appear in
  the `sevas` bucket. Opening both routes shows they target `receiptSevas`. Settled by giving the
  constant a distinct name in those two files.
- **What is actually stored in `timings` and `trust`.** Both are read and neither has a writer
  anywhere in the repo, so their real field sets are whatever a one-off seed left behind. Settled by
  one `npm run firestore:dump` and looking at the documents; the dump is currently blocked by the
  free-tier read quota (M11 Recipe 7).
- **Whether `settings/config` and the billing settings document are distinct.**
  `services/proof-report/database-export.service.ts:85` reads `settings/config`;
  `app/admin/billing/settings/page.tsx:75-78` writes a settings document whose id comes from a
  variable the harvester could not resolve. Settled by opening that page and following the constant.
- **Which `temple_areas` migration is live** - the `uuid`-PK one
  (`supabase/migrations/20240523000000_create_temple_areas.sql:2`) or the `text`-PK one
  (`supabase/migrations/20240915_create_temple_areas.sql:2`). Both use `IF NOT EXISTS`. Inherited
  from M11; settled by describing the table against the live project.
- **Whether any Supabase migration has ever been applied.** There is no `supabase/config.toml`, no
  `.supabase/` directory and no CI step running a database push, so the twelve "schema only" tables
  may not exist at all. Settled by listing `supabase_migrations.schema_migrations`.
- **Whether the deny-all RLS on `events` is live.** `services/event.service.ts:46-123` reads and
  writes that table with the anon key against a `FOR ALL TO public USING (false)` policy
  (`supabase/migrations/20260907112632_create_core_tables.sql:98`). Either events are broken in
  production or RLS was disabled by hand. Settled by one anon-key select against the project.
- **Field types for the 19 typeless collections.** Everything marked `?` inferred is a name, not a
  type; the harvester cannot tell a `string` from a `Timestamp` from a `number`. Settled by a dump
  plus one pass over sampled documents, or by writing the missing interfaces into `types/`.
- **Whether `articles`, `ai_unknown_questions`, `chat_messages`, `futurePlans`, `trustCommittee`,
  `knowledge_articles` and `knowledge_categories` hold any live data.** All seven are either
  write-only, read-only or untouched in code. `data/firestore-dump/README.md:52` suggests several
  are empty, but that probe was cut short by the quota wall. Settled by the next clean dump.

## Verification log (2026-09-19)

Adversarial pass against the code. Method: 1299 `path:line` citations extracted and existence- and
range-checked by script; 1176 field-table citations re-checked against a window of the cited file;
45 declared Firestore types re-parsed and diffed field-by-field against their tables; all 21
Supabase tables re-parsed from `CREATE TABLE` and diffed against their column tables; the
collection/table list diffed against M11; 64 field rows opened by hand across 25 stores, weighted
to `sevaBookings`, `donations`, `sevas`, `receipts`, `users`, `events`, `announcements`,
`galleryMedia`, `temple_areas`; 12 orphan claims and 5 doc-mismatch rows re-tested by grep.

What survived: the 63 + 1 / 21 store list, all 45 type diffs (zero discrepancies), all 21 Supabase
column lists (zero discrepancies), the 607 = 167 + 86 + 354 orphan arithmetic, every index and rule
citation checked, and 0 broken paths. What did not:

- Index legend claimed `F` = fields catalogued -> now states `F` is the *harvest* count on Firestore
  rows (sums to 584 against 844 table rows) and the column count on Supabase rows (277) - evidence:
  counted both, `.claude/state/inventory/fields.json` bucket sizes.
- Supabase Index rows showed non-zero `W`/`R` beside "schema only, no app code" -> caution added
  naming the twelve tables with no `.from("<table>")` anywhere - evidence: grep, 0 hits each.
- "entry *n*" of `firestore.indexes.json` was undefined -> stated as the zero-based array position -
  evidence: `entry 0` = `users` `role`+`createdAt`, `firestore.indexes.json` index 0.
- `volunteer_requests.approved` was listed as a field and as a real bug -> **refuted and struck**:
  `app/admin/content/page.tsx:98` is a `testimonials` count, `volunteer_requests` is counted
  unfiltered at `:99`, and `pendingVolunteers` is hard-coded `0` at `:114`.
- `announcements.active` cited `app/admin/content/page.tsx:168` -> removed; `:168` queries `events`.
  Same for `announcements.title` at `:180` and the `announcements.date` row at `:90`.
- `sevas.price` "the AI gets `undefined`" -> refuted: `lib/ai/firebaseChat.ts:111` is
  `data.price || data.amount || ""`, so the AI gets the amount. Reclassified as harmless.
- `users.templeId`, `.profileImage`, `.isApproved` listed as "no reader anywhere" -> refuted: read
  at `services/auth.service.ts:106-108` and `lib/auth.ts:104-106` on every login. Row narrowed to
  `uid`, `lastLogin`, `emailVerified`; the sharper true claim (nothing branches on `isApproved`)
  kept.
- `page_views.visitorId` listed as "never queried or aggregated" -> refuted:
  `services/pageviews.service.ts:126-129` folds it into the unique-visitor set. Row narrowed to
  `date`.
- `galleryMedia.caption` listed with `url`/`imageUrl` as a broken read -> split: `caption` falls
  back to `title`, a real field (`app/admin/media/page.tsx:89`); only the thumbnail URL is blank.
- sb `temple_areas` showed **no writes** -> added: `addArea` (`services/temple-areas.supabase.service.ts:102-120`),
  `updateArea` (`:129-149`) and `deleteArea` (`:161-162`), all on the service-role client. This is
  the repository's only complete Supabase CRUD and the builder's harvest missed all of it.
- `receipts` showed every field as "declared, **no call site**" -> all fourteen writes filled in
  from `lib/receipt/admin.ts:121-136` (set at `:139`). `emailDelivery` / `whatsappDelivery` are
  confirmed absent from that payload, so no receipt on disk carries delivery state.
- New fault: `app/api/admin/receipts/route.ts` combines `where("sevaIds","array-contains")` (`:55`)
  with `orderBy("createdAt")` (`:39`) and `firestore.indexes.json` has no `receipts` entry, so
  filtering receipts by seva throws `FAILED_PRECONDITION`.
- "Collections with no TypeScript type (18)" listed 19 names and the arithmetic below it read
  9 - 2 + 11 -> corrected to **19** everywhere (heading, summary table, UNCLEAR) and to
  "Twelve collections M11 did not name"; 19 is also the count of Firestore rows carrying **none**
  in the Index.
- New blind spot documented: `app/admin/content/page.tsx` is an array with one collection per line,
  so the harvester window spills a line either way; the verified per-line attribution is now listed
  in the "What it cannot see" list.
- M11 cites `services/temple-areas.supabase.service.ts:15,38,62` for the reads; the `.from()` calls
  are at `:16,39,63,81`. M16 was right, M11 is off by one. Not corrected here - not my file.

**Regeneration caveat.** Eleven of the corrections above are inside `<!--FIELDS-->` / `<!--COLUMNS-->`
/ Index blocks, which `node .claude/state/inventory/fields.mjs --expand <this file>` rewrites from
`.claude/state/inventory/fields.json`. Re-running `--expand` will discard them, because the
underlying harvest is what was wrong. Fix `.claude/state/inventory/fields.mjs` first (per-line
anchor scoping for array literals; follow `const x = {…}; .insert(x)` and `obj.k = v` assignment
payloads) or re-apply this log by hand afterwards.
