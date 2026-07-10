#!/usr/bin/env python3
"""
Panchanga CLI using panchang library
"""

import argparse
import json
from datetime import datetime

from panchang import Location
from panchang.panchang import compute

# ==========================
# Hardcoded Configuration
# ==========================

LAT = 13.1005
LON = 77.5963
TZ = "Asia/Kolkata"

# Use current date automatically
DATE = datetime.now().strftime("%Y-%m-%d")


def time_window(window):
    if window is None:
        return None

    return {
        "name": window.name,
        "start": window.start.isoformat(),
        "end": window.end.isoformat(),
        "is_auspicious": window.is_auspicious,
    }


def main():
    parser = argparse.ArgumentParser(description="Panchanga CLI")
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty print JSON"
    )

    args = parser.parse_args()

    # Use DATE from config (current date)
    target_date = datetime.strptime(DATE, "%Y-%m-%d").date()

    location = Location(
        lat=LAT,
        lng=LON,
        tz=TZ,
    )

    p = compute(target_date, location)

    result = {
        "metadata": {
            "generator": "Rayara Panchanga Engine",
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "valid_for": DATE,
            "timezone": TZ
        },
        "date": p.date,
        "location": {
            "latitude": LAT,
            "longitude": LON,
            "timezone": TZ,
        },
        "weekday": {
            "english": p.vara.english,
            "sanskrit": p.vara.name,
            "number": p.vara.number,
        },
        "sun": {
            "sunrise": p.sun.sunrise.isoformat(),
            "sunset": p.sun.sunset.isoformat(),
            "day_duration_hours": round(p.sun.day_duration_hours, 4),
        },
        "tithi": {
            "number": p.tithi.number,
            "name": p.tithi.name,
            "paksha": p.tithi.paksha.value,
            "start": p.tithi.start.isoformat(),
            "end": p.tithi.end.isoformat(),
        },
        "nakshatra": {
            "number": p.nakshatra.number,
            "name": p.nakshatra.name,
            "pada": p.nakshatra.pada,
            "lord": p.nakshatra.lord,
            "start": p.nakshatra.start.isoformat(),
            "end": p.nakshatra.end.isoformat(),
        },
        "yoga": {
            "number": p.yoga.number,
            "name": p.yoga.name,
            "start": p.yoga.start.isoformat(),
            "end": p.yoga.end.isoformat(),
        },
        "karana": {
            "number": p.karana.number,
            "name": p.karana.name,
            "start": p.karana.start.isoformat(),
            "end": p.karana.end.isoformat(),
        },
        "masa": {
            "number": p.masa.number,
            "name": p.masa.name,
            "is_adhik": p.masa.is_adhik,
            "paksha": p.masa.paksha.value,
        } if p.masa else None,
        "samvat": {
            "vikram": p.samvat.vikram,
            "shaka": p.samvat.shaka,
            "samvatsara": p.samvat.samvatsara_name,
        } if p.samvat else None,
        "rahu_kalam": time_window(p.rahu_kalam),
        "yama_gandam": time_window(p.yama_gandam),
        "gulika_kalam": time_window(p.gulika_kalam),
        "abhijit_muhurat": time_window(p.abhijit_muhurat),
        "durmuhurta": [],
        "varjyam": [],
        "amrita_kalam": []
    }

    if args.pretty:
        print(json.dumps(result, indent=4, ensure_ascii=False))
    else:
        print(json.dumps(result, separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
