# Panchanga Module Documentation

## Overview

The Panchanga module generates daily Hindu calendar information (Panchanga) for Sri Raghavendra Swamy Matha, Yelahanka. It calculates five essential elements of Hindu astrology:

1. **Tithi** (Lunar Day)
2. **Nakshatra** (Lunar Mansion/Star)
3. **Yoga** (Luni-Solar Day)
4. **Karana** (Half of Tithi)
5. **Paksha** (Lunar Fortnight)

Additionally, it provides auspicious/inauspicious times, sunrise/sunset, and calendar information.

---

## File Structure

Panchanga is published to Supabase Storage. The repository still contains the
historical files during the approved cutover, but no application consumer reads
them.

```
Supabase Storage (bucket: RayaramathaYNK)
└── Data_flows/Panchanga/
    ├── current.json              # latest validated record
    ├── daily/YYYY-MM-DD.json     # historical daily records
    └── years/YYYY.json           # complete yearly datasets

Repository
├── scripts/
│   ├── panchanga.py              # CLI generator (supports --date)
│   ├── generate_panchanga.py     # writes one day to an explicit --output path
│   ├── publish-panchanga.ts      # validates and publishes to Storage
│   └── migrate-data-flows-to-storage.ts  # historical validator/importer
├── lib/
│   ├── data-flows/               # typed readers, publishers, schemas, paths
│   └── panchanga-cache.ts        # explicit unavailable fallback only
├── app/api/panchanga/            # server-side read-only endpoints
├── public/data/panchanga/current.json    # legacy copy, retained for rollback
└── data/panchanga/YYYY/*.json            # historical source for migration
```

The legacy `public/data/panchanga/current.json` and `data/panchanga/**` files are
not read by the home widget, lobby display, AI retrieval or the Aaradhane
generator. They remain on disk until the owner approves their removal after a
verified cutover.

---

## Configuration

**Location:** Bangalore, India
- **Latitude:** 13.1005°N
- **Longitude:** 77.5963°E
- **Timezone:** Asia/Kolkata (IST, UTC+5:30)

**Python Requirements:**
- Python 3.11+
- `panchang` library

---

## API Endpoints

All public reads go through a server-side route. The browser never receives a
Supabase service-role key.

### 1. Get Today's Panchanga

**URL:** `/api/panchanga/current`

**Method:** `GET`

**Description:** Returns today's Panchanga from `Data_flows/Panchanga/current.json`,
classified against the Asia/Kolkata date.

**Response:**

```json
{
  "status": "ok",
  "source": "supabase-storage",
  "expectedDate": "2026-11-24",
  "record": {
    "metadata": { "valid_for": "2026-11-24", "timezone": "Asia/Kolkata" },
    "date": "2026-11-24",
    "tithi": { "name": "Shukla Purnima" }
  }
}
```

`status` is `ok`, `stale` or `unavailable`:

- `ok` — the record is for the current Asia/Kolkata day.
- `stale` — the last published record is from another day. It is returned for
  diagnostics but is not presented as today's Panchanga.
- `unavailable` — Storage could not be reached or the object is invalid. The
  endpoint returns HTTP 503.

### 2. Get a historical day

**URL:** `/api/panchanga/daily/YYYY-MM-DD`

Reads `Data_flows/Panchanga/daily/YYYY-MM-DD.json`. The requested date must match
the record's `date`, otherwise the response is `unavailable`.

### 3. Get a complete year

**URL:** `/api/panchanga/years/YYYY`

Reads `Data_flows/Panchanga/years/YYYY.json`.

### Legacy endpoint

`GET /data/panchanga/current.json` still exists as a static file during the
cutover, but no application code uses it. The home widget and lobby display use
`/api/panchanga/current`.

---

## Data Fields Explained

### 1. Tithi (Lunar Day)
| Field | Description |
|-------|-------------|
| `number` | 1-30, where 1=Pratipada, 15=Poornima, 30=Amavasya |
| `name` | Full name (e.g., "Krishna Ashtami") |
| `paksha` | "Shukla" (waxing) or "Krishna" (waning) |
| `start` | When this tithi begins |
| `end` | When this tithi ends |

### 2. Nakshatra (Lunar Mansion)
| Field | Description |
|-------|-------------|
| `number` | 1-27, representing the 27 nakshatras |
| `name` | Star name (e.g., "Revati") |
| `pada` | Quarter (1-4) within the nakshatra |
| `lord` | Ruling planet of the nakshatra |
| `start` | When this nakshatra begins |
| `end` | When this nakshatra ends |

