#!/usr/bin/env python3
"""
Panchanga Generator for Rayaramathaynk Temple Website
Generates daily panchanga data for Bangalore location
"""

import json
from datetime import datetime, timezone
from pathlib import Path

try:
    from panchang import Panchang, Coordinate, Timezone
except ImportError:
    print("Installing panchang library...")
    import subprocess
    subprocess.check_call(["pip", "install", "panchang"])
    from panchang import Panchang, Coordinate, Timezone


# Bangalore coordinates
LATITUDE = 13.1005
LONGITUDE = 77.5963

def get_panchanga(date_str: str = None) -> dict:
    """Generate panchanga data for a given date."""
    
    if date_str:
        dt = datetime.fromisoformat(date_str)
    else:
        dt = datetime.now(timezone.utc)
    
    # Create timezone object for Asia/Kolkata
    tz = Timezone("Asia/Kolkata")
    
    # Create coordinate for Bangalore
    coord = Coordinate(LATITUDE, LONGITUDE)
    
    # Initialize Panchang
    p = Panchang(dt, coord, tz)
    
    # Build the response
    data = {
        "metadata": {
            "generator": "Rayara Panchanga Engine",
            "version": "1.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "valid_for": dt.strftime("%Y-%m-%d"),
            "timezone": "Asia/Kolkata"
        },
        "date": dt.strftime("%Y-%m-%d"),
        "location": {
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "timezone": "Asia/Kolkata"
        },
        "weekday": {
            "english": dt.strftime("%A"),
            "sanskrit": get_sanskrit_weekday(dt.weekday()),
            "number": dt.weekday() + 1
        },
        "sun": {
            "sunrise": p.sunrise.isoformat() if p.sunrise else None,
            "sunset": p.sunset.isoformat() if p.sunset else None,
            "day_duration_hours": round((p.sunset - p.sunrise).total_seconds() / 3600, 4) if p.sunrise and p.sunset else 0
        },
        "tithi": {
            "number": p.tithi.number if p.tithi else 0,
            "name": p.tithi.name if p.tithi else "",
            "paksha": "Shukla" if (p.tithi.number if p.tithi else 0) <= 15 else "Krishna",
            "start": p.tithi.start.isoformat() if p.tithi and p.tithi.start else None,
            "end": p.tithi.end.isoformat() if p.tithi and p.tithi.end else None
        },
        "nakshatra": {
            "number": p.nakshatra.number if p.nakshatra else 0,
            "name": p.nakshatra.name if p.nakshatra else "",
            "pada": p.nakshatra.pada if p.nakshatra else 0,
            "lord": get_nakshatra_lord(p.nakshatra.number if p.nakshatra else 0),
            "start": p.nakshatra.start.isoformat() if p.nakshatra and p.nakshatra.start else None,
            "end": p.nakshatra.end.isoformat() if p.nakshatra and p.nakshatra.end else None
        },
        "yoga": {
            "number": p.yoga.number if p.yoga else 0,
            "name": p.yoga.name if p.yoga else "",
            "start": p.yoga.start.isoformat() if p.yoga and p.yoga.start else None,
            "end": p.yoga.end.isoformat() if p.yoga and p.yoga.end else None
        },
        "karana": {
            "number": p.karana.number if p.karana else 0,
            "name": p.karana.name if p.karana else "",
            "start": p.karana.start.isoformat() if p.karana and p.karana.start else None,
            "end": p.karana.end.isoformat() if p.karana and p.karana.end else None
        },
        "masa": {
            "number": p.masa.number if p.masa else 0,
            "name": p.masa.name if p.masa else "",
            "is_adhik": p.masa.is_adhik if p.masa else False,
            "paksha": "Shukla" if (p.masa.number if p.masa else 0) <= 6 else "Krishna"
        },
        "samvat": {
            "vikram": dt.year + 57,  # Vikram Samvat
            "shaka": dt.year - 78,   # Shaka Samvat
            "samvatsara": get_samvatsara((dt.year - 2000) % 60)
        },
        "rahu_kalam": get_rahu_kalam(dt, tz),
        "yama_gandam": get_yama_gandam(dt, tz),
        "gulika_kalam": get_gulika_kalam(dt, tz),
        "abhijit_muhurat": get_abhijit_muhurat(p),
        "durmuhurta": [],
        "varjyam": [],
        "amrita_kalam": []
    }
    
    return data


def get_sanskrit_weekday(weekday: int) -> str:
    """Get Sanskrit name for weekday."""
    names = [
        "Ravivara",   # Sunday
        "Somavera",   # Monday
        "Budhavara",  # Tuesday
        "Guruva",     # Wednesday
        "Sukravara",  # Thursday
        "Sanivara",   # Friday
        "Sanivara"    # Saturday (some traditions)
    ]
    return names[weekday] if 0 <= weekday < len(names) else names[0]


