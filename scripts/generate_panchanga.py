#!/usr/bin/env python3
"""
Panchanga Generator - NO EXTERNAL DEPENDENCIES
Pure Python calculations for Hindu calendar
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from math import sin, cos, acos, asin, pi, floor

LATITUDE = 13.1005
LONGITUDE = 77.5963

TITHI_NAMES = [
    "Shukla Pratipada", "Shukla Dvitiya", "Shukla Tritiya", "Shukla Chaturthi", "Shukla Panchami",
    "Shukla Shashti", "Shukla Saptami", "Shukla Ashtami", "Shukla Navami", "Shukla Dashami",
    "Shukla Ekadashi", "Shukla Dvadashi", "Shukla Trayodashi", "Shukla Chaturdashi", "Poornima",
    "Krishna Pratipada", "Krishna Dvitiya", "Krishna Tritiya", "Krishna Chaturthi", "Krishna Panchami",
    "Krishna Shashti", "Krishna Saptami", "Krishna Ashtami", "Krishna Navami", "Krishna Dashami",
    "Krishna Ekadashi", "Krishna Dvadashi", "Krishna Trayodashi", "Krishna Chaturdashi", "Amavasya"
]

NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya",
    "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati",
    "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

YOGA_NAMES = [
    "Vishkumbha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarman",
    "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Harshana", "Vajra", "Siddhi",
    "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla",
    "Amrita", "Chitra", "Gwrata"
]

KARANA_NAMES = ["Bava", "Balava", "Kaulava", "Taitula", "Garija", "Vanij", "Vishti", "Shakuni", "Chatushtapa", "Naga"]
MASA_NAMES = ["", "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashwin", "Kartika", "Margashirsha", "Paush", "Magha", "Phalguna"]
WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
SANSKRIT_WEEKDAY = ["Ravivara", "Somavara", "Mangalavara", "Budhavara", "Guruvara", "Shukravara", "Shanivara"]
SAMVATSARA = [
    "Prabhava", "Vibhava", "Shukla", "Pramadi", "Arka", "Vrisha", "Kshiti", "Prithvi",
    "Ayu", "Dhuma", "Vyatipata", "Kshaya", "Naga", "Pingala", "Kshalaka", "Siddhartha",
    "Roudri", "Durmukhi", "Dundubhi", "Dvandvaja", "Kshemi", "Prarthivi", "Vikrama",
    "Vrisha", "Tsitru", "Kshobhya", "Sobra", "Krodhi", "Vishnu", "Paridhavi", "Pramadi",
    "Aananda", "Rakshasa", "Anala", "Parabhava", "Plavanga", "Shubhakrit", "Sobhana",
    "Krodhi", "Vishnu", "Paridhavi", "Pramadi", "Aananda", "Rakshasa", "Anala", "Parabhava",
    "Plavanga", "Shubhakrit", "Sobhana", "Krodhi", "Vishnu", "Paridhavi", "Pramadi",
    "Aananda", "Rakshasa", "Anala", "Parabhava"
]
NAKSHATRA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]

def to_jd(year, month, day, hour=12):
    if month <= 2:
        year -= 1
        month += 12
    A = floor(year / 100)
    B = 2 - A + floor(A / 4)
    return floor(365.25 * (year + 4716)) + floor(30.6001 * (month + 1)) + day + hour / 24.0 + B - 1524.5

def lunar_pos(jd):
    T = (jd - 2451545.0) / 36525.0
    L0 = 218.3165 + 481267.8813 * T
    l = 134.9634 + 13.064993 * T
    lp = 357.5291 + 0.98560028 * T
    D = 297.8502 + 445267.1115 * T
    moon = L0 + 6.29 * sin(l * pi / 180)
    moon += 1.27 * sin((l - 2 * D) * pi / 180)
    moon += 0.66 * sin((2 * L0 - l) * pi / 180)
    moon += 0.21 * sin(l * pi / 180) * sin(lp * pi / 180)
    moon += 0.18 * sin(2 * D * pi / 180)
    return moon % 360

def solar_pos(jd):
    T = (jd - 2451545.0) / 36525.0
    L0 = 280.4665 + 36000.7698 * T
    M = (357.5291 + 0.98560028 * T) % 360
    C = 1.915 * sin(M * pi / 180) + 0.020 * sin(2 * M * pi / 180)
    return (L0 + C) % 360

def get_tithi(jd):
    moon = lunar_pos(jd)
    sun = solar_pos(jd)
    phase = (moon - sun) % 360
    return int(phase / 12) % 30

def get_nakshatra(jd):
    moon = lunar_pos(jd)
    nak = int(moon / 13.3333) % 27
    pada = int((moon % 13.3333) / 3.3333) + 1
    return nak, pada

def get_yoga(jd):
    moon = lunar_pos(jd)
    sun = solar_pos(jd)
    ang = (moon + sun) % 360
    return int(ang / 13.3333) % 27

def get_karana(jd):
    moon = lunar_pos(jd)
    sun = solar_pos(jd)
    phase = (moon - sun) % 360
    return int(phase / 6) % 10

def get_masa(jd):
    moon = lunar_pos(jd)
    return int(moon / 30) % 12 + 1

def rahu_kalam(dt):
    offs = {0: 7.5, 1: 5.5, 2: 4.5, 3: 6.5, 4: 2.5, 5: 1.5, 6: 3.5}
    h = offs.get(dt.weekday(), 7.5)
    s = dt.replace(hour=0, minute=0, second=0) + timedelta(hours=h)
    return s, s + timedelta(hours=1, minutes=30)

def yama_gandam(dt):
    offs = {0: 4.5, 1: 2.5, 2: 7.5, 3: 5.5, 4: 6.5, 5: 3.5, 6: 1.5}
    h = offs.get(dt.weekday(), 4.5)
    s = dt.replace(hour=0, minute=0, second=0) + timedelta(hours=h)
    return s, s + timedelta(hours=1, minutes=30)

def gulika(dt):
    offs = {0: 1.5, 1: 7.5, 2: 5.5, 3: 3.5, 4: 1.5, 5: 6.5, 6: 2.5}
    h = offs.get(dt.weekday(), 1.5)
    s = dt.replace(hour=0, minute=0, second=0) + timedelta(hours=h)
    return s, s + timedelta(hours=1, minutes=30)

def generate(date_str=None):
    if date_str:
        dt = datetime.fromisoformat(date_str)
    else:
        dt = datetime.utcnow()
    
    ist = timezone(timedelta(hours=5, minutes=30))
    dt_ist = dt.astimezone(ist)
    year, month, day = dt_ist.year, dt_ist.month, dt_ist.day
    jd = to_jd(year, month, day, 12)
    
    t = get_tithi(jd)
    n, pada = get_nakshatra(jd)
    y = get_yoga(jd)
    k = get_karana(jd)
    m = get_masa(jd)
    
    sunrise = datetime(year, month, day, 6, 2, tzinfo=ist)
    sunset = datetime(year, month, day, 18, 46, tzinfo=ist)
    
    r_start, r_end = rahu_kalam(dt_ist)
    y_start, y_end = yama_gandam(dt_ist)
    g_start, g_end = gulika(dt_ist)
    
    ab_start = dt_ist.replace(hour=11, minute=48, second=0)
    ab_end = dt_ist.replace(hour=12, minute=36, second=0)
    
    return {
        "metadata": {
            "generator": "Rayara Panchanga Engine",
            "version": "4.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "valid_for": f"{year}-{month:02d}-{day:02d}",
            "timezone": "Asia/Kolkata"
        },
        "date": f"{year}-{month:02d}-{day:02d}",
        "location": {"latitude": LATITUDE, "longitude": LONGITUDE, "timezone": "Asia/Kolkata"},
        "weekday": {"english": WEEKDAY[dt_ist.weekday()], "sanskrit": SANSKRIT_WEEKDAY[dt_ist.weekday()], "number": dt_ist.weekday() + 1},
        "sun": {"sunrise": sunrise.isoformat(), "sunset": sunset.isoformat(), "day_duration_hours": 12.73},
        "tithi": {"number": t + 1, "name": TITHI_NAMES[t], "paksha": "Shukla" if t < 15 else "Krishna",
                  "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30", "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"},
        "nakshatra": {"number": n + 1, "name": NAKSHATRA_NAMES[n], "pada": pada, "lord": NAKSHATRA_LORDS[n % 9],
                      "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30", "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"},
        "yoga": {"number": y + 1, "name": YOGA_NAMES[y],
                 "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30", "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"},
        "karana": {"number": k + 1, "name": KARANA_NAMES[k] if k < 7 else KARANA_NAMES[7],
                   "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30", "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"},
        "masa": {"number": m, "name": MASA_NAMES[m], "is_adhik": False, "paksha": "Shukla" if m <= 6 else "Krishna"},
        "samvat": {"vikram": year + 57, "shaka": year - 78, "samvatsara": SAMVATSARA[(year + 57 - 1986) % 60]},
        "rahu_kalam": {"name": "Rahu Kalam", "start": r_start.isoformat(), "end": r_end.isoformat(), "is_auspicious": False},
        "yama_gandam": {"name": "Yama Gandam", "start": y_start.isoformat(), "end": y_end.isoformat(), "is_auspicious": False},
        "gulika_kalam": {"name": "Gulika Kalam", "start": g_start.isoformat(), "end": g_end.isoformat(), "is_auspicious": False},
        "abhijit_muhurat": {"name": "Abhijit Muhurat", "start": ab_start.isoformat(), "end": ab_end.isoformat(), "is_auspicious": True},
        "durmuhurta": [], "varjyam": [], "amrita_kalam": []
    }

if __name__ == "__main__":
    out = Path(__file__).parent.parent / "public" / "data" / "panchanga" / "current.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    data = generate()
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Panchanga for {data['date']}: {data['tithi']['name']}, {data['nakshatra']['name']}")
    print(f"Saved: {out}")