### 3. Yoga
| Field | Description |
|-------|-------------|
| `number` | 1-27 |
| `name` | Yoga name (e.g., "Atiganda") |
| `start` | When this yoga begins |
| `end` | When this yoga ends |

### 4. Karana
| Field | Description |
|-------|-------------|
| `number` | 1-11 (half of a tithi) |
| `name` | Karana name (e.g., "Kaulava") |
| `start` | When this karana begins |
| `end` | When this karana ends |

### 5. Masa (Lunar Month)
| Field | Description |
|-------|-------------|
| `number` | 1-12 (Chaitra=1, Phalguna=12) |
| `name` | Month name in Sanskrit (e.g., "Jyeṣṭha") |
| `is_adhik` | True if it's an intercalary month |
| `paksha` | "Shukla" or "Krishna" |

### 6. Samvat (Calendar Era)
| Field | Description |
|-------|-------------|
| `vikram` | Vikram Samvat year (e.g., 2083) |
| `shaka` | Shaka Samvat year (e.g., 1948) |
| `samvatsara` | 60-year cycle name (e.g., "Parabhava") |

### 7. Weekday (Vara)
| Field | Description |
|-------|-------------|
| `english` | Day name in English |
| `sanskrit` | Day name in Sanskrit |
| `number` | 1-7 (Sunday=1) |

### 8. Sun Times
| Field | Description |
|-------|-------------|
| `sunrise` | Sunrise time with timezone |
| `sunset` | Sunset time with timezone |
| `day_duration_hours` | Length of day in hours |

### 9. Auspicious/Inauspicious Times
| Field | Description | Type |
|-------|-------------|------|
| `rahu_kalam` | Inauspicious time | Daily (varies by weekday) |
| `yama_gandam` | Inauspicious time | Daily (varies by weekday) |
| `gulika_kalam` | Inauspicious time | Daily (varies by weekday) |
| `abhijit_muhurat` | Most auspicious time | ~11:48 AM - 12:36 PM |
| `durmuhurta` | Inauspicious period | Morning/Evening |
| `varjyam` | Inauspicious period | Based on planetary positions |
| `amrita_kalam` | Auspicious period | Based on lunar position |

---

## Scripts

### 1. `panchanga.py` (manual CLI)

```bash
pip install panchang

# Today (runner timezone; the workflow always sets TZ=Asia/Kolkata)
python scripts/panchanga.py

# A specific day
python scripts/panchanga.py --date 2026-11-24 --pretty

# A whole year
python scripts/panchanga.py --year 2026 --pretty
```

### 2. `generate_panchanga.py`

Generates one day and writes it to an explicit path. The workflow uses this so it
never modifies a tracked static file.

```bash
python scripts/generate_panchanga.py \
  --date 2026-11-24 \
  --output artifacts/panchanga/2026-11-24.json
```

The script refuses to write if the generated `date` and `metadata.valid_for`
disagree with `--date`.

### 3. `publish-panchanga.ts`

Validates the complete record and publishes it to Storage. `--dry-run` validates
only.

```bash
npx tsx scripts/publish-panchanga.ts \
  --file artifacts/panchanga/2026-11-24.json \
  --date 2026-11-24 \
  --dry-run
```

