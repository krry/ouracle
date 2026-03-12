#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: scripts/bump_api.sh <version>"
  exit 1
fi

VERSION="$1"

if [ ! -f "api/package.json" ]; then
  echo "api/package.json not found"
  exit 1
fi

if [ ! -f "api/index.js" ]; then
  echo "api/index.js not found"
  exit 1
fi

perl -0777 -pi -e "s/\"version\"\\s*:\\s*\"[^\"]+\"/\"version\": \"${VERSION}\"/g" api/package.json
perl -0777 -pi -e "s/(version:\\s*')([^']+)(')/\${1}${VERSION}\${3}/g" api/index.js

echo "API version set to ${VERSION}"
