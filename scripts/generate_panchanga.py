#!/usr/bin/env python3
"""
Panchanga Generator for Rayaramathaynk Temple Website
Generates daily panchanga data for Bangalore location
Uses Swiss Ephemeris for accurate astronomical calculations
"""

import json
from datetime import datetime, timedelta, timezone as dt_timezone
from pathlib import Path
from math import sin, cos, acos, asin, atan2, pi, floor

# Try to import swisseph, otherwise use approximate calculations
try:
    import swisseph as swe
    USE_SWISSEPH = True
except ImportError:
    print("Installing swisseph library...")
    import subprocess
    subprocess.check_call(["pip", "install", "swisseph"])
    import swisseph as swe
    USE_SWISSEPH = True

# Bangalore coordinates (Sri Rayara Matha)
LATITUDE = 13.1005
LONGITUDE = 77.5963
TIMEZONE_OFFSET = 5.5  # IST offset in hours

# Tithi names
TITHI_NAMES = [
    "Shukla Pratipada", "Shukla Dvitiya", "Shukla Tritiya", "Shukla Chaturthi", "Shukla Panchami",
    "Shukla Shashti", "Shukla Saptami", "Shukla Ashtami", "Shukla Navami", "Shukla Dashami",
    "Shukla Ekadashi", "Shukla Dvadashi", "Shukla Trayodashi", "Shukla Chaturdashi", "Poornima",
    "Krishna Pratipada", "Krishna Dvitiya", "Krishna Tritiya", "Krishna Chaturthi", "Krishna Panchami",
    "Krishna Shashti", "Krishna Saptami", "Krishna Ashtami", "Krishna Navami", "Krishna Dashami",
    "Krishna Ekadashi", "Krishna Dvadashi", "Krishna Trayodashi", "Krishna Chaturdashi", "Amavasya"
]

# Nakshatra names
NAKSHATRA_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya",
    "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati",
    "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

# Yoga names
YOGA_NAMES = [
    "Vishkumbha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarman",
    "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Harshana", "Vajra", "Siddhi",
    "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla",
    "Amrita", "Chitra", "Gwrata"
]

# Karana names
KARANA_NAMES = [
    "Bava", "Balava", "Kaulava", "Taitula", "Garija", "Vanij",
    "Vishti", "Shakuni", "Chatushtapa", "Naga"
]

# Masa names (with Vikram Samvat year)
MASA_NAMES = [
    "", "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
    "Ashwin", "Kartika", "Margashirsha", "Paush", "Magha", "Phalguna"
]

# Weekday names
WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
SANSKRIT_WEEKDAY = ["Ravivara", "Somavara", "Mangalavara", "Budhavara", "Guruvara", "Shukravara", "Shanivara"]

def to_julian_day(year, month, day, hour=0, minute=0, second=0):
    """Convert date to Julian Day Number."""
    if month <= 2:
        year -= 1
        month += 12
    A = floor(year / 100)
    B = 2 - A + floor(A / 4)
    JD = floor(365.25 * (year + 4716)) + floor(30.6001 * (month + 1)) + day + hour / 24.0 + B - 1524.5
    return JD

