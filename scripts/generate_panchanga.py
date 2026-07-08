#!/usr/bin/env python3
"""
Generate panchanga using panchang library
Saves output to public/data/panchanga/current.json
"""

import json
import subprocess
import sys
from pathlib import Path

def main():
    # Run panchanga.py and capture output
    try:
        result = subprocess.run(
            [sys.executable, "scripts/panchanga.py"],
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running panchanga.py: {e.stderr}")
        sys.exit(1)
    
    # Save to output file
    output_path = Path(__file__).parent.parent / "public" / "data" / "panchanga" / "current.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Panchanga for {data['date']}: {data['tithi']['name']}, {data['nakshatra']['name']}")
    print(f"Saved: {output_path}")

if __name__ == "__main__":
    main()
