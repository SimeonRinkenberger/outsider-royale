#!/bin/sh
set -e

# Xcode Cloud checks out the repository but does not install JavaScript
# dependencies automatically. Capacitor iOS Swift packages in CapApp-SPM
# reference local paths under node_modules, so they must exist before archive.

WORKSPACE="${CI_WORKSPACE:-$PWD}"
cd "$WORKSPACE"

echo "Using workspace: $WORKSPACE"

# Ensure Node/npm are available in fresh Xcode Cloud environments.
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH. Installing Node.js..."

  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is not available and npm is missing. Cannot continue."
    exit 127
  fi

  if ! brew list node@20 >/dev/null 2>&1; then
    brew install node@20
  fi
  NODE_PREFIX="$(brew --prefix node@20 2>/dev/null || true)"
  if [ -n "$NODE_PREFIX" ]; then
    export PATH="$NODE_PREFIX/bin:$PATH"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is still unavailable after Node installation."
  exit 127
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is not available; npm installation is incomplete."
  exit 127
fi

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"

echo "Installing npm dependencies for Capacitor Swift package paths..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "Building web assets..."
npm run build

echo "Syncing Capacitor iOS project..."
npx cap sync ios --deployment
