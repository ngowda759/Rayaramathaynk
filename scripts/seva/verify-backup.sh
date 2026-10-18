#!/usr/bin/env bash
# Checks one downloaded nightly backup for the owner's restore drill (SETUP-GUIDE section 5, DB 16.1).
#
# Usage: scripts/seva/verify-backup.sh <seva-YYYY-MM-DD.dump.age> <age-identity-file>
#
# 1. When the .sha256 file from the same artifact sits next to the backup, the checksum must match.
# 2. The whole file is decrypted with age -d -i (age authenticates every chunk, so a damaged, truncated or
#    wrongly keyed file fails) and the archive's table of contents is read with pg_restore --list.
# Prints only counts. The decrypted dump flows only through a pipe; nothing decrypted is written to disk.
# Needs age and pg_restore (the server's major version or newer) on PATH; works in Git Bash on Windows.
set -euo pipefail

fail() {
  printf 'verify-backup: %s\n' "$1" >&2
  exit 1
}

if [ "$#" -ne 2 ]; then
  printf 'Usage: scripts/seva/verify-backup.sh <seva-YYYY-MM-DD.dump.age> <age-identity-file>\n' >&2
  exit 2
fi

backup="$1"
identity="$2"
case "$backup" in
  -*) backup="./$backup" ;;
esac
case "$identity" in
  -*) identity="./$identity" ;;
esac
[ -f "$backup" ] || fail "backup file not found: $backup"
[ -f "$identity" ] || fail 'age identity (key) file not found.'

for tool in age pg_restore; do
  command -v "$tool" > /dev/null 2>&1 || fail "$tool is not on PATH."
done

checksum_file="${backup}.sha256"
if [ -f "$checksum_file" ]; then
  command -v sha256sum > /dev/null 2>&1 || fail 'sha256sum is not on PATH.'
  expected="$(cut -d ' ' -f 1 < "$checksum_file" | tr -d '[:space:]')"
  actual="$(sha256sum -- "$backup" | cut -d ' ' -f 1 | tr -d '\\')"
  [ "$expected" = "$actual" ] || fail 'the checksum does not match the .sha256 file. Download the artifact again.'
  checksum='matches the .sha256 file'
else
  checksum='not checked (no .sha256 file next to the backup)'
fi

# pg_restore --list stops after the table of contents; cat then drains the rest so age decrypts (and so
# authenticates) the whole file, and pipefail reports a failure from either side.
if ! listing="$(age -d -i "$identity" "$backup" | { pg_restore --list && rc=0 || rc=$?; cat > /dev/null; exit "$rc"; })"; then
  fail 'could not decrypt or read the backup. Check that this is the right key file and that the download is complete.'
fi

printf '%s\n' "$listing" | awk -v checksum="$checksum" '
  /^[0-9]+;/ {
    entries++
    entry = $0
    sub(/^[0-9]+; [0-9]+ [0-9]+ /, "", entry)
    if (entry ~ /^TABLE DATA /) data++
    else if (entry ~ /^TABLE /) tables++
    else if (entry ~ /^SEQUENCE SET /) sequence_values++
    else if (entry ~ /^SEQUENCE /) sequences++
    else if (entry ~ /^SCHEMA /) schemas++
    else if (entry ~ /^FUNCTION /) functions++
    else if (entry ~ /^INDEX /) indexes++
    else if (entry ~ /^TRIGGER /) triggers++
    else if (entry ~ /^POLICY /) policies++
  }
  END {
    printf "Checksum: %s\n", checksum
    printf "Decryption: ok (whole file)\n"
    printf "Archive entries: %d\n", entries
    printf "Schemas: %d\n", schemas
    printf "Tables: %d\n", tables
    printf "Table data sections: %d\n", data
    printf "Sequences: %d (with %d saved values)\n", sequences, sequence_values
    printf "Functions: %d\n", functions
    printf "Indexes: %d\n", indexes
    printf "Triggers: %d\n", triggers
    printf "Row-level security policies: %d\n", policies
    if (tables == 0) exit 1
  }
' || fail 'the archive lists no tables.'
