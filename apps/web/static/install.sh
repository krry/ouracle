#!/bin/sh
set -e

REPO="krry/ouracle"
BIN="clea"
ARCHIVE="clea-macos.tar.gz"

latest=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')

if [ -z "$latest" ]; then
  echo "error: could not find latest release" >&2
  exit 1
fi

url="https://github.com/${REPO}/releases/download/${latest}/${ARCHIVE}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "downloading clea ${latest}..."
curl -fsSL "$url" -o "${tmp}/${ARCHIVE}"
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
