#!/usr/bin/env python3

import json
from datetime import datetime
from pathlib import Path

from panchanga import get_panchanga
ROOT = Path(__file__).resolve().parent.parent

LAT = 13.1005
LON = 77.5963
TZ = "Asia/Kolkata"

today = datetime.now().strftime("%Y-%m-%d")

data = get_panchanga(
    today,
    LAT,
    LON,
    TZ,
)

output_dir = ROOT / "public" / "data" / "panchanga"
output_dir.mkdir(parents=True, exist_ok=True)

output_file = output_dir / "current.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(
        data,
        f,
        indent=2,
        ensure_ascii=False,
    )

print(f"Generated {output_file}")
