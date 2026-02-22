#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/verify-zip.sh <zip-path>" >&2
  exit 1
fi

zip_path="$1"

if ! command -v unzip >/dev/null 2>&1; then
  echo "Error: 'unzip' is required but not installed." >&2
  echo "Install it first, then rerun (Ubuntu/Debian: sudo apt install unzip)." >&2
  exit 1
fi

if [[ ! -f "$zip_path" ]]; then
  echo "Error: Zip file not found: $zip_path" >&2
  exit 1
fi

if ! command -v zipinfo >/dev/null 2>&1; then
  echo "Error: 'zipinfo' is required but not installed." >&2
  echo "Install it first (Ubuntu/Debian: sudo apt install unzip)." >&2
  exit 1
fi

mapfile -t entries < <(zipinfo -1 "$zip_path")

offending_entries=()
for entry in "${entries[@]}"; do
  normalized="${entry#./}"
  normalized="${normalized#/}"
  lower="$(printf '%s' "$normalized" | tr '[:upper:]' '[:lower:]')"
  lower_trimmed="${lower%/}"

  if [[ "$lower" == .git/* || "$lower_trimmed" == ".git" ]]; then
    offending_entries+=("$entry")
    continue
  fi
  if [[ "$lower" == node_modules/* || "$lower_trimmed" == "node_modules" ]]; then
    offending_entries+=("$entry")
    continue
  fi
  if [[ "$lower" == .vscode/* || "$lower_trimmed" == ".vscode" ]]; then
    offending_entries+=("$entry")
    continue
  fi
  if [[ "$lower" == dist/* || "$lower_trimmed" == "dist" ]]; then
    offending_entries+=("$entry")
    continue
  fi
done

if [[ ${#offending_entries[@]} -gt 0 ]]; then
  echo "Release zip verification failed. Banned entries found:" >&2
  for entry in "${offending_entries[@]}"; do
    echo " - $entry" >&2
  done
  exit 1
fi

echo "Release zip is clean"
echo "$zip_path"