def sun_rise_set(jd, lat, lon, timezone_offset, is_rise=True):
    """Calculate sunrise or sunset time."""
    if USE_SWISSEPH:
        swe.set_sid_mode(swe.SIDM_SIDEREAL)
        flag = swe.RISE_SET if is_rise else swe.RISE_SET
        result = swe.rise_trans(jd, swe.SUN, flag, lat, lon, 0, 0, timezone_offset)
        if result and len(result) > 1:
            return datetime.fromtimestamp(result[1][0] - timezone_offset * 3600, tz=dt_timezone.utc)
    else:
        # Approximate calculation
        jd_start = jd - 0.5 + timezone_offset / 24.0
        n = jd_start - 2451545.0 + 0.0008
        j_star = n - lon / 360.0
        M = (357.5291 + 0.98560028 * j_star) % 360
        C = 1.915 * sin(M * pi / 180) + 0.020 * sin(2 * M * pi / 180)
        lambda_sun = (M + C + 180 + 102.9372) % 360
        decl = asin(sin(lambda_sun * pi / 180) * sin(23.44 * pi / 180)) * 180 / pi
        lat_rad = lat * pi / 180
        decl_rad = decl * pi / 180
        cos_h = (sin(-0.83 * pi / 180) - sin(lat_rad) * sin(decl_rad)) / (cos(lat_rad) * cos(decl_rad))
        if abs(cos_h) > 1:
            return None
        h = acos(cos_h) * 180 / pi
        if is_rise:
            h = -h
        H = (h + lon + 360) % 360
        T = H * 4 / 1440.0
        rise_time = jd_start + T
        day_fraction = rise_time % 1
        hours = int(day_fraction * 24)
        minutes = int((day_fraction * 24 - hours) * 60)
        return datetime(jd_start.year, jd_start.month, jd_start.day, hours, minutes, tzinfo=dt_timezone(dt_timezone(timedelta(hours=timezone_offset)).utcoffset(None)))
    
    # Fallback approximation
    noon = jd + 0.5 - timezone_offset / 24.0
    sunrise_hour = 6.0 + longitude / 15.0
    if is_rise:
        return datetime(year, month, day, int(sunrise_hour), int((sunrise_hour % 1) * 60))
    else:
        sunset_hour = 18.0 + longitude / 15.0
        return datetime(year, month, day, int(sunset_hour), int((sunset_hour % 1) * 60))

def calculate_lunar_position(jd):
    """Calculate lunar longitude for tithi calculation."""
    if USE_SWISSEPH:
        swe.set_sid_mode(swe.SIDM_SIDEREAL)
        result = swe.calc_ut(jd, swe.MOON)
        if result and len(result) > 0:
            return result[0][0]
    # Approximate lunar position
    T = (jd - 2451545.0) / 36525.0
    L0 = 218.3165 + 481267.8813 * T
    l = 134.9634 + 13.064993 * T
    lp = 357.5291 + 0.98560028 * T
    F = 93.2721 + 13.229350 * T
    D = 297.8502 + 445267.1115 * T
    moon_long = L0 + 6.29 * sin(l * pi / 180)
    moon_long += 1.27 * sin((l - 2 * D) * pi / 180)
    moon_long += 0.66 * sin((2 * L0 - l) * pi / 180)
    moon_long += 0.21 * sin(l * pi / 180) * sin(lp * pi / 180)
    moon_long += 0.18 * sin(2 * D * pi / 180)
    return moon_long % 360

def calculate_solar_position(jd):
    """Calculate solar longitude."""
    if USE_SWISSEPH:
        swe.set_sid_mode(swe.SIDM_SIDEREAL)
        result = swe.calc_ut(jd, swe.SUN)
        if result and len(result) > 0:
            return result[0][0]
    # Approximate solar position
    T = (jd - 2451545.0) / 36525.0
    L0 = 280.4665 + 36000.7698 * T
    M = (357.5291 + 0.98560028 * T) % 360
    C = 1.915 * sin(M * pi / 180) + 0.020 * sin(2 * M * pi / 180)
    return (L0 + C) % 360

def get_tithi(jd):
    """Calculate current tithi."""
    moon_long = calculate_lunar_position(jd)
    sun_long = calculate_solar_position(jd)
    lunar_phase = (moon_long - sun_long) % 360
    tithi_number = int(lunar_phase / 12)
    return tithi_number % 30

def get_nakshatra(jd):
    """Calculate current nakshatra."""
    moon_long = calculate_lunar_position(jd)
    nakshatra_number = int(moon_long / 13.3333) % 27
    pada = int((moon_long % 13.3333) / 3.3333) + 1
    return nakshatra_number, pada

def get_yoga(jd):
    """Calculate yoga (lunar-solar combination)."""
    moon_long = calculate_lunar_position(jd)
    sun_long = calculate_solar_position(jd)
    yoga_angle = (moon_long + sun_long) % 360
    yoga_number = int(yoga_angle / 13.3333) % 27
    return yoga_number

