#!/bin/bash
set -e

# Try to initialize submodule if git is available
if command -v git &> /dev/null; then
  echo "Initializing submodules via git..."
  git submodule update --init --recursive
else
  echo "git not found — downloading rites corpus directly"
  mkdir -p rites
  if [ ! -d "rites/.git" ]; then
    curl -sL https://github.com/krry/rites/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 -C rites
  fi
fi

# Build the RITES index (generate dist/*.json)
echo "Building RITES corpus index..."
cd rites
if command -v node &> /dev/null; then
  node scripts/build-index.js
else
  echo "ERROR: node not available to build RITES index"
  exit 1
fi
cd -

# Verify the data files exist
if [ ! -f "rites/dist/stepstates.json" ]; then
  echo "ERROR: rites/dist/stepstates.json not found after build"
  ls -la rites/dist 2>&1 || true
  exit 1
fi

echo "Rites corpus ready."
