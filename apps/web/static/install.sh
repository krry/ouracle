#!/bin/sh
set -e

BASE="https://ouracle.kerry.ink"
BIN="clea"
ARCHIVE="clea-macos.tar.gz"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "downloading clea..."
curl -fsSL "${BASE}/${ARCHIVE}" -o "${tmp}/${ARCHIVE}"
tar xzf "${tmp}/${ARCHIVE}" -C "$tmp"

dest="${HOME}/.local/bin"
mkdir -p "$dest"
mv "${tmp}/${BIN}" "${dest}/${BIN}"
chmod +x "${dest}/${BIN}"

# Remove macOS quarantine flag so Gatekeeper doesn't block the first run.
xattr -dr com.apple.quarantine "${dest}/${BIN}" 2>/dev/null || true

echo "installed: ${dest}/${BIN}"
echo ""
echo "make sure ${dest} is in your PATH, then run: clea"
echo "docs: https://ouracle.kerry.ink/clea"
