#!/bin/sh
set -eu

# Xcode Cloud checks out the repository but does not install JavaScript
# dependencies automatically. Capacitor iOS Swift packages in CapApp-SPM
# reference local paths under node_modules, so they must exist before archive.

WORKSPACE="${CI_WORKSPACE:-$PWD}"
cd "$WORKSPACE"

echo "Using workspace: $WORKSPACE"

# Ensure common Node install locations are on PATH (Xcode Cloud shells can be minimal).
export PATH="/opt/homebrew/bin:/usr/local/bin:/opt/homebrew/opt/node@20/bin:/opt/homebrew/opt/node@22/bin:$PATH"

# Try to activate an existing nvm-managed Node, but never fail the script here.
if ! command -v npm >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  echo "npm not found on PATH. Trying existing nvm Node runtime..."
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi

# Last-resort brew install, but keep it non-fatal so we can emit a clear error below.
if ! command -v npm >/dev/null 2>&1 && command -v brew >/dev/null 2>&1; then
  echo "npm still not found. Trying Homebrew Node.js install..."
  export HOMEBREW_NO_AUTO_UPDATE=1
  brew list node@20 >/dev/null 2>&1 || brew install node@20 || true
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
