

# Complete Guide: From Lovable to Xcode to App Store

This is a step-by-step walkthrough assuming you have never opened Xcode before. Follow each step in order.

---

## Prerequisites (What You Need Before Starting)

- A Mac computer (Xcode only runs on macOS)
- An Apple Developer Account ($99/year) — sign up at https://developer.apple.com if you haven't already
- Xcode installed from the Mac App Store (it's free, ~12 GB download — start this now if you haven't)
- Your Lovable project exported to GitHub

---

## Phase 1: Export to GitHub

Your project already has Git set up. If you haven't already connected it to GitHub:

1. In Lovable, go to **Settings** (gear icon) and then **GitHub** and then **Connect project**
2. Authorize the Lovable GitHub App
3. Select your GitHub account
4. Click **Create Repository** — this pushes all your code to a new GitHub repo

If it's already connected, you're good — everything is synced automatically.

---

## Phase 2: Clone the Project to Your Mac

Open **Terminal** on your Mac (search "Terminal" in Spotlight) and run:

```text
cd ~/Desktop
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

Replace `YOUR_USERNAME/YOUR_REPO_NAME` with the actual GitHub repo URL (you can copy it from GitHub).

---

## Phase 3: Install Dependencies and Add iOS Platform

Still in Terminal, run these commands one at a time:

```text
npm install
```

This installs all the JavaScript dependencies. Then:

```text
npx cap add ios
```

This creates the `ios/` folder containing the full Xcode project. Then build and sync:

```text
npm run build
npx cap sync ios
```

`npm run build` compiles your web app into the `dist/` folder. `npx cap sync ios` copies it into the iOS project and installs any native plugins (like the purchases plugin).

---

## Phase 4: Fix the Bundle ID (Important!)

Before opening Xcode, there is one code change needed. Your `capacitor.config.ts` currently has `appId: 'app.lovable.4b9de44f1c684ee88e08f7594c181759'` but your actual App Store bundle ID is `com.wordoutsider.app`. I will update this for you when we implement the plan — it needs to be:

```text
appId: 'com.wordoutsider.app'
```

After I make this change, you'll need to `git pull`, then run `npx cap sync ios` again.

---

## Phase 5: Open the Project in Xcode

In Terminal, run:

```text
npx cap open ios
```

This opens the Xcode project automatically. Alternatively, you can open Xcode manually and use **File > Open** and navigate to the `ios/App/App.xcworkspace` file inside your project folder.

**Important:** Always open the `.xcworkspace` file, NOT the `.xcodeproj` file.

---

## Phase 6: Configure Xcode (First Time Setup)

When the project opens in Xcode:

### 6a. Select your Team
1. In the left sidebar, click the blue **App** project icon (top of the file tree)
2. Under **Targets**, select **App**
3. Go to the **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Under **Team**, select your Apple Developer account from the dropdown
6. Verify the **Bundle Identifier** says `com.wordoutsider.app`

### 6b. Add In-App Purchase Capability
1. Still on the **Signing & Capabilities** tab
2. Click the **+ Capability** button (top-left of that tab)
3. Search for "In-App Purchase" and double-click it
4. It will appear as a new section — that's all you need to do

### 6c. Set Deployment Target
1. Go to the **General** tab
2. Under **Minimum Deployments**, set iOS to **16.0** (or whatever minimum you want to support)

### 6d. Set App Icons
1. In the left sidebar, expand **App > App > Assets.xcassets**
2. Click **AppIcon**
3. Drag your 1024x1024 app icon into the slot (you already have `public/app-icon-1024.png` — use that)

---

## Phase 7: Run on a Simulator (Test It Works)

1. At the top of Xcode, you'll see a device selector (e.g., "iPhone 16")
2. Select any iPhone simulator
3. Click the **Play button** (triangle icon) or press **Cmd + R**
4. Xcode will build the project and launch the simulator
5. Your app should load and show the Outsider Royale interface

Since your `capacitor.config.ts` has a `server.url` pointing to the live Lovable preview, the app will load your web app from that URL. This is great for development — you see changes in real-time without rebuilding.

---

## Phase 8: Run on a Physical iPhone (Required for IAP Testing)

In-App Purchases do NOT work on the simulator. You need a real device:

1. Plug your iPhone into your Mac with a USB cable
2. On your iPhone, go to **Settings > Privacy & Security > Developer Mode** and turn it ON (restart when prompted)
3. In Xcode's device selector (top bar), select your iPhone
4. Click **Play** (Cmd + R)
5. The first time, your iPhone may ask you to trust the developer certificate — go to **Settings > General > VPN & Device Management** on your iPhone and trust your certificate
6. The app should install and launch on your phone

---

## Phase 9: Prepare for App Store Submission

When you're ready to submit (after testing purchases, gameplay, etc.):

### 9a. Switch from Dev Server to Bundled App

For the App Store version, you do NOT want the app loading from a URL. You need to remove the `server` block from `capacitor.config.ts` so the app uses the locally bundled files. I will handle this change, but the final config should look like:

```text
appId: 'com.wordoutsider.app',
appName: 'Outsider Royale',
webDir: 'dist'
```

(No `server` property.) Then rebuild:

```text
npm run build
npx cap sync ios
```

### 9b. Create an Archive
1. In Xcode, select **Any iOS Device (arm64)** as the build target (not a simulator or specific phone)
2. Go to **Product > Archive**
3. Xcode will build the app and open the **Organizer** window when done

### 9c. Upload to App Store Connect
1. In the Organizer, select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Follow the prompts (automatic signing is fine)
5. Xcode will upload your build to App Store Connect

### 9d. Complete App Store Connect Listing
Go to https://appstoreconnect.apple.com:
1. Create your app listing (screenshots, description, keywords, etc.)
2. Select the uploaded build
3. Set up your In-App Purchases (subscriptions + consumable) as discussed earlier
4. Submit for review

---

## Quick Reference: Commands You'll Use Often

| What | Command |
|------|---------|
| Pull latest changes from Lovable | `git pull` |
| Install new dependencies | `npm install` |
| Build the web app | `npm run build` |
| Sync to iOS project | `npx cap sync ios` |
| Open in Xcode | `npx cap open ios` |
| Full refresh cycle | `git pull && npm install && npm run build && npx cap sync ios` |

---

## What I Will Change in Code

When you approve this plan, I will:

1. Update `capacitor.config.ts` to use the correct bundle ID (`com.wordoutsider.app`)
2. That is the only code change needed — everything else is Xcode/terminal configuration on your end

---

## Summary of the Order of Operations

1. Install Xcode from Mac App Store
2. Export Lovable project to GitHub (if not already done)
3. Clone to your Mac
4. `npm install`
5. `npx cap add ios`
6. `npm run build && npx cap sync ios`
7. `npx cap open ios`
8. Configure signing, team, capabilities in Xcode
9. Run on simulator to verify
10. Run on physical device to test purchases
11. When ready for App Store: remove server URL, archive, upload

