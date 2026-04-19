#!/usr/bin/env bash
# fix-webrtc-headers.sh
#
# stasel/WebRTC v125+ ships prebuilt XCFramework headers that use Google's
# internal source-tree import paths (e.g. `sdk/objc/base/RTCMacros.h`).
# Xcode 16's dependency scanner hits these before compilation and fails.
#
# This script rewrites the broken relative imports to flat framework-style
# imports and removes the `module * { export * }` directive that causes
# Clang to auto-scan every header for submodules.
#
# Patches two locations:
#   1. SourcePackages/artifacts — the canonical source
#   2. $BUILT_PRODUCTS_DIR/WebRTC.framework — Xcode's copied version,
#      which Clang actually compiles against during the build
#
# Run automatically as an Xcode Build Phase before "Compile Sources".
# Safe to run repeatedly — idempotent per location.

set -euo pipefail

patch_framework() {
  local fw="$1"
  [ -d "$fw" ] || return 0

  local marker="$fw/.headers-patched"
  if [ -f "$marker" ]; then
    echo "fix-webrtc-headers: already patched — $fw"
    return 0
  fi

  echo "fix-webrtc-headers: patching $fw"

  # 1. Rewrite broken relative imports: `sdk/objc/path/to/Foo.h` → `Foo.h`
  find "$fw" -name "*.h" | while read -r header; do
    if grep -q "sdk/objc" "$header" 2>/dev/null; then
      perl -i -pe 's|#import "sdk/objc/[^"]+/([^/"]+\.h)"|#import "\1"|g' "$header"
    fi
  done

  # 2. Replace module map so Clang doesn't auto-scan every header
  find "$fw" -name "module.modulemap" | while read -r mmap; do
    cat > "$mmap" <<'MODULEMAP'
framework module WebRTC {
  header "WebRTC.h"
  export *
}
MODULEMAP
  done

  touch "$marker"
  echo "fix-webrtc-headers: done — $fw"
}

# --- Location 1: BUILT_PRODUCTS_DIR (what Clang actually compiles against) ---
patch_framework "$BUILT_PRODUCTS_DIR/WebRTC.framework"

# --- Location 2: SourcePackages/artifacts (the canonical source copy) ---
# Walk up from BUILD_DIR until we find a directory containing SourcePackages.
DERIVED_ROOT=""
search="$BUILD_DIR"
for _ in 1 2 3 4 5; do
  search="$(cd "$search/.." && pwd)"
  if [ -d "$search/SourcePackages" ]; then
    DERIVED_ROOT="$search"
    break
  fi
done

# Fallback: known Xcode Cloud path
if [ -z "$DERIVED_ROOT" ] && [ -d "/Volumes/workspace/DerivedData/SourcePackages" ]; then
  DERIVED_ROOT="/Volumes/workspace/DerivedData"
fi

if [ -n "$DERIVED_ROOT" ]; then
  XCFW="$DERIVED_ROOT/SourcePackages/artifacts/webrtc/WebRTC/WebRTC.xcframework"
  # Patch all platform slices inside the xcframework
  find "$XCFW" -name "WebRTC.framework" 2>/dev/null | while read -r fw; do
    patch_framework "$fw"
  done
else
  echo "fix-webrtc-headers: SourcePackages not found (BUILD_DIR=$BUILD_DIR) — skipped canonical source"
fi
