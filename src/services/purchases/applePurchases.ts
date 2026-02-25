/**
 * Apple In-App Purchases Service
 * 
 * Uses @capgo/native-purchases with StoreKit 2 for iOS subscriptions.
 * Fail-closed entitlement model:
 * - Pro is granted only for active, non-expired, non-cancelled subscription
 * - Any validation failure revokes Pro immediately
 * - Web never grants Pro
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

// Cache TTL: cached Pro is trusted for at most 15 minutes
const CACHE_TTL_MS = 15 * 60 * 1000;
// Resume revalidation cooldown: don't hammer StoreKit on rapid resume
const RESUME_COOLDOWN_MS = 10 * 1000;
const PRO_PRODUCT_IDS = new Set<ProductId>([PRODUCT_IDS.MONTHLY, PRODUCT_IDS.YEARLY]);

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

interface StorePurchase {
  productIdentifier?: string;
  identifier?: string;
  expirationDate?: string;
  isActive?: boolean;
  willCancel?: boolean | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function freeEntitlement(lastValidatedAt: string = nowIso()): Entitlement {
  return {
    ...DEFAULT_ENTITLEMENT,
    lastValidatedAt,
  };
}

function normalizeProductId(value: unknown): ProductId | null {
  return PRO_PRODUCT_IDS.has(value as ProductId) ? (value as ProductId) : null;
}

function parseExpirationMs(expiresAt: unknown): number | null {
  if (typeof expiresAt !== 'string') return null;
  const ms = Date.parse(expiresAt);
  return Number.isFinite(ms) ? ms : null;
}

function isStrictProEntitlement(entitlement: Entitlement): boolean {
  if (!entitlement.isPro) return false;
  if (!normalizeProductId(entitlement.productId)) return false;

  const expirationMs = parseExpirationMs(entitlement.expiresAt);
  if (expirationMs === null) return false;

  return expirationMs > Date.now();
}

function sanitizeEntitlement(entitlement: Entitlement): Entitlement {
  const lastValidatedAt =
    typeof entitlement.lastValidatedAt === 'string' && Number.isFinite(Date.parse(entitlement.lastValidatedAt))
      ? entitlement.lastValidatedAt
      : nowIso();

  if (!isIOSNative()) {
    return freeEntitlement(lastValidatedAt);
  }

  if (!isStrictProEntitlement(entitlement)) {
    return freeEntitlement(lastValidatedAt);
  }

  return {
    isPro: true,
    source: 'apple',
    expiresAt: entitlement.expiresAt!,
    productId: normalizeProductId(entitlement.productId)!,
    lastValidatedAt,
  };
}

function getActiveProPurchase(purchases: unknown): StorePurchase | null {
  if (!Array.isArray(purchases)) return null;

  const now = Date.now();
  for (const purchase of purchases as StorePurchase[]) {
    const productId = normalizeProductId(purchase.productIdentifier || purchase.identifier);
    if (!productId) continue;

    // Fail closed: entitlement must explicitly be active
    if (purchase.isActive !== true) continue;

    // Business rule: cancelled subscriptions are treated as non-Pro immediately
    if (purchase.willCancel === true) continue;

    const expirationMs = parseExpirationMs(purchase.expirationDate);
    if (expirationMs === null || expirationMs <= now) continue;

    return purchase;
  }

  return null;
}

// ─── Storage helpers ───────────────────────────────────────

async function loadCachedEntitlement(): Promise<Entitlement> {
  if (!isIOSNative()) {
    return { ...DEFAULT_ENTITLEMENT };
  }

  try {
    const result = await Preferences.get({ key: ENTITLEMENT_STORAGE_KEY });
    const raw = result.value;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Entitlement> & { lastCheckedAt?: string };
      const migrated: Entitlement = sanitizeEntitlement({
        isPro: parsed.isPro === true,
        source: parsed.source === 'apple' ? 'apple' : 'none',
        expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
        productId: normalizeProductId(parsed.productId),
        lastValidatedAt:
          typeof parsed.lastValidatedAt === 'string'
            ? parsed.lastValidatedAt
            : typeof parsed.lastCheckedAt === 'string'
              ? parsed.lastCheckedAt
              : new Date(0).toISOString(),
      });
      return migrated;
    }
  } catch {
    // Corrupt cache → default to free
  }
  return { ...DEFAULT_ENTITLEMENT };
}

async function saveEntitlement(entitlement: Entitlement): Promise<void> {
  if (!isIOSNative()) {
    return;
  }

  try {
    const serialized = JSON.stringify(entitlement);
    await Preferences.set({ key: ENTITLEMENT_STORAGE_KEY, value: serialized });
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
  const safeEntitlement = sanitizeEntitlement(newEntitlement);
  cachedEntitlement = safeEntitlement;
  await saveEntitlement(safeEntitlement);
  notifyListeners(safeEntitlement);
}

// ─── Cache validation (fail-closed) ───────────────────────

/**
 * Returns true if the cached entitlement can still be trusted.
 * Returns false (= revoke Pro) if cache is stale or expired.
 */
