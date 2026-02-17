/**
 * Apple In-App Purchases Service
 * 
 * Uses @capgo/native-purchases with StoreKit 2 for iOS.
 * FAIL-CLOSED: Pro is only granted with active StoreKit entitlement.
 * Cache has a strict TTL; expired/invalid cache defaults to FREE.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Product IDs matching App Store Connect
export const PRODUCT_IDS = {
  MONTHLY: 'outsider_royale_monthly',
  YEARLY: 'outsider_royale_yearly',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

// Entitlement state
export interface Entitlement {
  isPro: boolean;
  source: 'apple' | 'none';
  expiresAt: string | null;
  productId: ProductId | null;
  lastValidatedAt: string; // renamed from lastCheckedAt for clarity
}

// Product info from StoreKit
export interface ProductInfo {
  id: string;
  title: string;
  description: string;
  price: string;
  priceValue: number;
  currency: string;
  introPrice?: string;
  introPriceValue?: number;
}

export interface PurchaseResult {
  status: 'success' | 'cancelled' | 'failed';
  error?: string;
}

export interface RestoreResult {
  status: 'success' | 'failed';
  error?: string;
}

// Storage keys
const ENTITLEMENT_STORAGE_KEY = 'outsider_entitlement';

// Cache TTL: cached Pro is trusted for at most 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;
// Resume revalidation cooldown: don't hammer StoreKit on rapid resume
const RESUME_COOLDOWN_MS = 10 * 1000;

// Check if we're on iOS native
export const isIOSNative = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

// Default entitlement (free user) — the SAFE default
const DEFAULT_ENTITLEMENT: Entitlement = {
  isPro: false,
  source: 'none',
  expiresAt: null,
  productId: null,
  lastValidatedAt: new Date(0).toISOString(), // epoch = always stale
};

// In-memory state
let cachedEntitlement: Entitlement = { ...DEFAULT_ENTITLEMENT };
let purchasesPlugin: any = null;
let PURCHASE_TYPE_ENUM: any = null;
let isInitialized = false;
let updateListeners: ((entitlement: Entitlement) => void)[] = [];
let lastResumeCheck = 0;

// ─── Storage helpers ───────────────────────────────────────

async function loadCachedEntitlement(): Promise<Entitlement> {
  try {
    let raw: string | null = null;
    if (isIOSNative()) {
      const result = await Preferences.get({ key: ENTITLEMENT_STORAGE_KEY });
      raw = result.value;
    } else {
      raw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    }
    if (raw) {
      const parsed = JSON.parse(raw) as Entitlement;
      // Migrate old format: lastCheckedAt → lastValidatedAt
      if ((parsed as any).lastCheckedAt && !parsed.lastValidatedAt) {
        parsed.lastValidatedAt = (parsed as any).lastCheckedAt;
      }
      return parsed;
    }
  } catch {
    // Corrupt cache → default to free
  }
  return { ...DEFAULT_ENTITLEMENT };
}

async function saveEntitlement(entitlement: Entitlement): Promise<void> {
  try {
    const serialized = JSON.stringify(entitlement);
    if (isIOSNative()) {
      await Preferences.set({ key: ENTITLEMENT_STORAGE_KEY, value: serialized });
    } else {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEY, serialized);
    }
  } catch {
    // Non-fatal
  }
}

// ─── Notification ──────────────────────────────────────────

function notifyListeners(entitlement: Entitlement): void {
  for (const listener of updateListeners) {
    try { listener(entitlement); } catch { /* swallow */ }
  }
}

async function setEntitlement(newEntitlement: Entitlement): Promise<void> {
  cachedEntitlement = newEntitlement;
  await saveEntitlement(newEntitlement);
  notifyListeners(newEntitlement);
}

// ─── Cache validation (fail-closed) ───────────────────────

/**
 * Returns true if the cached entitlement can still be trusted.
 * Returns false (= revoke Pro) if cache is stale or expired.
 */
function isCacheValid(ent: Entitlement): boolean {
  if (!ent.isPro) return true; // free users are always "valid"

  const now = Date.now();

  // Check hard expiry from StoreKit
  if (ent.expiresAt) {
    if (now > new Date(ent.expiresAt).getTime()) return false;
  }

  // Check cache TTL — Pro can't persist beyond TTL without revalidation
  const lastValidated = new Date(ent.lastValidatedAt).getTime();
  if (now - lastValidated > CACHE_TTL_MS) return false;

  return true;
}

