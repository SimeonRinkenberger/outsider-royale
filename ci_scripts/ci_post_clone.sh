#!/usr/bin/env bash
set -euo pipefail

# Xcode Cloud checks out the repository but does not install JavaScript
# dependencies automatically. Capacitor iOS Swift packages in CapApp-SPM
# reference local paths under node_modules, so they must exist before archive.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${CI_WORKSPACE:-$REPO_ROOT}"
SCRIPT_VERSION="2026-02-26-node-path-only-v1"

# Some Xcode Cloud setups execute this script from ci_scripts.
# Always build from the repo root where package.json/capacitor config live.
if [ ! -f "$WORKSPACE/package.json" ] && [ -f "$REPO_ROOT/package.json" ]; then
  WORKSPACE="$REPO_ROOT"
fi

cd "$WORKSPACE"

echo "Using workspace: $WORKSPACE"
echo "ci_post_clone.sh version: $SCRIPT_VERSION"

# Prefer Node/npm already available on the Xcode Cloud image.
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/local/opt/node/bin:/opt/homebrew/opt/node/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not available on PATH."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not available on PATH."
  exit 1
fi

node_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [ "${node_major:-0}" -ge 18 ]; then
  echo "Using Node $(node -v) and npm $(npm -v)."
else
  echo "Warning: Node $(node -v) is below 18; proceeding with available runtime."
  echo "Using npm $(npm -v)."
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is not available on PATH."
  exit 1
fi

echo "Installing npm dependencies for Capacitor Swift package paths..."
if [ -f package-lock.json ]; then
  if ! npm ci --no-audit --no-fund; then
    echo "npm ci failed. Falling back to npm install..."
    npm install --no-audit --no-fund
  fi
else
  npm install --no-audit --no-fund
fi

echo "Building web assets..."
npm run build

echo "Syncing Capacitor iOS project..."
npx cap sync ios --deployment
