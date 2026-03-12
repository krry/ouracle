#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: scripts/bump_tui.sh <version>"
  exit 1
fi

VERSION="$1"

if [ ! -f "apps/tui/Cargo.toml" ]; then
  echo "apps/tui/Cargo.toml not found"
  exit 1
fi

perl -0777 -pi -e "s/\\nversion\\s*=\\s*\"[^\"]+\"/\\nversion = \"${VERSION}\"/g" apps/tui/Cargo.toml

echo "TUI version set to ${VERSION}"