// ─── Initialization ───────────────────────────────────────

export async function initPurchases(): Promise<void> {
  if (isInitialized) return;

  // Load cached entitlement
  cachedEntitlement = await loadCachedEntitlement();

  // Immediately validate cache — revoke Pro if stale/expired
  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    await setEntitlement({ ...DEFAULT_ENTITLEMENT });
  }

  // If not on iOS native, ALWAYS force free (no way to validate on web)
  if (!isIOSNative()) {
    await setEntitlement({ ...DEFAULT_ENTITLEMENT });
    isInitialized = true;
    return;
  }

  try {
    const mod = await import('@capgo/native-purchases');
    purchasesPlugin = mod.NativePurchases;
    PURCHASE_TYPE_ENUM = mod.PURCHASE_TYPE;

    const { isBillingSupported } = await purchasesPlugin.isBillingSupported();
    if (!isBillingSupported) {
      // Can't verify purchases → fail closed
      await setEntitlement({ ...DEFAULT_ENTITLEMENT });
      isInitialized = true;
      return;
    }

    // Always revalidate on init (app launch)
    await refreshEntitlementFromStore();

    // Listen for app resume
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      document.addEventListener('resume', () => revalidateOnResume());
    }

    // Also use Capacitor App plugin for more reliable resume
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) revalidateOnResume();
      });
    } catch { /* @capacitor/app not available */ }

    isInitialized = true;
  } catch {
    // Plugin load failed → fail closed
    await setEntitlement({ ...DEFAULT_ENTITLEMENT });
    isInitialized = true;
  }
}

// ─── Lifecycle ────────────────────────────────────────────

function handleVisibilityChange() {
  if (!document.hidden) revalidateOnResume();
}

async function revalidateOnResume() {
  const now = Date.now();
  if (now - lastResumeCheck < RESUME_COOLDOWN_MS) return;
  lastResumeCheck = now;

  // First: local expiry check (instant, no network)
  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    await setEntitlement({ ...DEFAULT_ENTITLEMENT });
  }

  // Then: full StoreKit revalidation
  await refreshEntitlementFromStore();
}

// ─── Core: Refresh from StoreKit ──────────────────────────

async function refreshEntitlementFromStore(): Promise<void> {
  if (!isIOSNative() || !purchasesPlugin || !PURCHASE_TYPE_ENUM) return;

  try {
    const { purchases } = await purchasesPlugin.getPurchases({
      productType: PURCHASE_TYPE_ENUM.SUBS,
    });

    // Find our subscription among returned purchases
    const ourSubs = (purchases || []).filter((p: any) => {
      const id = p.productIdentifier || p.identifier;
      return id === PRODUCT_IDS.MONTHLY || id === PRODUCT_IDS.YEARLY;
    });

    // Find an ACTIVE subscription (not expired)
    const now = Date.now();
    const activeSub = ourSubs.find((p: any) => {
      // If there's an expiration date, it must be in the future
      if (p.expirationDate) {
        return new Date(p.expirationDate).getTime() > now;
      }
      // No expiration date on a subscription is suspicious — treat as inactive
      return false;
    });

    const newEntitlement: Entitlement = {
      isPro: !!activeSub,
      source: activeSub ? 'apple' : 'none',
      expiresAt: activeSub?.expirationDate || null,
      productId: (activeSub?.productIdentifier || activeSub?.identifier) as ProductId || null,
      lastValidatedAt: new Date().toISOString(),
    };

    await setEntitlement(newEntitlement);
  } catch {
    // StoreKit call failed → FAIL CLOSED: revoke Pro
    // Only keep Pro if cache is still valid (within TTL and not expired)
    if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
      await setEntitlement({ ...DEFAULT_ENTITLEMENT });
    }
    // If cache is still valid, keep current state but DON'T extend lastValidatedAt
    // This means the next check will eventually expire it
  }
}

// ─── Products ─────────────────────────────────────────────

