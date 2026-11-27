#!/usr/bin/env python3
"""
Generate one day of Panchanga JSON.

Called by the GitHub Actions workflow. The output path is explicit so the
workflow never modifies a tracked static file.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one day of Panchanga JSON")
    parser.add_argument(
        "--date",
        default=None,
        help="YYYY-MM-DD (default: today in the runner timezone)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output file path (default: artifacts/panchanga/YYYY-MM-DD.json)",
    )
    args = parser.parse_args()

    target_date = args.date or datetime.now().strftime("%Y-%m-%d")
    output_path = (
        Path(args.output)
        if args.output
        else Path(__file__).parent.parent / "artifacts" / "panchanga" / f"{target_date}.json"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    command = [sys.executable, str(Path(__file__).parent / "panchanga.py")]
    if args.date:
        command.extend(["--date", args.date])

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running panchanga.py: {e.stderr}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"panchanga.py did not emit valid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    if data.get("date") != target_date:
        print(
            f"Refusing to write: generated date {data.get('date')!r} does not match expected {target_date!r}",
            file=sys.stderr,
        )
        sys.exit(1)

    valid_for = data.get("metadata", {}).get("valid_for")
    if valid_for != data.get("date"):
        print(
            f"Refusing to write: metadata.valid_for {valid_for!r} does not match date {data.get('date')!r}",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Generated: {output_path}")
    print(f"Date: {data['date']}")
    print(f"Tithi: {data['tithi']['name']}")
    print(f"Nakshatra: {data['nakshatra']['name']}")


if __name__ == "__main__":
    main()
