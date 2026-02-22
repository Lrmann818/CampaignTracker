#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
verify_script="$script_dir/verify-zip.sh"

output_dir="${1:-$project_root/release}"

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' is required but not installed." >&2
  echo "Install it first, then rerun (Ubuntu/Debian: sudo apt install zip)." >&2
  exit 1
fi

if ! command -v zipinfo >/dev/null 2>&1; then
  echo "Error: 'zipinfo' is required but not installed." >&2
  echo "Install it first (Ubuntu/Debian: sudo apt install unzip)." >&2
  exit 1
fi

mkdir -p "$output_dir"

timestamp="$(date '+%Y%m%d-%H%M')"
zip_name="refactor-export-$timestamp.zip"
zip_path="$output_dir/$zip_name"

(
  cd "$project_root"
  zip -r -q "$zip_path" . \
    -x ".git/*" \
    -x "node_modules/*" \
    -x ".vscode/*" \
    -x "dist/*" \
    -x "*.zip" \
    -x ".DS_Store" \
    -x "*/.DS_Store" \
    -x "Thumbs.db" \
    -x "*/Thumbs.db" \
    -x "__MACOSX/*" \
    -x "*/__MACOSX/*"
)

if [[ ! -f "$verify_script" ]]; then
  echo "Error: Verification script not found: $verify_script" >&2
  exit 1
fi

bash "$verify_script" "$zip_path"
