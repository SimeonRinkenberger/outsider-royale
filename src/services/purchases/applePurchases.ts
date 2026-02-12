/**
 * Apple In-App Purchases Service
 * 
 * Uses @capgo/native-purchases with StoreKit 2 for iOS.
 * Provides clean API for purchasing subscriptions and checking entitlements.
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
  lastCheckedAt: string;
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
const REVALIDATION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Check if we're on iOS native
export const isIOSNative = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

// Default entitlement (free user)
const DEFAULT_ENTITLEMENT: Entitlement = {
  isPro: false,
  source: 'none',
  expiresAt: null,
  productId: null,
  lastCheckedAt: new Date().toISOString(),
};

// In-memory cache
let cachedEntitlement: Entitlement = { ...DEFAULT_ENTITLEMENT };
let purchasesPlugin: any = null;
let PURCHASE_TYPE_ENUM: any = null;
let isInitialized = false;
let updateListeners: ((entitlement: Entitlement) => void)[] = [];

/**
 * Load cached entitlement from storage
 */
async function loadCachedEntitlement(): Promise<Entitlement> {
  try {
    if (isIOSNative()) {
      const result = await Preferences.get({ key: ENTITLEMENT_STORAGE_KEY });
      if (result.value) {
        return JSON.parse(result.value);
      }
    } else {
      const stored = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (error) {
    console.warn('[ApplePurchases] Failed to load cached entitlement:', error);
  }
  return { ...DEFAULT_ENTITLEMENT };
}

/**
 * Save entitlement to storage
 */
async function saveEntitlement(entitlement: Entitlement): Promise<void> {
  try {
    const serialized = JSON.stringify(entitlement);
    if (isIOSNative()) {
      await Preferences.set({ key: ENTITLEMENT_STORAGE_KEY, value: serialized });
    } else {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEY, serialized);
    }
  } catch (error) {
    console.warn('[ApplePurchases] Failed to save entitlement:', error);
  }
}

/**
 * Notify listeners of entitlement changes
 */
function notifyListeners(entitlement: Entitlement): void {
  updateListeners.forEach(listener => {
    try {
      listener(entitlement);
    } catch (error) {
      console.error('[ApplePurchases] Listener error:', error);
    }
  });
}

/**
 * Update entitlement and persist
 */
async function updateEntitlement(newEntitlement: Entitlement): Promise<void> {
  cachedEntitlement = newEntitlement;
  await saveEntitlement(newEntitlement);
  notifyListeners(newEntitlement);
}

/**
 * Check if revalidation is needed
 */
function needsRevalidation(entitlement: Entitlement): boolean {
  if (!entitlement.lastCheckedAt) return true;
  
  const lastChecked = new Date(entitlement.lastCheckedAt).getTime();
  const now = Date.now();
  return (now - lastChecked) > REVALIDATION_INTERVAL_MS;
}

/**
 * Initialize the purchases system
 * Must be called at app startup
 */
export async function initPurchases(): Promise<void> {
  if (isInitialized) {
    console.log('[ApplePurchases] Already initialized');
    return;
  }

  console.log('[ApplePurchases] Initializing...');

  // Load cached entitlement immediately
  cachedEntitlement = await loadCachedEntitlement();
  console.log('[ApplePurchases] Loaded cached entitlement:', cachedEntitlement);

  // If not on iOS, just use cached/default state
  if (!isIOSNative()) {
    console.log('[ApplePurchases] Not on iOS native, using cached state');
    isInitialized = true;
    return;
  }

  try {
    // Dynamically import the Capacitor plugin
    const mod = await import('@capgo/native-purchases');
    purchasesPlugin = mod.NativePurchases;
    PURCHASE_TYPE_ENUM = mod.PURCHASE_TYPE;

    console.log('[ApplePurchases] Plugin loaded');

    // Check billing support
    const { isBillingSupported } = await purchasesPlugin.isBillingSupported();
    console.log('[ApplePurchases] Billing supported:', isBillingSupported);

    if (!isBillingSupported) {
      console.warn('[ApplePurchases] Billing not supported on this device');
      isInitialized = true;
      return;
    }

    // Check current purchase status
    if (needsRevalidation(cachedEntitlement)) {
      await refreshEntitlementFromStore();
    }

    isInitialized = true;
    console.log('[ApplePurchases] Initialized successfully');
  } catch (error) {
    console.error('[ApplePurchases] Failed to initialize:', error);
    // Continue with cached state on error
    isInitialized = true;
  }
}

/**
 * Refresh entitlement state from StoreKit
 */
async function refreshEntitlementFromStore(): Promise<void> {
  if (!isIOSNative() || !purchasesPlugin || !PURCHASE_TYPE_ENUM) {
    console.log('[ApplePurchases] Cannot refresh - not on iOS or not initialized');
    return;
  }

  try {
    // Get active subscription purchases from StoreKit
    const { purchases } = await purchasesPlugin.getPurchases({
      productType: PURCHASE_TYPE_ENUM.SUBS,
    });
    console.log('[ApplePurchases] Active purchases:', purchases);

    const activeSub = purchases?.find((p: any) =>
      (p.productIdentifier === PRODUCT_IDS.MONTHLY || p.productIdentifier === PRODUCT_IDS.YEARLY)
    );

    const newEntitlement: Entitlement = {
      isPro: !!activeSub,
      source: activeSub ? 'apple' : 'none',
      expiresAt: activeSub?.expirationDate || null,
      productId: activeSub?.productIdentifier as ProductId || null,
      lastCheckedAt: new Date().toISOString(),
    };

    await updateEntitlement(newEntitlement);
    console.log('[ApplePurchases] Updated entitlement:', newEntitlement);
  } catch (error) {
    console.error('[ApplePurchases] Failed to refresh entitlement:', error);
    // Update lastCheckedAt even on error to avoid spam
    await updateEntitlement({
      ...cachedEntitlement,
      lastCheckedAt: new Date().toISOString(),
    });
  }
}

/**
 * Get available products from App Store
 */
export async function getProducts(): Promise<{ monthly: ProductInfo | null; yearly: ProductInfo | null }> {
  if (!isIOSNative() || !purchasesPlugin) {
    console.log('[ApplePurchases] Cannot get products - not on iOS or not initialized');
    return { monthly: null, yearly: null };
  }

  try {
    const { products } = await purchasesPlugin.getProducts({
      productIdentifiers: [PRODUCT_IDS.MONTHLY, PRODUCT_IDS.YEARLY],
    });
    console.log('[ApplePurchases] Products:', products);

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
  } catch (error) {
    console.error('[ApplePurchases] Failed to get products:', error);
    return { monthly: null, yearly: null };
  }
}

/**
 * Purchase a subscription
 */
export async function purchase(productId: ProductId): Promise<PurchaseResult> {
  console.log('[ApplePurchases] Starting purchase for:', productId);

  if (!isIOSNative()) {
    return { status: 'failed', error: 'Purchases are only available on iOS' };
  }

  if (!purchasesPlugin || !PURCHASE_TYPE_ENUM) {
    return { status: 'failed', error: 'Purchases not initialized' };
  }

  try {
    const result = await purchasesPlugin.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE_ENUM.SUBS,
    });
    console.log('[ApplePurchases] Purchase result:', result);

    // Refresh entitlement after purchase
    await refreshEntitlementFromStore();

    return { status: 'success' };
  } catch (error: any) {
    console.error('[ApplePurchases] Purchase failed:', error);

    // Check for user cancellation
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

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<RestoreResult> {
  console.log('[ApplePurchases] Restoring purchases...');

  if (!isIOSNative()) {
    return { status: 'failed', error: 'Restore is only available on iOS' };
  }

  if (!purchasesPlugin) {
    return { status: 'failed', error: 'Purchases not initialized' };
  }

  try {
    await purchasesPlugin.restorePurchases();
    console.log('[ApplePurchases] Restore complete');

    // Refresh entitlement
    await refreshEntitlementFromStore();

    return { status: 'success' };
  } catch (error: any) {
    console.error('[ApplePurchases] Restore failed:', error);
    return { 
      status: 'failed', 
      error: error?.message || 'Failed to restore purchases' 
    };
  }
}

/**
 * Get current entitlement state (cached, non-blocking)
 */
export function getEntitlement(): Entitlement {
  return { ...cachedEntitlement };
}

/**
 * Force refresh entitlement from store
 */
export async function forceRefreshEntitlement(): Promise<Entitlement> {
  if (isIOSNative() && purchasesPlugin) {
    await refreshEntitlementFromStore();
  }
  return { ...cachedEntitlement };
}

/**
 * Subscribe to entitlement updates
 */
export function onEntitlementUpdate(listener: (entitlement: Entitlement) => void): () => void {
  updateListeners.push(listener);
  return () => {
    updateListeners = updateListeners.filter(l => l !== listener);
  };
}

/**
 * Open Apple subscription management
 */
export async function openSubscriptionManagement(): Promise<void> {
  if (isIOSNative() && purchasesPlugin) {
    try {
      await purchasesPlugin.manageSubscriptions();
    } catch (error) {
      console.error('[ApplePurchases] Failed to open subscription management:', error);
      window.open('https://apps.apple.com/account/subscriptions', '_blank');
    }
  } else {
    window.open('https://apps.apple.com/account/subscriptions', '_blank');
  }
}

/**
 * Clear entitlement (for testing/logout)
 */
export async function clearEntitlement(): Promise<void> {
  await updateEntitlement({ ...DEFAULT_ENTITLEMENT });
}

// Debug helpers (dev mode only)
export const debugPurchases = {
  getState: () => ({
    isInitialized,
    cachedEntitlement,
    isIOSNative: isIOSNative(),
    hasPlugin: !!purchasesPlugin,
  }),
  forceSetPro: async (isPro: boolean) => {
    if (process.env.NODE_ENV !== 'production') {
      await updateEntitlement({
        ...cachedEntitlement,
        isPro,
        source: isPro ? 'apple' : 'none',
        lastCheckedAt: new Date().toISOString(),
      });
    }
  },
};
