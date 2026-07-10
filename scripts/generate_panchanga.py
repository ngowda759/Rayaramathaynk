#!/usr/bin/env python3
"""
Generate panchanga JSON file
Called by GitHub Actions workflow
Runs panchanga.py and saves output to public/data/panchanga/current.json
"""

import json
import subprocess
import sys
from pathlib import Path

def main():
    output_path = Path(__file__).parent.parent / "public" / "data" / "panchanga" / "current.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Run panchanga.py (no --pretty flag, just compact JSON)
    try:
        result = subprocess.run(
            [sys.executable, str(Path(__file__).parent / "panchanga.py")],
            capture_output=True,
            text=True,
            check=True
        )
        # panchanga.py outputs compact JSON, parse and re-save with formatting
        data = json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running panchanga.py: {e.stderr}")
        sys.exit(1)
    
    # Save formatted JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Generated: {output_path}")
    print(f"Date: {data['date']}")
    print(f"Tithi: {data['tithi']['name']}")
    print(f"Nakshatra: {data['nakshatra']['name']}")

if __name__ == "__main__":
    main()
