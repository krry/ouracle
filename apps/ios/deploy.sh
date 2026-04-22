#!/usr/bin/env bash
# Deploy ouracle to a paired iOS device over the network (no USB required).
# Usage: ./apps/ios/deploy.sh [device-name]
# Default device: Handfill

set -euo pipefail

DEVICE="${1:-Handfill}"
PROJECT="apps/ios/ouracle.xcodeproj"
SCHEME="ouracle"
BUNDLE_ID="ink.kerry.ouracle"
CONFIG="Debug"

cd "$(git rev-parse --show-toplevel)"

echo "▶ building $SCHEME → $DEVICE"
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination "platform=iOS,name=$DEVICE" \
  build 2>&1 | grep -E "error:|BUILD (SUCCEEDED|FAILED)"

APP=$(find ~/Library/Developer/Xcode/DerivedData -name "ouracle.app" \
  -path "*/Debug-iphoneos/*" -not -path "*/Index.noindex/*" -maxdepth 8 2>/dev/null | head -1)

if [[ -z "$APP" ]]; then
  echo "✗ could not find ouracle.app in DerivedData"
  exit 1
fi

echo "▶ installing $APP"
xcrun devicectl device install app \
  --device "$DEVICE" \
  "$APP"

echo "▶ launching $BUNDLE_ID"
if xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID" 2>&1; then
  echo "✓ deployed and launched on $DEVICE"
else
  echo "✓ installed on $DEVICE — unlock the phone to launch"
fi
