#!/bin/sh
set -e

# Xcode Cloud checks out the repository but does not install JavaScript
# dependencies automatically. Capacitor iOS Swift packages in CapApp-SPM
# reference local paths under node_modules, so they must exist before archive.

WORKSPACE="${CI_WORKSPACE:-$PWD}"
cd "$WORKSPACE"

echo "Using workspace: $WORKSPACE"
echo "Installing npm dependencies for Capacitor Swift package paths..."
npm install

echo "Building web assets..."
npm run build

echo "Syncing Capacitor iOS project..."
npx cap sync ios --deployment
