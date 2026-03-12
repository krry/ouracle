#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: scripts/tag_phase.sh <tag> [message]"
  exit 1
fi

TAG="$1"
MESSAGE="${2:-${TAG}}"

git tag -a "$TAG" -m "$MESSAGE"
echo "Created tag $TAG"