function isCacheValid(ent: Entitlement): boolean {
  if (!ent.isPro) return true; // free users are always "valid"
  if (!isStrictProEntitlement(ent)) return false;

  const now = Date.now();
  const lastValidated = Date.parse(ent.lastValidatedAt);
  if (!Number.isFinite(lastValidated)) return false;

  // Check cache TTL — Pro can't persist beyond TTL without revalidation
  if (now - lastValidated > CACHE_TTL_MS) return false;

  return true;
}

// ─── Initialization ───────────────────────────────────────

export async function initPurchases(): Promise<void> {
  if (isInitialized) return;

  // If not on iOS native, ALWAYS force free (no way to validate on web)
  if (!isIOSNative()) {
    await setEntitlement(freeEntitlement());
    isInitialized = true;
    return;
  }

  // Load cached entitlement
  cachedEntitlement = await loadCachedEntitlement();

  // Immediately validate cache — revoke Pro if stale/expired
  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    await setEntitlement(freeEntitlement());
  }

  try {
    const mod = await import('@capgo/native-purchases');
    purchasesPlugin = mod.NativePurchases;
    PURCHASE_TYPE_ENUM = mod.PURCHASE_TYPE;

    const { isBillingSupported } = await purchasesPlugin.isBillingSupported();
    if (!isBillingSupported) {
      // Can't verify purchases → fail closed
      await setEntitlement(freeEntitlement());
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
    await setEntitlement(freeEntitlement());
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
    await setEntitlement(freeEntitlement());
  }

  // Then: full StoreKit revalidation
  await refreshEntitlementFromStore();
}

// ─── Core: Refresh from StoreKit ──────────────────────────

async function refreshEntitlementFromStore(): Promise<void> {
  const validatedAt = nowIso();
  if (!isIOSNative() || !purchasesPlugin || !PURCHASE_TYPE_ENUM) {
    await setEntitlement(freeEntitlement(validatedAt));
    return;
  }

  try {
    const { purchases } = await purchasesPlugin.getPurchases({
      productType: PURCHASE_TYPE_ENUM.SUBS,
    });

    const activeSub = getActiveProPurchase(purchases);
    if (!activeSub) {
      await setEntitlement(freeEntitlement(validatedAt));
      return;
    }

    await setEntitlement({
      isPro: true,
      source: 'apple',
      expiresAt: activeSub.expirationDate!,
      productId: normalizeProductId(activeSub.productIdentifier || activeSub.identifier)!,
      lastValidatedAt: validatedAt,
    });
  } catch {
    // Validation failed: fail closed immediately
    await setEntitlement(freeEntitlement(validatedAt));
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
  if (!isIOSNative()) {
    return { ...DEFAULT_ENTITLEMENT };
  }

  // Always validate cache before returning — fail closed
  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    // Synchronously return free; async cleanup will follow
    const free = freeEntitlement();
    cachedEntitlement = free;
    // Fire async save + notify
    setEntitlement(free);
    return free;
  }
  return { ...cachedEntitlement };
}

export async function forceRefreshEntitlement(): Promise<Entitlement> {
  if (!isIOSNative()) {
    await setEntitlement(freeEntitlement());
    return getEntitlement();
  }

  if (!isInitialized || !purchasesPlugin || !PURCHASE_TYPE_ENUM) {
    await initPurchases();
  }

  await refreshEntitlementFromStore();
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
  await setEntitlement(freeEntitlement());
}
