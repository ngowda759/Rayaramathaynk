#!/usr/bin/env python3

import argparse
import json
from calendar import isleap
from datetime import date, timedelta
from pathlib import Path

from panchanga import get_panchanga

DEFAULT_LAT = 13.1005
DEFAULT_LON = 77.5963
DEFAULT_TZ = "Asia/Kolkata"


def generate_year(year, lat, lon, tz, output_dir):

    start = date(year, 1, 1)
    end = date(year, 12, 31)

    current = start

    out = Path(output_dir) / str(year)
    out.mkdir(parents=True, exist_ok=True)

    total = 366 if isleap(year) else 365

    print(f"Generating {total} Panchanga files...")

    while current <= end:

        data = get_panchanga(
            current.isoformat(),
            lat,
            lon,
            tz,
        )

        outfile = out / f"{current.isoformat()}.json"

        with open(outfile, "w", encoding="utf-8") as fp:
            json.dump(
                data,
                fp,
                indent=4,
                ensure_ascii=False,
            )

        print(outfile.name)

        current += timedelta(days=1)

    print()
    print("Done.")


def main():

    parser = argparse.ArgumentParser(
        description="Generate Panchanga Calendar"
    )

    parser.add_argument(
        "--year",
        type=int,
        required=True,
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
        "--output",
        default="data/panchanga",
    )

    args = parser.parse_args()

    generate_year(
        args.year,
        args.lat,
        args.lon,
        args.tz,
        args.output,
    )


if __name__ == "__main__":
    main()
