/**
 * Apple In-App Purchases Service
 * 
 * Uses StoreKit 2 patterns via Capacitor plugin for iOS.
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
    const { NativePurchases } = await import('@capgo/native-purchases');
    purchasesPlugin = NativePurchases;

    // Configure RevenueCat SDK with API key
    await purchasesPlugin.configure({
      apiKey: 'appl_eZXUQDKifpGINqKHlaEQAXTvrdX',
    });
    console.log('[ApplePurchases] RevenueCat configured');

    // Listen for transaction updates
    await purchasesPlugin.addListener('purchasesUpdate', async (info: any) => {
      console.log('[ApplePurchases] Transaction update:', info);
      await refreshEntitlementFromStore();
    });

    // Check current entitlements
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
 * Refresh entitlement state from Apple
 */
async function refreshEntitlementFromStore(): Promise<void> {
  if (!isIOSNative() || !purchasesPlugin) {
    console.log('[ApplePurchases] Cannot refresh - not on iOS or not initialized');
    return;
  }

  try {
    const customerInfo = await purchasesPlugin.getCustomerInfo();
    console.log('[ApplePurchases] Customer info:', customerInfo);

    // Check for active subscription entitlement
    const activeSubscriptions = customerInfo?.activeSubscriptions || [];
    const hasActiveSubscription = activeSubscriptions.some((subId: string) => 
      subId === PRODUCT_IDS.MONTHLY || subId === PRODUCT_IDS.YEARLY
    );

    // Get expiration date
    let expiresAt: string | null = null;
    let productId: ProductId | null = null;
    
    if (hasActiveSubscription) {
      // Find the active subscription details
      const entitlementInfo = customerInfo?.entitlements?.active?.pro;
      if (entitlementInfo) {
        expiresAt = entitlementInfo.expirationDate || null;
        productId = entitlementInfo.productIdentifier as ProductId;
      } else {
        // Fallback to first active subscription
        productId = activeSubscriptions.find((id: string) => 
          id === PRODUCT_IDS.MONTHLY || id === PRODUCT_IDS.YEARLY
        ) || null;
      }
    }

    const newEntitlement: Entitlement = {
      isPro: hasActiveSubscription,
      source: hasActiveSubscription ? 'apple' : 'none',
      expiresAt,
      productId,
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
    const offerings = await purchasesPlugin.getOfferings();
    console.log('[ApplePurchases] Offerings:', offerings);

    const current = offerings?.current;
    if (!current) {
      console.warn('[ApplePurchases] No current offerings available');
      return { monthly: null, yearly: null };
    }

    // Find monthly and yearly packages
    const monthlyPackage = current.availablePackages?.find((pkg: any) => 
      pkg.product?.identifier === PRODUCT_IDS.MONTHLY
    );
    const yearlyPackage = current.availablePackages?.find((pkg: any) => 
      pkg.product?.identifier === PRODUCT_IDS.YEARLY
    );

    const mapProduct = (pkg: any): ProductInfo | null => {
      if (!pkg?.product) return null;
      const product = pkg.product;
      return {
        id: product.identifier,
        title: product.title || product.localizedTitle || 'Subscription',
        description: product.description || product.localizedDescription || '',
        price: product.priceString || `$${product.price}`,
        priceValue: parseFloat(product.price) || 0,
        currency: product.currencyCode || 'USD',
        introPrice: product.introPrice?.priceString,
        introPriceValue: product.introPrice?.price ? parseFloat(product.introPrice.price) : undefined,
      };
    };

    return {
      monthly: mapProduct(monthlyPackage),
      yearly: mapProduct(yearlyPackage),
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

  if (!purchasesPlugin) {
    return { status: 'failed', error: 'Purchases not initialized' };
  }

  try {
    const offerings = await purchasesPlugin.getOfferings();
    const current = offerings?.current;
    
    if (!current) {
      return { status: 'failed', error: 'No offerings available' };
    }

    const pkg = current.availablePackages?.find((p: any) => 
      p.product?.identifier === productId
    );

    if (!pkg) {
      return { status: 'failed', error: 'Product not found' };
    }

    // Initiate purchase
    const result = await purchasesPlugin.purchasePackage({ aPackage: pkg });
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
    const customerInfo = await purchasesPlugin.restorePurchases();
    console.log('[ApplePurchases] Restore result:', customerInfo);

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
      await purchasesPlugin.showManageSubscriptions();
    } catch (error) {
      console.error('[ApplePurchases] Failed to open subscription management:', error);
      // Fallback to URL
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
