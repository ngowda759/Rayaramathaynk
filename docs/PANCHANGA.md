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

```
├── scripts/
│   ├── panchanga.py              # CLI tool for generating panchanga (manual use)
│   └── generate_panchanga.py     # GitHub Actions automation script
├── public/
│   └── data/
│       └── panchanga/
│           └── current.json      # Today's panchanga data
├── data/
│   └── panchanga/
│       └── {year}/
│           └── {date}.json      # Historical panchanga data
├── lib/
│   └── panchanga-cache.ts        # Fallback/purged cache functions
└── .github/
    └── workflows/
        └── panchanga.yml        # GitHub Actions workflow
```

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

### 1. Get Today's Panchanga

**URL:** `/data/panchanga/current.json`

**Method:** `GET`

**Description:** Returns today's panchanga data

**Response:**
```json
{
  "metadata": {
    "generator": "Rayara Panchanga Engine",
    "version": "1.0.0",
    "generated_at": "2026-07-08T07:44:30.778237",
    "valid_for": "2026-07-08",
    "timezone": "Asia/Kolkata"
  },
  "date": "2026-07-08",
  "location": {
    "latitude": 13.1005,
    "longitude": 77.5963,
    "timezone": "Asia/Kolkata"
  },
  "weekday": {
    "english": "Wednesday",
    "sanskrit": "Budhavara",
    "number": 3
  },
  "sun": {
    "sunrise": "2026-07-08T06:02:31.976176+05:30",
    "sunset": "2026-07-08T18:46:46.948940+05:30",
    "day_duration_hours": 12.7375
  },
  "tithi": {
    "number": 23,
    "name": "Krishna Ashtami",
    "paksha": "Krishna",
    "start": "2026-07-07T13:25:27.025232+05:30",
    "end": "2026-07-08T12:22:13.665562+05:30"
  },
  "nakshatra": {
    "number": 27,
    "name": "Revati",
    "pada": 3,
    "lord": "Mercury",
    "start": "2026-07-07T16:24:15.833785+05:30",
    "end": "2026-07-08T16:00:16.185026+05:30"
  },
  "yoga": {
    "number": 6,
    "name": "Atiganda",
    "start": "2026-07-07T14:30:40.794750+05:30",
    "end": "2026-07-08T12:37:39.153843+05:30"
  },
  "karana": {
    "number": 3,
    "name": "Kaulava",
    "start": "2026-07-08T00:58:59.720383+05:30",
    "end": "2026-07-08T12:22:13.665562+05:30"
  },
  "masa": {
    "number": 3,
    "name": "Jyeṣṭha",
    "is_adhik": false,
    "paksha": "Krishna"
  },
  "samvat": {
    "vikram": 2083,
    "shaka": 1948,
    "samvatsara": "Parabhava"
  },
  "rahu_kalam": {
    "name": "Rahu Kalam",
    "start": "2026-07-08T12:24:39.476157+05:30",
    "end": "2026-07-08T14:00:11.351162+05:30",
    "is_auspicious": false
  },
  "yama_gandam": {
    "name": "Yama Gandam",
    "start": "2026-07-08T15:35:43.226168+05:30",
    "end": "2026-07-08T17:11:15.101173+05:30",
    "is_auspicious": false
  },
  "gulika_kalam": {
    "name": "Gulika Kalam",
    "start": "2026-07-08T10:49:07.601192+05:30",
    "end": "2026-07-08T12:24:39.476157+05:30",
    "is_auspicious": false
  },
  "abhijit_muhurat": {
    "name": "Abhijit Muhurat",
    "start": "2026-07-08T11:59:10.976180+05:30",
    "end": "2026-07-08T12:50:07.976174+05:30",
    "is_auspicious": true
  },
  "durmuhurta": [],
  "varjyam": [],
  "amrita_kalam": []
}
```

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

### 1. panchanga.py (Manual CLI)

For local testing and validation.

```bash
# Install dependency
pip install panchang

# Run (compact output)
python scripts/panchanga.py

# Run (pretty output)
python scripts/panchanga.py --pretty
```

### 2. generate_panchanga.py (GitHub Actions)

Called by the workflow to generate and save the JSON file.

```bash
# This is automatically run by GitHub Actions
python scripts/generate_panchanga.py
```

---

## GitHub Actions Workflow

**File:** `.github/workflows/panchanga.yml`

**Schedule:**
- Every day at 02:00 IST (20:30 UTC previous day)
- Every day at 11:00 IST (05:30 UTC)
- Every day at 14:30 IST (09:00 UTC)

**Manual Trigger:** Available via GitHub Actions UI

**Process:**
1. Checkout code
2. Setup Python 3.11
3. Install `panchang` library
4. Run `generate_panchanga.py`
5. Commit and push `current.json`

---

## Usage in Frontend

### React Component

```tsx
import { useEffect, useState } from 'react';

export default function PanchangaWidget() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch('/data/panchanga/current.json')
      .then(res => res.json())
      .then(setData);
  }, []);
  
  if (!data) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>{data.tithi.name}</h2>
      <p>Nakshatra: {data.nakshatra.name}</p>
      <p>Sunrise: {new Date(data.sun.sunrise).toLocaleTimeString()}</p>
    </div>
  );
}
```

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