Without `--dry-run` it needs `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. It writes the daily object first, then the yearly
dataset, then `current.json`, verifying each upload by reading it back.

### 4. `migrate-data-flows-to-storage.ts`

Validates the historical `data/panchanga/**` files and regenerates the Aaradhane
datasets locally. It is a dry run unless `--publish --confirm-production` is
combined with `DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED=true`.

```bash
npx tsx scripts/migrate-data-flows-to-storage.ts --report /tmp/historical.json
```

---

## GitHub Actions Workflow

**File:** `.github/workflows/panchanga.yml`

**Schedule (unchanged):**
- `30 23 * * *`
- `30 21 * * *`
- `30 6 * * *`
- `30 8 * * *`

**Manual Trigger:** Available via GitHub Actions UI

**Process:**
1. Checkout scripts.
2. Install Python and Node dependencies.
3. Compute the target date with `TZ=Asia/Kolkata date +%F`.
4. Generate to `artifacts/panchanga/YYYY-MM-DD.json`.
5. Validate the record without writing.
6. If `PANCHANGA_STORAGE_PUBLISH_ENABLED` is `true`, run the approved-URL guard
   and publish to Storage.
7. Upload the generated JSON as a workflow artifact.

**No Pull Request is created and no auto-merge is requested.** Publication stays
disabled until the owner sets the repository variable
`PANCHANGA_STORAGE_PUBLISH_ENABLED=true` and provides
`SUPABASE_SERVICE_ROLE_KEY`.

---

## Usage in Frontend

The home widget and lobby display call the server endpoint. They only use a
record whose status is `ok`; a `stale` or `unavailable` response leaves the CMS
fallback values in place.

```tsx
const res = await fetch("/api/panchanga/current", { cache: "no-store" });
const json = await res.json();
if (!res.ok || json.status !== "ok" || !json.record) return;

const record = json.record;
// record.tithi.name, record.nakshatra.name, record.sun.sunrise, ...
```

The AI retrieval path (`lib/ai/retrieval/panchanga.ts`) uses the same server
reader and derives "today" from `getIstDateString()`, never from
`toISOString().slice(0, 10)`.

---

## Tithi Names

### Shukla Paksha (Waxing Moon)
| Number | Name |
|--------|------|
| 1 | Shukla Pratipada |
| 2 | Shukla Dvitiya |
| 3 | Shukla Tritiya |
| 4 | Shukla Chaturthi |
| 5 | Shukla Panchami |
| 6 | Shukla Shashti |
| 7 | Shukla Saptami |
| 8 | Shukla Ashtami |
| 9 | Shukla Navami |
| 10 | Shukla Dashami |
| 11 | Shukla Ekadashi |
| 12 | Shukla Dvadashi |
| 13 | Shukla Trayodashi |
| 14 | Shukla Chaturdashi |
| 15 | Poornima (Full Moon) |

### Krishna Paksha (Waning Moon)
| Number | Name |
|--------|------|
| 16 | Krishna Pratipada |
| 17 | Krishna Dvitiya |
| 18 | Krishna Tritiya |
| 19 | Krishna Chaturthi |
| 20 | Krishna Panchami |
| 21 | Krishna Shashti |
| 22 | Krishna Saptami |
| 23 | Krishna Ashtami |
| 24 | Krishna Navami |
| 25 | Krishna Dashami |
| 26 | Krishna Ekadashi |
| 27 | Krishna Dvadashi |
| 28 | Krishna Trayodashi |
| 29 | Krishna Chaturdashi |
| 30 | Amavasya (New Moon) |

---

## Nakshatra Names (27 Stars)

| Number | Name | Lord |
|--------|------|------|
| 1 | Ashwini | Ketu |
| 2 | Bharani | Venus |
| 3 | Krittika | Sun |
| 4 | Rohini | Moon |
| 5 | Mrigashira | Mars |
| 6 | Ardra | Rahu |
| 7 | Punarvasu | Jupiter |
| 8 | Pushya | Saturn |
| 9 | Ashlesha | Mercury |
| 10 | Magha | Ketu |
| 11 | Purva Phalguni | Venus |
| 12 | Uttara Phalguni | Sun |
| 13 | Hasta | Moon |
| 14 | Chitra | Mars |
| 15 | Swati | Rahu |
| 16 | Vishakha | Jupiter |
| 17 | Anuradha | Saturn |
| 18 | Jyeshtha | Mercury |
| 19 | Mula | Ketu |
| 20 | Purva Ashadha | Venus |
| 21 | Uttara Ashadha | Sun |
| 22 | Shravana | Moon |
| 23 | Dhanishtha | Mars |
| 24 | Shatabhisha | Rahu |
| 25 | Purva Bhadrapada | Jupiter |
| 26 | Uttara Bhadrapada | Saturn |
| 27 | Revati | Mercury |

---

## Masa Names (Lunar Months)

| Number | Name |
|--------|------|
| 1 | Chaitra |
| 2 | Vaishakha |
| 3 | Jyeṣṭha |
| 4 | Ashadha |
| 5 | Shravana |
| 6 | Bhadrapada |
| 7 | Ashwin |
| 8 | Kartika |
| 9 | Margashirsha |
| 10 | Paush |
| 11 | Magha |
| 12 | Phalguna |

---

## Troubleshooting

### Error: "panchang" package not found
```bash
pip install panchang
```

### Error: Python version too old
The `panchang` library requires Python 3.11+. Upgrade Python if needed.

### Panchanga data not updating
1. Check GitHub Actions workflow runs
2. Verify `current.json` was committed
3. Wait for Vercel rebuild (may take 1-2 minutes)

### Different values from other sources
The `panchang` library uses Swiss Ephemeris for astronomical calculations. Slight variations (1-2 minutes) in sunrise/sunset times may occur depending on the calculation method used.
