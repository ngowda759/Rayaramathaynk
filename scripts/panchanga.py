#!/usr/bin/env python3
"""
Panchanga CLI using panchang library
"""

import argparse
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from panchang import Location
from panchang.panchang import compute

# ==========================
# Hardcoded Configuration
# ==========================

LAT = 13.1005
LON = 77.5963
TZ = "Asia/Kolkata"


def time_window(window):
    if window is None:
        return None

    return {
        "name": window.name,
        "start": window.start.isoformat(),
        "end": window.end.isoformat(),
        "is_auspicious": window.is_auspicious,
    }


def compute_panchanga(target_date, location):
    p = compute(target_date, location)
    
    return {
        "metadata": {
            "generator": "Rayara Panchanga Engine",
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
            "valid_for": str(target_date),
            "timezone": TZ
        },
        "date": str(target_date),
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


def main():
    parser = argparse.ArgumentParser(description="Panchanga CLI")
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty print JSON"
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Generate data for entire year"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory for year data"
    )

    args = parser.parse_args()

    location = Location(
        lat=LAT,
        lng=LON,
        tz=TZ,
    )

    if args.year:
        # Generate data for entire year
        output_dir = Path(args.output) if args.output else Path("data/panchanga") / str(args.year)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate for all 365/366 days
        year = args.year
        if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):
            days_in_year = 366
        else:
            days_in_year = 365
        
        start_date = datetime(year, 1, 1).date()
        
        print(f"Generating Panchanga data for {year} ({days_in_year} days)")
        
        for i in range(days_in_year):
            target_date = start_date + timedelta(days=i)
            result = compute_panchanga(target_date, location)
            
            # Save to file
            output_file = output_dir / f"{target_date}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                if args.pretty:
                    json.dump(result, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(result, f, separators=(",", ":"), ensure_ascii=False)
            
            if (i + 1) % 50 == 0:
                print(f"  Generated {i + 1}/{days_in_year} days...")
        
        print(f"Done! Generated {days_in_year} files in {output_dir}")
        
    else:
        # Generate for today only
        target_date = datetime.now().date()
        result = compute_panchanga(target_date, location)

        if args.pretty:
            print(json.dumps(result, indent=4, ensure_ascii=False))
        else:
            print(json.dumps(result, separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