def get_karana(jd):
    """Calculate karana (half of tithi)."""
    moon_long = calculate_lunar_position(jd)
    sun_long = calculate_solar_position(jd)
    lunar_phase = (moon_long - sun_long) % 360
    karana_number = int(lunar_phase / 6) % 10
    return karana_number

def get_masa(jd):
    """Calculate masa (lunar month)."""
    moon_long = calculate_lunar_position(jd)
    sun_long = calculate_solar_position(jd)
    # Simplified masa calculation
    luna_sun = (moon_long - sun_long) % 360
    masa_num = int(moon_long / 30) + 1
    return masa_num % 12 + 1

def get_samvatsara(year):
    """Get Vikram Samvat year."""
    v_year = year + 57
    cycle_year = (v_year - 1986) % 60
    SAMVATSARA_NAMES = [
        "Prabhava", "Vibhava", "Shukla", "Pramadi", "Arka", "Vrisha", "Kshiti", "Prithvi",
        "Ayu", "Dhuma", "Vyatipata", "Kshaya", "Naga", "Pingala", "Kshalaka", "Siddhartha",
        "Roudri", "Durmukhi", "Dundubhi", "Dvandvaja", "Kshemi", "Prarthivi", "Vikrama",
        "Vrisha", "Tsitru", "Kshobhya", "Sobra", "Krodhi", "Vishnu", "Paridhavi", "Pramadi",
        "Aananda", "Rakshasa", "Anala", "Parabhava", "Plavanga", "Shubhakrit", "Sobhana",
        "Krodhi", "Vishnu", "Paridhavi", "Pramadi", "Aananda", "Rakshasa", "Anala", "Parabhava",
        "Plavanga", "Shubhakrit", "Sobhana", "Krodhi", "Vishnu", "Paridhavi", "Pramadi",
        "Aananda", "Rakshasa", "Anala", "Parabhava"
    ]
    return SAMVATSARA_NAMES[cycle_year]

def get_rahu_kalam(dt):
    """Calculate Rahukalam."""
    weekday = dt.weekday()
    offsets = {0: 7.5, 1: 5.5, 2: 4.5, 3: 6.5, 4: 2.5, 5: 1.5, 6: 3.5}
    offset_hours = offsets.get(weekday, 7.5)
    start = dt.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=offset_hours)
    end = start + timedelta(hours=1, minutes=30)
    return start, end

def get_yama_gandam(dt):
    """Calculate Yamagandam."""
    weekday = dt.weekday()
    offsets = {0: 4.5, 1: 2.5, 2: 7.5, 3: 5.5, 4: 6.5, 5: 3.5, 6: 1.5}
    offset_hours = offsets.get(weekday, 4.5)
    start = dt.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=offset_hours)
    end = start + timedelta(hours=1, minutes=30)
    return start, end

def get_gulika_kalam(dt):
    """Calculate Gulika Kalam."""
    weekday = dt.weekday()
    offsets = {0: 1.5, 1: 7.5, 2: 5.5, 3: 3.5, 4: 1.5, 5: 6.5, 6: 2.5}
    offset_hours = offsets.get(weekday, 1.5)
    start = dt.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=offset_hours)
    end = start + timedelta(hours=1, minutes=30)
    return start, end

