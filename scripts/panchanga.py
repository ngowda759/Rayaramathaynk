#!/usr/bin/env python3

import argparse
import json
from datetime import datetime

from panchang import Location
from panchang.panchang import compute


DEFAULT_LAT = 13.1005
DEFAULT_LON = 77.5963
DEFAULT_TZ = "Asia/Kolkata"


def time_window(window):
    if window is None:
        return None

    return {
        "name": window.name,
        "start": window.start.isoformat() if window.start else None,
        "end": window.end.isoformat() if window.end else None,
        "is_auspicious": window.is_auspicious,
    }


def get_panchanga(date_str, lat, lon, tz):

    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()

    location = Location(
        lat=lat,
        lng=lon,
        tz=tz,
    )

    p = compute(target_date, location)

    return {
        "metadata": {
            "generator": "Rayara Panchanga Engine",
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat(),
        },

        "date": p.date,

        "location": {
            "latitude": lat,
            "longitude": lon,
            "timezone": tz,
        },

        "weekday": {
            "english": p.vara.english,
            "sanskrit": p.vara.name,
            "number": p.vara.number,
        },

        "sun": {
            "sunrise": p.sun.sunrise.isoformat(),
            "sunset": p.sun.sunset.isoformat(),
            "day_duration_hours": round(
                p.sun.day_duration_hours,
                4,
            ),
        },

        "tithi": {
            "number": p.tithi.number,
            "name": p.tithi.name,
            "paksha": p.tithi.paksha.value,
            "start": p.tithi.start.isoformat() if p.tithi.start else None,
            "end": p.tithi.end.isoformat() if p.tithi.end else None,
        },

        "nakshatra": {
            "number": p.nakshatra.number,
            "name": p.nakshatra.name,
            "pada": p.nakshatra.pada,
            "lord": p.nakshatra.lord,
            "start": p.nakshatra.start.isoformat() if p.nakshatra.start else None,
            "end": p.nakshatra.end.isoformat() if p.nakshatra.end else None,
        },

        "yoga": {
            "number": p.yoga.number,
            "name": p.yoga.name,
            "start": p.yoga.start.isoformat() if p.yoga.start else None,
            "end": p.yoga.end.isoformat() if p.yoga.end else None,
        },

        "karana": {
            "number": p.karana.number,
            "name": p.karana.name,
            "start": p.karana.start.isoformat() if p.karana.start else None,
            "end": p.karana.end.isoformat() if p.karana.end else None,
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

        "durmuhurta": [
            time_window(x)
            for x in getattr(p, "durmuhurta", [])
        ],

        "varjyam": [
            time_window(x)
            for x in getattr(p, "varjyam", [])
        ],

        "amrita_kalam": [
            time_window(x)
            for x in getattr(p, "amrita_kalam", [])
        ],
    }


def main():

    parser = argparse.ArgumentParser(
        description="Rayara Panchanga Engine"
    )

    parser.add_argument(
        "--date",
        default=datetime.now().strftime("%Y-%m-%d"),
    )

    parser.add_argument(
        "--lat",
        type=float,
        default=DEFAULT_LAT,
    )

    parser.add_argument(
        "--lon",
        type=float,
        default=DEFAULT_LON,
    )

    parser.add_argument(
        "--tz",
        default=DEFAULT_TZ,
    )

    parser.add_argument(
        "--pretty",
        action="store_true",
    )

    args = parser.parse_args()

    result = get_panchanga(
        args.date,
        args.lat,
        args.lon,
        args.tz,
    )

    if args.pretty:
        print(
            json.dumps(
                result,
                indent=4,
                ensure_ascii=False,
            )
        )
    else:
        print(
            json.dumps(
                result,
                separators=(",", ":"),
                ensure_ascii=False,
            )
        )


if __name__ == "__main__":
    main()
