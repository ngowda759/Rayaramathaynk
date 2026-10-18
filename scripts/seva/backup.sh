#!/usr/bin/env bash
# Nightly encrypted backup of the whole Supabase database (DB 16.1, D9, C-57, C-64).
# Run by .github/workflows/seva-backup.yml; it can also be run by hand from a machine with pg_dump and age.
#
# Usage:
#   scripts/seva/backup.sh [output-dir]      dump, encrypt and checksum (default output dir: ./seva-backup)
#   scripts/seva/backup.sh --check-db-url    only check that SEVA_BACKUP_DB_URL is well formed
#   scripts/seva/backup.sh --check-recipient only check that SEVA_BACKUP_AGE_RECIPIENT is an age public key
#
# Reads two values from the environment (repository secrets the workflow passes through env:):
#   SEVA_BACKUP_DB_URL         Supabase *session* pooler connection string, port 5432
#                              (the transaction pooler on port 6543 cannot run pg_dump)
#   SEVA_BACKUP_AGE_RECIPIENT  the age public key (age1...); the private key stays offline with the owner (O-15)
#
# Writes <output-dir>/seva-<YYYY-MM-DD>.dump.age (IST date) and <same name>.sha256 (sha256sum format).
# The plain dump exists only inside the pipe from pg_dump to age; it never touches the disk.
# Prints only the file name, its size and its checksum - never the connection string or the key, and shell
# tracing must stay off in this file. The checks below refuse a malformed connection string before any client
# sees it, because libpq quotes the part it cannot parse in its error message, and that part can be the password.
# Under GitHub Actions it also writes step outputs: file, sha256_file, bytes, sha256, date, month, first_of_month,
# and failed_stage when it stops early.
set -euo pipefail
umask 077

: "${PGSSLMODE:=require}"
: "${PGCONNECT_TIMEOUT:=30}"
: "${PGAPPNAME:=seva-backup}"
export PGSSLMODE PGCONNECT_TIMEOUT PGAPPNAME

stage='check'
part=''
recipient=''

on_exit() {
  local rc=$?
  if [ -n "$part" ]; then
    rm -f -- "$part"
  fi
  if [ "$rc" -ne 0 ] && [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'failed_stage=%s\n' "$stage" >> "$GITHUB_OUTPUT"
  fi
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
  printf 'backup: %s\n' "$1" >&2
  exit 1
}

usage() {
  sed -n '5,8p' "$0" | sed 's/^# //'
}

check_db_url() {
  local url="${SEVA_BACKUP_DB_URL:-}"
  local malformed='SEVA_BACKUP_DB_URL is not a well-formed connection string. Copy the session pooler string from Supabase, keep it on one line, and percent-encode special characters in the password (@ as %40, / as %2F, % as %25).'
  if [ -z "$url" ]; then
    fail 'SEVA_BACKUP_DB_URL is not set.'
  fi
  case "$url" in
    postgres://* | postgresql://*) ;;
    *) fail 'SEVA_BACKUP_DB_URL must start with postgresql:// (the Supabase session pooler string).' ;;
  esac
  case "$url" in
    *[[:space:]]*) fail "$malformed" ;;
  esac
  local rest="${url#*://}"
  local authority="${rest%%/*}"
  local after="${rest#"$authority"}"
  # Exactly one @, between the password and the host; a raw @ or / inside the password breaks this.
  case "$authority" in
    *@*@*) fail "$malformed" ;;
    ?*@?*) ;;
    *) fail "$malformed" ;;
  esac
  case "$after" in
    *@*) fail "$malformed" ;;
  esac
  # Every % must start a %XX escape.
  local unescaped="${url//\%[0-9A-Fa-f][0-9A-Fa-f]/}"
  case "$unescaped" in
    *%*) fail "$malformed" ;;
  esac
  case "${authority##*@}" in
    *:6543) fail 'SEVA_BACKUP_DB_URL uses port 6543, the transaction pooler, which cannot run pg_dump. Use the session pooler string (port 5432).' ;;
  esac
}

