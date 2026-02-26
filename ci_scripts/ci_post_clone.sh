#!/bin/sh
set -eu

# Xcode Cloud checks out the repository but does not install JavaScript
# dependencies automatically. Capacitor iOS Swift packages in CapApp-SPM
# reference local paths under node_modules, so they must exist before archive.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${CI_WORKSPACE:-$REPO_ROOT}"
SCRIPT_VERSION="2026-02-26-node22-v2"

# Some Xcode Cloud setups execute this script from ci_scripts.
# Always build from the repo root where package.json/capacitor config live.
if [ ! -f "$WORKSPACE/package.json" ] && [ -f "$REPO_ROOT/package.json" ]; then
  WORKSPACE="$REPO_ROOT"
fi

cd "$WORKSPACE"

echo "Using workspace: $WORKSPACE"
echo "ci_post_clone.sh version: $SCRIPT_VERSION"

# Ensure common Node install locations are on PATH (Xcode Cloud shells can be minimal).
export PATH="/opt/homebrew/bin:/usr/local/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/opt/node/bin:/usr/local/opt/node/bin:$PATH"

have_node22() {
  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  [ "${NODE_MAJOR:-0}" -ge 22 ]
}

# Try to activate an existing nvm-managed Node, but never fail the script here.
if { ! have_node22 || ! command -v npm >/dev/null 2>&1; } && [ -s "$HOME/.nvm/nvm.sh" ]; then
  echo "Node >=22/npm not ready. Trying nvm..."
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm install 22 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi

# Last-resort brew install, but keep it non-fatal so we can emit a clear error below.
if { ! have_node22 || ! command -v npm >/dev/null 2>&1; } && command -v brew >/dev/null 2>&1; then
  echo "Node >=22/npm not ready. Trying Homebrew Node.js install..."
  export HOMEBREW_NO_AUTO_UPDATE=1
  export HOMEBREW_NO_INSTALL_CLEANUP=1
  brew list node >/dev/null 2>&1 || brew install node || true
  NODE_PREFIX="$(brew --prefix node 2>/dev/null || true)"

  if [ -n "$NODE_PREFIX" ]; then
    export PATH="$NODE_PREFIX/bin:$PATH"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is still unavailable after Node installation."
  exit 127
fi

if ! have_node22; then
  echo "NodeJS >=22.0.0 is required by @capacitor/cli@8.x. Current version: $(node -v 2>/dev/null || echo 'unavailable')"
  exit 1
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
