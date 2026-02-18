
## Root Cause

The workflow file is correct now, but there are **two problems** causing the "half of commits fail" symptom:

**Problem 1 — The workflow existed with wrong/empty content before the last fix**
Previous commits had the workflow file either empty or referencing `outsiderroyale.xcodeproj`. Those old failed runs are historical and cannot be un-failed. However, all new commits from now on should pass — unless Problem 2 bites them.

**Problem 2 — `| xcpretty || true` masks real failures AND can break the exit code**
The current archive step is:
```yaml
xcodebuild archive ... | xcpretty || true
```
Two issues here:
- `xcpretty` is a Ruby gem that is **not pre-installed** on GitHub Actions `macos-latest` runners. If it's missing, the pipe itself errors, and `|| true` silently swallows it — making the step "pass" even when the build failed.
- The pipe `|` means bash uses `xcpretty`'s exit code, not `xcodebuild`'s. So even if xcodebuild fails (e.g. compile error), the step reports success. This means you get a green workflow tick but an empty/corrupt archive artifact.

**Problem 3 — SPM packages reference local `node_modules` paths**
`Package.swift` uses relative paths like `../../../node_modules/@capacitor/clipboard`. The CI runner must have `node_modules` present at exactly the right relative depth from `ios/App/CapApp-SPM/` for Swift Package Manager to resolve them. The workflow does run `npm ci` first, which is correct — but the `npm ci` runs in the repo root, so the path `../../../node_modules` from `ios/App/CapApp-SPM/` resolves to the repo root's `node_modules`. This is correct as long as checkout is at the repo root. This part is fine.

## Fix Plan

### Change 1 — Remove `xcpretty` (unreliable on CI) and fix exit code propagation
Replace the pipe with a log file redirect instead, so xcodebuild's exit code is preserved and the step fails correctly when the build fails.

**Before:**
```yaml
xcodebuild archive \
  ... \
  | xcpretty || true
```

**After:**
```yaml
set -o pipefail
xcodebuild archive \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath build/App.xcarchive \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  2>&1 | tee build/xcodebuild.log
```

`set -o pipefail` ensures if xcodebuild fails, the step fails. `tee` outputs to console AND saves the log. No external gem needed.

### Change 2 — Upload the xcodebuild log as an artifact for debugging
Add a step that always uploads `build/xcodebuild.log` so future failures are diagnosable without SSH access.

### Change 3 — Add `gem install xcpretty` only if we want prettier output
Optional — if prettier output is desired, install it explicitly rather than assuming it exists.

## Files Changed

- `.github/workflows/ios-build.yml` — remove xcpretty dependency, fix exit code propagation, add log artifact upload

## What this does NOT change
- No iOS project files modified
- No application code modified
- No database code modified
- No Capacitor config modified
