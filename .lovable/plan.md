

# Fix: Capacitor Dependency Version Mismatch

## The Problem
Two packages (`@capacitor/clipboard` and `@capacitor/preferences`) are at version 8, but all other Capacitor packages are at version 7. They must all be on the same major version.

## The Fix
Update `package.json` to downgrade these two packages from `^8.0.0` to `^7.0.0`:

- `@capacitor/clipboard`: `^8.0.0` to `^7.0.0`
- `@capacitor/preferences`: `^8.0.0` to `^7.0.0`

## After I Make the Change
On your Mac, run:
```
git pull
npm install
```

This should install cleanly with no errors, and you can continue with the rest of the setup steps.