export async function getProducts(): Promise<{ monthly: ProductInfo | null; yearly: ProductInfo | null }> {
  if (!isIOSNative() || !purchasesPlugin) {
    return { monthly: null, yearly: null };
  }

  try {
    const { products } = await purchasesPlugin.getProducts({
      productIdentifiers: [PRODUCT_IDS.MONTHLY, PRODUCT_IDS.YEARLY],
    });

    const mapProduct = (product: any): ProductInfo | null => {
      if (!product) return null;
      return {
        id: product.productIdentifier || product.identifier,
        title: product.title || product.localizedTitle || 'Subscription',
        description: product.description || product.localizedDescription || '',
        price: product.priceString || product.localizedPrice || `$${product.price}`,
        priceValue: parseFloat(product.price) || 0,
        currency: product.currencyCode || 'USD',
        introPrice: product.introPrice?.priceString,
        introPriceValue: product.introPrice?.price ? parseFloat(product.introPrice.price) : undefined,
      };
    };

    const monthly = products?.find((p: any) =>
      (p.productIdentifier || p.identifier) === PRODUCT_IDS.MONTHLY
    );
    const yearly = products?.find((p: any) =>
      (p.productIdentifier || p.identifier) === PRODUCT_IDS.YEARLY
    );

    return {
      monthly: mapProduct(monthly),
      yearly: mapProduct(yearly),
    };
  } catch {
    return { monthly: null, yearly: null };
  }
}

// ─── Purchase ─────────────────────────────────────────────

export async function purchase(productId: ProductId): Promise<PurchaseResult> {
  if (!isIOSNative()) {
    return { status: 'failed', error: 'Purchases are only available on iOS' };
  }
  if (!purchasesPlugin || !PURCHASE_TYPE_ENUM) {
    return { status: 'failed', error: 'Purchases not initialized' };
  }

  try {
    await purchasesPlugin.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE_ENUM.SUBS,
    });

    // Refresh entitlement after purchase
    await refreshEntitlementFromStore();
    return { status: 'success' };
  } catch (error: any) {
    if (error?.code === 'PURCHASE_CANCELLED' || 
        error?.message?.includes('cancel') ||
        error?.userCancelled) {
      return { status: 'cancelled' };
    }
    return { 
      status: 'failed', 
      error: error?.message || 'Purchase failed. Please try again.' 
    };
  }
}

// ─── Restore ──────────────────────────────────────────────

export async function restorePurchases(): Promise<RestoreResult> {
  if (!isIOSNative()) {
    return { status: 'failed', error: 'Restore is only available on iOS' };
  }
  if (!purchasesPlugin) {
    return { status: 'failed', error: 'Purchases not initialized' };
  }

  try {
    await purchasesPlugin.restorePurchases();
    await refreshEntitlementFromStore();
    return { status: 'success' };
  } catch (error: any) {
    return { 
      status: 'failed', 
      error: error?.message || 'Failed to restore purchases' 
    };
  }
}

// ─── Getters / Listeners ─────────────────────────────────

export function getEntitlement(): Entitlement {
  // Always validate cache before returning — fail closed
  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    // Synchronously return free; async cleanup will follow
    const free = { ...DEFAULT_ENTITLEMENT, lastValidatedAt: new Date().toISOString() };
    cachedEntitlement = free;
    // Fire async save + notify
    setEntitlement(free);
    return free;
  }
  return { ...cachedEntitlement };
}

export async function forceRefreshEntitlement(): Promise<Entitlement> {
  if (isIOSNative() && purchasesPlugin) {
    await refreshEntitlementFromStore();
  }
  return getEntitlement();
}

export function onEntitlementUpdate(listener: (entitlement: Entitlement) => void): () => void {
  updateListeners.push(listener);
  return () => {
    updateListeners = updateListeners.filter(l => l !== listener);
  };
}

// ─── Subscription Management ─────────────────────────────

export async function openSubscriptionManagement(): Promise<void> {
  if (isIOSNative() && purchasesPlugin) {
    try {
      await purchasesPlugin.manageSubscriptions();
    } catch {
      window.open('https://apps.apple.com/account/subscriptions', '_blank');
    }
  } else {
    window.open('https://apps.apple.com/account/subscriptions', '_blank');
  }
}

// ─── Clear (for logout) ─────────────────────────────────

export async function clearEntitlement(): Promise<void> {
  await setEntitlement({ ...DEFAULT_ENTITLEMENT });
}

// ─── Dev-only diagnostics (NOT debug overrides) ──────────

export const debugPurchases = {
  getState: () => ({
    isInitialized,
    cachedEntitlement: { ...cachedEntitlement },
    isIOSNative: isIOSNative(),
    hasPlugin: !!purchasesPlugin,
    cacheValid: isCacheValid(cachedEntitlement),
    cacheTTLMs: CACHE_TTL_MS,
    timeSinceValidation: Date.now() - new Date(cachedEntitlement.lastValidatedAt).getTime(),
  }),
  // NO forceSetPro — removed for security
};
