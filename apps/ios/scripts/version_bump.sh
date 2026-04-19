#!/bin/bash
# Usage: ./scripts/version_bump.sh [build|patch|minor|major]
#
# Versioning strategy (from apps/ios/.claude/CLAUDE.md):
#   CURRENT_PROJECT_VERSION — internal build number; bump for every archive/uploaded build.
#   MARKETING_VERSION       — user-facing; bump only when starting a new release line.
#
# Modes:
#   build   — bump build number only (normal iteration on one release line)
#   patch   — bump MARKETING_VERSION patch + build  (e.g. 0.6.1 → 0.6.2, build++)
#   minor   — bump MARKETING_VERSION minor, reset patch + build  (e.g. 0.6.x → 0.7, build++)
#   major   — bump MARKETING_VERSION major, reset minor/patch + build  (e.g. 0.x → 1.0, build++)
#
# Default: build

set -euo pipefail

BUMP_TYPE=${1:-build}
PBXPROJ="$(dirname "$0")/../souvenir.xcodeproj/project.pbxproj"

if [[ ! -f "$PBXPROJ" ]]; then
  echo "❌ project.pbxproj not found at: $PBXPROJ"
  exit 1
fi

# Read current values (all occurrences are identical; grab the first)
CURRENT_BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' "$PBXPROJ" | sed 's/.*= \([0-9]*\);/\1/')
CURRENT_MARKETING=$(grep -m1 'MARKETING_VERSION' "$PBXPROJ" | sed 's/.*= \([^;]*\);/\1/')

IFS='.' read -r -a MV <<< "$CURRENT_MARKETING"
MAJOR=${MV[0]:-0}
MINOR=${MV[1]:-0}
PATCH=${MV[2]:-0}

NEW_BUILD=$((CURRENT_BUILD + 1))

case $BUMP_TYPE in
  build)
    NEW_MARKETING="$CURRENT_MARKETING"
    ;;
  patch)
    PATCH=$((PATCH + 1))
    NEW_MARKETING="$MAJOR.$MINOR.$PATCH"
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    NEW_MARKETING="$MAJOR.$MINOR"
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    NEW_MARKETING="$MAJOR.0"
    ;;
  *)
    echo "❌ Invalid bump type: $BUMP_TYPE"
    echo "Usage: $(basename "$0") [build|patch|minor|major]"
    exit 1
    ;;
esac

echo "📦 Souvenir Version Bump"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Marketing:  $CURRENT_MARKETING → $NEW_MARKETING"
echo "Build:      $CURRENT_BUILD → $NEW_BUILD"
echo ""

read -p "Apply? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cancelled"
  exit 0
fi

# Replace all occurrences of both keys in the pbxproj
sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT_BUILD;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/g" "$PBXPROJ"
sed -i '' "s/MARKETING_VERSION = $CURRENT_MARKETING;/MARKETING_VERSION = $NEW_MARKETING;/g" "$PBXPROJ"

echo "✅ project.pbxproj updated"
echo ""

read -p "Commit + tag? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  cd "$(dirname "$0")/../../.."
  git add apps/ios/souvenir.xcodeproj/project.pbxproj
  git commit -m "chore(ios): bump version to $NEW_MARKETING (build $NEW_BUILD)

Co-Authored-By: the Orphics <orfx@agentmail.to>"

  # Always tag the build number for precise archive traceability
  git tag -a "ios/b$NEW_BUILD" -m "souvenir build $NEW_BUILD ($NEW_MARKETING)"

  # On a marketing version bump, also tag the release line
  if [[ "$BUMP_TYPE" != "build" ]]; then
    git tag -a "ios/v$NEW_MARKETING" -m "souvenir $NEW_MARKETING (build $NEW_BUILD)"
  fi

  echo "✅ Committed + tagged"
  echo ""
  echo "Tags created:"
  echo "  ios/b$NEW_BUILD"
  [[ "$BUMP_TYPE" != "build" ]] && echo "  ios/v$NEW_MARKETING"
  echo ""
  echo "Push tags:  git push origin --tags"
fi