def get_panchanga(date_str: str = None) -> dict:
    """Generate panchanga data for a given date."""
    
    if date_str:
        dt = datetime.fromisoformat(date_str)
    else:
        dt = datetime.utcnow()
    
    # Use IST timezone
    ist = dt_timezone(timedelta(hours=5, minutes=30))
    dt_ist = dt.astimezone(ist)
    
    year = dt_ist.year
    month = dt_ist.month
    day = dt_ist.day
    
    # Calculate Julian Day
    jd = to_julian_day(year, month, day, 12, 0, 0)
    
    # Calculate Tithi, Nakshatra, Yoga, Karana
    tithi_num = get_tithi(jd)
    nakshatra_num, pada = get_nakshatra(jd)
    yoga_num = get_yoga(jd)
    karana_num = get_karana(jd)
    masa_num = get_masa(jd)
    
    # Calculate sunrise/sunset
    sunrise = datetime(year, month, day, 6, 0, tzinfo=ist) + timedelta(hours=0, minutes=2)
    sunset = datetime(year, month, day, 18, 0, tzinfo=ist) + timedelta(hours=46, minutes=0)
    
    # Calculate muhurta times
    day_duration = (sunset - sunrise).total_seconds() / 3600
    muhurta_duration = day_duration / 30  # 30 muhurtas in a day
    
    # Calculate Rahukalam, Yamagandam, Gulika Kalam
    rahu_start, rahu_end = get_rahu_kalam(dt_ist)
    yama_start, yama_end = get_yama_gandam(dt_ist)
    gulika_start, gulika_end = get_gulika_kalam(dt_ist)
    
    # Abhijit Muhurat (approximately 12:00 PM)
    abhijit_start = dt_ist.replace(hour=11, minute=48, second=0, microsecond=0)
    abhijit_end = dt_ist.replace(hour=12, minute=36, second=0, microsecond=0)
    
    # Build the response
    data = {
        "metadata": {
            "generator": "Rayara Panchanga Engine",
            "version": "2.0.0",
            "generated_at": datetime.now(dt_timezone.utc).isoformat(),
            "valid_for": f"{year}-{month:02d}-{day:02d}",
            "timezone": "Asia/Kolkata"
        },
        "date": f"{year}-{month:02d}-{day:02d}",
        "location": {
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "timezone": "Asia/Kolkata"
        },
        "weekday": {
            "english": WEEKDAY_NAMES[dt_ist.weekday()],
            "sanskrit": SANSKRIT_WEEKDAY[dt_ist.weekday()],
            "number": dt_ist.weekday() + 1
        },
        "sun": {
            "sunrise": sunrise.isoformat(),
            "sunset": sunset.isoformat(),
            "day_duration_hours": round(day_duration, 2)
        },
        "tithi": {
            "number": tithi_num + 1,
            "name": TITHI_NAMES[tithi_num],
            "paksha": "Shukla" if tithi_num < 15 else "Krishna",
            "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30",
            "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"
        },
        "nakshatra": {
            "number": nakshatra_num + 1,
            "name": NAKSHATRA_NAMES[nakshatra_num],
            "pada": pada,
            "lord": ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"][nakshatra_num % 9],
            "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30",
            "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"
        },
        "yoga": {
            "number": yoga_num + 1,
            "name": YOGA_NAMES[yoga_num],
            "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30",
            "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"
        },
        "karana": {
            "number": karana_num + 1,
            "name": KARANA_NAMES[karana_num] if karana_num < 7 else KARANA_NAMES[7],
            "start": f"{year}-{month:02d}-{day:02d}T00:00:00+05:30",
            "end": f"{year}-{month:02d}-{day:02d}T23:59:59+05:30"
        },
        "masa": {
            "number": masa_num,
            "name": MASA_NAMES[masa_num],
            "is_adhik": False,
            "paksha": "Shukla" if masa_num <= 6 else "Krishna"
        },
        "samvat": {
            "vikram": year + 57,
            "shaka": year - 78,
            "samvatsara": get_samvatsara(year)
        },
        "rahu_kalam": {
            "name": "Rahu Kalam",
            "start": rahu_start.isoformat(),
            "end": rahu_end.isoformat(),
            "is_auspicious": False
        },
        "yama_gandam": {
            "name": "Yama Gandam",
            "start": yama_start.isoformat(),
            "end": yama_end.isoformat(),
            "is_auspicious": False
        },
        "gulika_kalam": {
            "name": "Gulika Kalam",
            "start": gulika_start.isoformat(),
            "end": gulika_end.isoformat(),
            "is_auspicious": False
        },
        "abhijit_muhurat": {
            "name": "Abhijit Muhurat",
            "start": abhijit_start.isoformat(),
            "end": abhijit_end.isoformat(),
            "is_auspicious": True
        },
        "durmuhurta": [],
        "varjyam": [],
        "amrita_kalam": []
    }
    
    return data

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
    print(f"Yog: {data['yoga']['name']}")
    print(f"Karan: {data['karana']['name']}")

if __name__ == "__main__":
    main()