check_recipient() {
  local value="${SEVA_BACKUP_AGE_RECIPIENT:-}"
  local wrong='SEVA_BACKUP_AGE_RECIPIENT must be the age public key: one line that starts with age1. The private key never goes into GitHub.'
  value="${value//[[:space:]]/}"
  if [ -z "$value" ]; then
    fail 'SEVA_BACKUP_AGE_RECIPIENT is not set.'
  fi
  # age public keys are lower-case bech32 after the age1 prefix.
  case "$value" in
    *[!0-9a-z]*) fail "$wrong" ;;
    age1?*) ;;
    *) fail "$wrong" ;;
  esac
  recipient="$value"
}

backup() {
  local out_dir="${1:-seva-backup}"

  check_db_url
  check_recipient

  stage='tools'
  local tool
  for tool in psql pg_dump age sha256sum; do
    command -v "$tool" > /dev/null 2>&1 || fail "$tool is not on PATH."
  done

  # pg_dump refuses a newer server, and a newer pg_dump writes archives an older pg_restore cannot read.
  stage='version'
  local server_num server_major client_major
  server_num="$(psql "$SEVA_BACKUP_DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 -c 'show server_version_num')"
  case "$server_num" in
    '' | *[!0-9]*) fail 'could not read the database server version.' ;;
  esac
  server_major=$((server_num / 10000))
  client_major="$(pg_dump --version | sed -E 's/^[^0-9]*([0-9]+).*$/\1/')"
  if [ "$client_major" != "$server_major" ]; then
    fail "pg_dump is version ${client_major} but the server is ${server_major}; install postgresql-client-${server_major}."
  fi

  # One clock reading names the file, the month and the 1st, all in IST. Without a time zone database the zone name
  # silently falls back to UTC, which would date the 21:00 UTC run a day early, so the offset is checked.
  stage='dump'
  local reading stamp month first_of_month name file
  reading="$(TZ=Asia/Kolkata date '+%Y-%m-%d %z')"
  if [ "${reading#* }" != '+0530' ]; then
    fail 'the Asia/Kolkata time zone is not available here (install tzdata).'
  fi
  stamp="${reading% *}"
  month="${stamp%-*}"
  if [ "${stamp##*-}" = '01' ]; then
    first_of_month='true'
  else
    first_of_month='false'
  fi
  mkdir -p -- "$out_dir"
  name="seva-${stamp}.dump.age"
  file="${out_dir%/}/${name}"
  part="${file}.part"

  pg_dump --format=custom --no-owner --no-privileges "$SEVA_BACKUP_DB_URL" \
    | age -r "$recipient" > "$part"

  if [ ! -s "$part" ]; then
    fail 'the encrypted backup is empty.'
  fi
  mv -f -- "$part" "$file"
  part=''

  stage='checksum'
  local bytes sha
  bytes="$(wc -c < "$file" | tr -d '[:space:]')"
  sha="$(sha256sum -- "$file" | cut -d ' ' -f 1)"
  printf '%s  %s\n' "$sha" "$name" > "${file}.sha256"

  printf 'Backup written: %s (%s bytes, sha256 %s)\n' "$name" "$bytes" "$sha"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
      printf 'file=%s\n' "$file"
      printf 'sha256_file=%s\n' "${file}.sha256"
      printf 'bytes=%s\n' "$bytes"
      printf 'sha256=%s\n' "$sha"
      printf 'date=%s\n' "$stamp"
      printf 'month=%s\n' "$month"
      printf 'first_of_month=%s\n' "$first_of_month"
    } >> "$GITHUB_OUTPUT"
  fi
  stage='done'
}

case "${1:-}" in
  --check-db-url)
    check_db_url
    printf 'The database connection string is well formed.\n'
    ;;
  --check-recipient)
    check_recipient
    printf 'The age public key is well formed.\n'
    ;;
  -h | --help)
    usage
    ;;
  -*)
    usage >&2
    exit 2
    ;;
  *)
    backup "${1:-}"
    ;;
esac
