# Apple In-App Purchases - Outsider Royale

This document describes the Apple In-App Purchase implementation for Outsider Royale.

## Product IDs (App Store Connect)

| Product ID | Type | Price | Notes |
|------------|------|-------|-------|
| `outsider_royale_monthly` | Auto-renewable subscription | $2.99/month | Intro offer: $0.99 first month |
| `outsider_royale_yearly` | Auto-renewable subscription | $14.99/year | ~58% savings vs monthly |

## Architecture Overview

### Files

```
src/
├── services/purchases/
│   └── applePurchases.ts      # Core StoreKit 2 integration
├── contexts/
│   └── EntitlementContext.tsx # React context for entitlement state
├── lib/
│   └── entitlements.ts        # Category access helpers
├── components/
│   ├── Paywall.tsx            # Subscription UI
│   ├── ProBadge.tsx           # Pro indicator badges
│   └── EntitlementDebug.tsx   # Dev-only debug panel
```

### How Entitlement is Determined

1. **On App Start:**
   - `EntitlementProvider` initializes
   - Loads cached entitlement from storage (immediate, non-blocking)
   - On iOS: Checks `Transaction.currentEntitlements` from StoreKit
   - Updates cache with fresh state

2. **Revalidation:**
   - Cached entitlement is used immediately (no loading delay)
   - Fresh check from Apple happens at most every 6 hours
   - Immediate refresh on purchase/restore events

3. **Storage:**
   - iOS Native: Uses `@capacitor/preferences` (secure native storage)
   - Web: Uses `localStorage`
   - Stores: `isPro`, `expiresAt`, `lastCheckedAt`, `productId`

4. **Priority:**
   - Apple entitlement is the source of truth
   - Falls back to cached state if offline
   - Free status if no subscription found

## How Restore Works

1. User taps "Restore Purchases" in Paywall
2. `restorePurchases()` calls StoreKit's restore function
3. StoreKit checks Apple ID for previous purchases
4. If found: `isPro = true`, cache updated, UI refreshes
5. If not found: Error message shown

## Gating Logic

### Free Users
- Access to 4 categories: Food, Animal, Place, Thing
- Category restrictions enforced in UI (locked categories show lock icon)

### Pro Users  
- Access to all 8 categories (including Brand, Movie, Person, Spicy)
- Full word pool

### Category Access Check

```typescript
import { canAccessCategory } from '@/lib/entitlements';
import { useEntitlement } from '@/contexts/EntitlementContext';

function CategorySelector() {
  const { entitlement } = useEntitlement();
  
  const canSelect = canAccessCategory('movie', entitlement);
  // Returns true if Pro, false if Free
}
```

### UI Gating in GameConfigPanel

The `GameConfigPanel` component enforces category access:
- Paid categories show a lock icon for free users
- Clicking a locked category opens the Paywall
- "Select All" only selects accessible categories
- Pro users see a crown icon on premium categories

## RPC Functions

The `get_random_words_from_categories` and `get_imposter_word` RPCs:

```typescript
const { data } = await supabase.rpc('get_random_words_from_categories', {
  p_categories: selectedCategories,
  p_count: 1,
});
```

**Note:** Category restrictions are currently enforced client-side. The UI prevents free users from selecting paid categories before the RPC call is made.

## Testing with Sandbox Accounts

### Setup

1. Create sandbox test accounts in App Store Connect
2. Sign out of App Store on test device
3. Sign in with sandbox account when prompted during purchase

### Test Cases

1. **Fresh Purchase:**
   - Select monthly/yearly subscription
   - Complete purchase flow
   - Verify Pro status is active immediately
   - Verify paid categories are unlocked

2. **Restore:**
   - Install app on new device (same sandbox account)
   - Tap "Restore Purchases"
   - Verify Pro status is restored

3. **Expiration:**
   - Sandbox subscriptions expire quickly (minutes, not months)
   - Verify app reverts to Free status after expiry
   - Verify paid categories become locked

4. **Offline:**
   - Enable airplane mode
   - Verify cached Pro status persists
   - Verify app functions normally

### Debug Panel

In development builds, a yellow bug icon appears in the bottom-left corner. Tap to:

- View current entitlement state
- Force refresh from Apple
- Toggle Pro status for testing

## Paywall Access Points

1. **Menu:** "Go Pro" button in header (if free user)
2. **Category Selection:** Tap locked category → shows paywall
3. **Settings/Stats:** "Manage Subscription" link (for Pro users)

## Platform Safety

- **iOS Native:** Full StoreKit 2 functionality
- **Web/Android:** Gracefully degrades:
  - `canPurchase = false`
  - `isPro = false` (uses cached/default)
  - No crashes, purchase buttons show platform warning
  - Users directed to iOS app for subscription

## App Store Review Checklist

- [x] Prices pulled from StoreKit (localized, not hardcoded)
- [x] Restore Purchases button prominently displayed
- [x] Apple legal text included in paywall
- [x] Links to Privacy Policy and Terms of Use
- [x] Subscription auto-renewal clearly disclosed
- [x] Guest users can purchase (no account required)
- [x] No mention of external payment methods

## Troubleshooting

### Purchase Stuck

```typescript
// In EntitlementDebug panel:
// 1. Tap "Refresh" to force-check Apple
// 2. Check console logs for errors
```

### Cache Issues

```typescript
// Clear entitlement cache:
import { clearEntitlement } from '@/services/purchases/applePurchases';
await clearEntitlement();
```

### Sandbox Issues

- Sandbox environment can be slow/unreliable
- Try signing out and back into sandbox account
- Restart the app completely
- Check App Store Connect for sandbox transaction status