def get_nakshatra_lord(nakshatra_num: int) -> str:
    """Get the ruling planet of a nakshatra."""
    lords = {
        1: "Ketu", 2: "Venus", 3: "Sun", 4: "Moon", 5: "Mars",
        6: "Rahu", 7: "Jupiter", 8: "Saturn", 9: "Mercury",
        10: "Ketu", 11: "Venus", 12: "Sun", 13: "Moon", 14: "Mars",
        15: "Rahu", 16: "Jupiter", 17: "Saturn", 18: "Mercury",
        19: "Ketu", 20: "Venus", 21: "Sun", 22: "Moon", 23: "Mars",
        24: "Rahu", 25: "Jupiter", 26: "Saturn", 27: "Mercury"
    }
    return lords.get(nakshatra_num, "Unknown")


def get_samvatsara(year_offset: int) -> str:
    """Get the name of the Samvatsara (60-year cycle)."""
    names = [
        "Prabhava", "Vibhava", "Shukla", "Pramadi", "Arka",
        "Vrisha", "Kshiti", "Prithvi", "Ayu", "Dhuma",
        "Vyatipata", "Kshaya", "Naga", "Pingala", "Kshalaka",
        "Siddhartha", "Roudri", "Durmukhi", "Dundubhi", "Dvandvaja",
        "Kshemi", "Prarthivi", "Vikrama", "Vrisha", "Tsitru",
        "Kshobhya", "Sobra", "Krodhi", "Vishnu", "Paridhavi",
        "Pramadi", "Aananda", "Rakshasa", "Anala", "Parabhava",
        "Plavanga", "Shubhakrit", "Sobhana", "Krodhi", "Vishnu",
        "Paridhavi", "Pramadi", "Aananda", "Rakshasa", "Anala",
        "Parabhava", "Plavanga", "Shubhakrit", "Sobhana", "Krodhi",
        "Vishnu", "Paridhavi", "Pramadi", "Aananda", "Rakshasa"
    ]
    return names[year_offset % 60]


def get_rahu_kalam(dt, tz) -> dict:
    """Calculate Rahukalam for the day."""
    weekday = dt.weekday()
    # Rahukalam varies by day of week
    offsets = {0: 7.5, 1: 5.5, 2: 4.5, 3: 6.5, 4: 2.5, 5: 1.5, 6: 3.5}
    offset_hours = offsets.get(weekday, 7.5)
    
    from datetime import timedelta
    sunrise = datetime.combine(dt.date(), datetime.min.time())
    start = sunrise + timedelta(hours=offset_hours)
    end = start + timedelta(hours=1.5)
    
    return {
        "name": "Rahu Kalam",
        "start": start.replace(tzinfo=tz).isoformat(),
        "end": end.replace(tzinfo=tz).isoformat(),
        "is_auspicious": False
    }


def get_yama_gandam(dt, tz) -> dict:
    """Calculate Yamagandam for the day."""
    weekday = dt.weekday()
    offsets = {0: 4.5, 1: 2.5, 2: 7.5, 3: 5.5, 4: 6.5, 5: 3.5, 6: 1.5}
    offset_hours = offsets.get(weekday, 4.5)
    
    from datetime import timedelta
    sunrise = datetime.combine(dt.date(), datetime.min.time())
    start = sunrise + timedelta(hours=offset_hours)
    end = start + timedelta(hours=1.5)
    
    return {
        "name": "Yama Gandam",
        "start": start.replace(tzinfo=tz).isoformat(),
        "end": end.replace(tzinfo=tz).isoformat(),
        "is_auspicious": False
    }


def get_gulika_kalam(dt, tz) -> dict:
    """Calculate Gulika Kalam for the day."""
    weekday = dt.weekday()
    offsets = {0: 1.5, 1: 7.5, 2: 5.5, 3: 3.5, 4: 1.5, 5: 6.5, 6: 2.5}
    offset_hours = offsets.get(weekday, 1.5)
    
    from datetime import timedelta
    sunrise = datetime.combine(dt.date(), datetime.min.time())
    start = sunrise + timedelta(hours=offset_hours)
    end = start + timedelta(hours=1.5)
    
    return {
        "name": "Gulika Kalam",
        "start": start.replace(tzinfo=tz).isoformat(),
        "end": end.replace(tzinfo=tz).isoformat(),
        "is_auspicious": False
    }


def get_abhijit_muhurat(p) -> dict:
    """Get Abhijit Muhurat if available."""
    # Abhijit Muhurat is typically 11:48 AM - 12:36 PM
    from datetime import timedelta
    if p.sunrise:
        # Abhijit is approximately in the middle of the day
        noon = p.sunrise + timedelta(hours=6)
        start = noon - timedelta(minutes=24)
        end = noon + timedelta(minutes=24)
        
        return {
            "name": "Abhijit Muhurat",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "is_auspicious": True
        }
    return {
        "name": "Abhijit Muhurat",
        "start": None,
        "end": None,
        "is_auspicious": True
    }


def main():
    """Main function to generate and save panchanga data."""
    output_path = Path(__file__).parent.parent / "public" / "data" / "panchanga" / "current.json"
    
    # Ensure directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Generate data for today
    data = get_panchanga()
    
    # Write to file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Generated panchanga data for {data['date']}")
    print(f"Saved to: {output_path}")
    print(f"Tithi: {data['tithi']['name']}")
    print(f"Nakshatra: {data['nakshatra']['name']}")


if __name__ == "__main__":
    main()
