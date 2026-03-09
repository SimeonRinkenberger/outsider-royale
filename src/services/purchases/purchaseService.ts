/**
 * Purchase Service — RevenueCat as Single Source of Truth
 *
 * iOS:  Uses @revenuecat/purchases-capacitor SDK
 * Web:  Calls edge function that queries RevenueCat REST API
 *
 * Fail-closed: Pro is ONLY granted when RevenueCat confirms an active "pro" entitlement.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';

// ─── Constants ────────────────────────────────────────────
export const REVENUECAT_PUBLIC_KEY = 'appl_eZXUQDKifpGINqKHlaEQAXTvrdX';
export const ENTITLEMENT_ID = 'pro';

export const PRODUCT_IDS = {
  MONTHLY: 'outsider_royale_monthly',
  YEARLY: 'outsider_royale_yearly',
  AI_GENERATION: 'outsider_royale_ai_generation',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

// ─── Types ────────────────────────────────────────────────

export interface Entitlement {
  isPro: boolean;
  source: 'revenuecat' | 'none';
  expiresAt: string | null;
  productId: string | null;
  lastValidatedAt: string;
}

export interface ProductInfo {
  id: string;
  title: string;
  description: string;
  price: string;
  priceValue: number;
  currency: string;
  introPrice?: string;
  introPriceValue?: number;
  rcPackage?: any; // RevenueCat package object for purchasing
}

export interface PurchaseResult {
  status: 'success' | 'cancelled' | 'failed';
  error?: string;
}

export interface RestoreResult {
  status: 'success' | 'failed';
  error?: string;
}

// ─── State ────────────────────────────────────────────────

const ENTITLEMENT_STORAGE_KEY = 'outsider_entitlement_rc';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESUME_COOLDOWN_MS = 10 * 1000;

const DEFAULT_ENTITLEMENT: Entitlement = {
  isPro: false,
  source: 'none',
  expiresAt: null,
  productId: null,
  lastValidatedAt: new Date(0).toISOString(),
};

let cachedEntitlement: Entitlement = { ...DEFAULT_ENTITLEMENT };
let purchasesSDK: any = null;
let isInitialized = false;
let updateListeners: ((entitlement: Entitlement) => void)[] = [];
let lastResumeCheck = 0;

// ─── Platform Helpers ─────────────────────────────────────

export const isIOSNative = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

function nowIso(): string {
  return new Date().toISOString();
}

function freeEntitlement(lastValidatedAt: string = nowIso()): Entitlement {
  return { ...DEFAULT_ENTITLEMENT, lastValidatedAt };
}

// ─── Entitlement from RevenueCat CustomerInfo ─────────────

function entitlementFromCustomerInfo(customerInfo: any): Entitlement {
  const validatedAt = nowIso();

  try {
    const proEntitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

    if (!proEntitlement) {
      return freeEntitlement(validatedAt);
    }

    return {
      isPro: true,
      source: 'revenuecat',
      expiresAt: proEntitlement.expirationDate || null,
      productId: proEntitlement.productIdentifier || null,
      lastValidatedAt: validatedAt,
    };
  } catch {
    return freeEntitlement(validatedAt);
  }
}

// ─── Storage ──────────────────────────────────────────────

async function loadCachedEntitlement(): Promise<Entitlement> {
  try {
    if (isNativePlatform()) {
      const result = await Preferences.get({ key: ENTITLEMENT_STORAGE_KEY });
      if (result.value) {
        return JSON.parse(result.value) as Entitlement;
      }
    } else {
      const raw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as Entitlement;
      }
    }
  } catch { /* corrupt cache → default free */ }
  return { ...DEFAULT_ENTITLEMENT };
}

async function saveEntitlement(entitlement: Entitlement): Promise<void> {
  try {
    const serialized = JSON.stringify(entitlement);
    if (isNativePlatform()) {
      await Preferences.set({ key: ENTITLEMENT_STORAGE_KEY, value: serialized });
    } else {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEY, serialized);
    }
  } catch { /* non-fatal */ }
}

// ─── Notification ─────────────────────────────────────────

function notifyListeners(entitlement: Entitlement): void {
  for (const listener of updateListeners) {
    try { listener(entitlement); } catch { /* swallow */ }
  }
}

async function setEntitlementState(newEntitlement: Entitlement): Promise<void> {
  cachedEntitlement = newEntitlement;
  await saveEntitlement(newEntitlement);
  notifyListeners(newEntitlement);
}

// ─── Cache Validation ─────────────────────────────────────

function isCacheValid(ent: Entitlement): boolean {
  if (!ent.isPro) return true;

  const now = Date.now();
  const lastValidated = Date.parse(ent.lastValidatedAt);
  if (!Number.isFinite(lastValidated)) return false;
  if (now - lastValidated > CACHE_TTL_MS) return false;

  // Check expiration if set
  if (ent.expiresAt) {
    const expirationMs = Date.parse(ent.expiresAt);
    if (Number.isFinite(expirationMs) && expirationMs <= now) return false;
  }

  return true;
}

// ─── Web Entitlement Check (via Edge Function) ────────────

async function checkEntitlementViaAPI(_userId: string): Promise<Entitlement> {
  const validatedAt = nowIso();
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Get the user's JWT for authenticated edge function calls
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return freeEntitlement(validatedAt);

    const response = await fetch(`${supabaseUrl}/functions/v1/check-entitlement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      return freeEntitlement(validatedAt);
    }

    const data = await response.json();

    if (data.isPro) {
      return {
        isPro: true,
        source: 'revenuecat',
        expiresAt: data.expiresAt || null,
        productId: data.productId || null,
        lastValidatedAt: validatedAt,
      };
    }

    return freeEntitlement(validatedAt);
  } catch {
    return freeEntitlement(validatedAt);
  }
}

// ─── Initialization ───────────────────────────────────────

export async function initPurchases(appUserID?: string): Promise<void> {
  if (isInitialized) return;

  // Load cached entitlement (for instant UI while we validate)
  cachedEntitlement = await loadCachedEntitlement();

  // Invalidate cache if stale
  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    await setEntitlementState(freeEntitlement());
  }

  if (isNativePlatform()) {
    try {
      const mod = await import('@revenuecat/purchases-capacitor');
      purchasesSDK = mod.Purchases;

      await purchasesSDK.configure({
        apiKey: REVENUECAT_PUBLIC_KEY,
        appUserID: appUserID || undefined,
      });

      // Fetch entitlement from RevenueCat on launch
      await refreshEntitlementFromRC();

      // Listen for app resume
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }

      try {
        const { App } = await import('@capacitor/app');
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) revalidateOnResume();
        });
      } catch { /* @capacitor/app not available */ }

      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize RevenueCat SDK:', error);
      await setEntitlementState(freeEntitlement());
      isInitialized = true;
    }
  } else {
    // Web platform: check entitlement via REST API if we have a user ID
    if (appUserID) {
      const ent = await checkEntitlementViaAPI(appUserID);
      await setEntitlementState(ent);
    } else {
      await setEntitlementState(freeEntitlement());
    }

    // Listen for visibility changes to re-check on tab focus
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

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

  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    await setEntitlementState(freeEntitlement());
  }

  if (isNativePlatform() && purchasesSDK) {
    await refreshEntitlementFromRC();
  }
  // Web entitlement refresh is handled by forceRefreshEntitlement when needed
}

// ─── Core: Refresh from RevenueCat ────────────────────────

async function refreshEntitlementFromRC(): Promise<void> {
  if (!purchasesSDK) {
    await setEntitlementState(freeEntitlement());
    return;
  }

  try {
    const { customerInfo } = await purchasesSDK.getCustomerInfo();
    const ent = entitlementFromCustomerInfo(customerInfo);
    await setEntitlementState(ent);
  } catch {
    // Fail closed: can't reach RevenueCat → free
    await setEntitlementState(freeEntitlement());
  }
}

// ─── Identify User ───────────────────────────────────────

export async function identifyUser(appUserID: string): Promise<void> {
  if (isNativePlatform() && purchasesSDK) {
    try {
      const { customerInfo } = await purchasesSDK.logIn({ appUserID });
      const ent = entitlementFromCustomerInfo(customerInfo);
      await setEntitlementState(ent);
    } catch {
      // If login fails, try to get info anyway
      await refreshEntitlementFromRC();
    }
  } else if (!isNativePlatform()) {
    // Web: check entitlement via API
    const ent = await checkEntitlementViaAPI(appUserID);
    await setEntitlementState(ent);
  }
}

// ─── Products / Offerings ─────────────────────────────────

export async function getProducts(): Promise<{ monthly: ProductInfo | null; yearly: ProductInfo | null }> {
  if (!isNativePlatform() || !purchasesSDK) {
    return { monthly: null, yearly: null };
  }

  try {
    const { offerings } = await purchasesSDK.getOfferings();
    const current = offerings?.current;

    if (!current?.availablePackages?.length) {
      return { monthly: null, yearly: null };
    }

    let monthly: ProductInfo | null = null;
    let yearly: ProductInfo | null = null;

    for (const pkg of current.availablePackages) {
      const product = pkg.product;
      if (!product) continue;

      const info: ProductInfo = {
        id: product.identifier,
        title: product.title || 'Subscription',
        description: product.description || '',
        price: product.priceString || `$${product.price}`,
        priceValue: product.price || 0,
        currency: product.currencyCode || 'USD',
        introPrice: product.introPrice?.priceString,
        introPriceValue: product.introPrice?.price,
        rcPackage: pkg,
      };

      if (product.identifier === PRODUCT_IDS.MONTHLY || pkg.packageType === 'MONTHLY') {
        monthly = info;
      } else if (product.identifier === PRODUCT_IDS.YEARLY || pkg.packageType === 'ANNUAL') {
        yearly = info;
      }
    }

    return { monthly, yearly };
  } catch {
    return { monthly: null, yearly: null };
  }
}

// ─── Purchase (iOS) ──────────────────────────────────────

export async function purchase(productId: ProductId): Promise<PurchaseResult> {
  if (!isNativePlatform()) {
    return { status: 'failed', error: 'Native purchases are only available on iOS' };
  }
  if (!purchasesSDK) {
    return { status: 'failed', error: 'Purchases not initialized' };
  }

  try {
    // Get offerings to find the package
    const { offerings } = await purchasesSDK.getOfferings();
    const current = offerings?.current;

    if (!current?.availablePackages?.length) {
      return { status: 'failed', error: 'No packages available' };
    }

    const pkg = current.availablePackages.find(
      (p: any) => p.product?.identifier === productId
    );

    if (!pkg) {
      return { status: 'failed', error: 'Package not found' };
    }

    const { customerInfo } = await purchasesSDK.purchasePackage({ aPackage: pkg });
    const ent = entitlementFromCustomerInfo(customerInfo);
    await setEntitlementState(ent);

    return ent.isPro ? { status: 'success' } : { status: 'failed', error: 'Purchase completed but entitlement not active' };
  } catch (error: any) {
    if (error?.userCancelled || error?.code === 'PURCHASE_CANCELLED' || error?.message?.includes('cancel')) {
      return { status: 'cancelled' };
    }
    return { status: 'failed', error: error?.message || 'Purchase failed. Please try again.' };
  }
}

// ─── Purchase with Package directly ──────────────────────

export async function purchasePackage(rcPackage: any): Promise<PurchaseResult> {
  if (!isNativePlatform() || !purchasesSDK) {
    return { status: 'failed', error: 'Purchases not available' };
  }

  try {
    const { customerInfo } = await purchasesSDK.purchasePackage({ aPackage: rcPackage });
    const ent = entitlementFromCustomerInfo(customerInfo);
    await setEntitlementState(ent);
    return ent.isPro ? { status: 'success' } : { status: 'failed', error: 'Entitlement not active' };
  } catch (error: any) {
    if (error?.userCancelled || error?.code === 'PURCHASE_CANCELLED') {
      return { status: 'cancelled' };
    }
    return { status: 'failed', error: error?.message || 'Purchase failed' };
  }
}

// ─── Consumable Purchase (iOS) ───────────────────────────

export async function purchaseConsumable(productId: string): Promise<PurchaseResult> {
  if (!isNativePlatform()) {
    return { status: 'failed', error: 'Native purchases are only available on iOS' };
  }
  if (!purchasesSDK) {
    return { status: 'failed', error: 'Purchases not initialized' };
  }

  try {
    const { offerings } = await purchasesSDK.getOfferings();

    // Search all available offerings for the consumable product
    let targetPackage: any = null;

    // Check current offering first
    const current = offerings?.current;
    if (current?.availablePackages?.length) {
      targetPackage = current.availablePackages.find(
        (p: any) => p.product?.identifier === productId
      );
    }

    // Fall back to searching all offerings
    if (!targetPackage && offerings?.all) {
      for (const offering of Object.values(offerings.all) as any[]) {
        if (offering?.availablePackages?.length) {
          targetPackage = offering.availablePackages.find(
            (p: any) => p.product?.identifier === productId
          );
          if (targetPackage) break;
        }
      }
    }

    if (!targetPackage) {
      return { status: 'failed', error: 'Product not found' };
    }

    const { customerInfo } = await purchasesSDK.purchasePackage({ aPackage: targetPackage });

    // For consumables, customerInfo won't grant "pro" entitlement.
    // Return success so the caller can grant the one-time benefit.
    return { status: 'success' };
  } catch (error: any) {
    if (error?.userCancelled || error?.code === 'PURCHASE_CANCELLED' || error?.message?.includes('cancel')) {
      return { status: 'cancelled' };
    }
    return { status: 'failed', error: error?.message || 'Purchase failed. Please try again.' };
  }
}

// ─── Restore ──────────────────────────────────────────────

export async function restorePurchases(): Promise<RestoreResult> {
  if (!isNativePlatform() || !purchasesSDK) {
    return { status: 'failed', error: 'Restore is only available on iOS' };
  }

  try {
    const { customerInfo } = await purchasesSDK.restorePurchases();
    const ent = entitlementFromCustomerInfo(customerInfo);
    await setEntitlementState(ent);

    return ent.isPro
      ? { status: 'success' }
      : { status: 'failed', error: 'No active purchases found to restore.' };
  } catch (error: any) {
    return { status: 'failed', error: error?.message || 'Failed to restore purchases' };
  }
}

// ─── Web Purchase (Stripe via RevenueCat) ─────────────────

export async function getWebCheckoutUrl(_userId: string, plan: 'monthly' | 'yearly' = 'yearly'): Promise<string | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Get the user's JWT for authenticated edge function calls
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.url || null;
  } catch {
    return null;
  }
}

// ─── Getters / Listeners ─────────────────────────────────

export function getEntitlement(): Entitlement {
  // Always validate cache before returning — fail closed
  if (cachedEntitlement.isPro && !isCacheValid(cachedEntitlement)) {
    const free = freeEntitlement();
    cachedEntitlement = free;
    setEntitlementState(free);
    return free;
  }
  return { ...cachedEntitlement };
}

export async function forceRefreshEntitlement(userId?: string): Promise<Entitlement> {
  if (isNativePlatform() && purchasesSDK) {
    await refreshEntitlementFromRC();
  } else if (userId) {
    const ent = await checkEntitlementViaAPI(userId);
    await setEntitlementState(ent);
  } else {
    await setEntitlementState(freeEntitlement());
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
  if (isNativePlatform() && purchasesSDK) {
    try {
      await purchasesSDK.showManageSubscriptions();
    } catch {
      window.open('https://apps.apple.com/account/subscriptions', '_blank');
    }
  } else {
    // Web users subscribed via Stripe — open Stripe customer portal
    // Falls back to RevenueCat's management URL if available
    const portalUrl = await getWebManagementUrl();
    if (portalUrl) {
      window.open(portalUrl, '_blank');
    } else {
      // Last resort: generic Stripe billing portal
      window.open('https://billing.stripe.com/p/login/outsiderroyale', '_blank');
    }
  }
}

async function getWebManagementUrl(): Promise<string | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Get the user's JWT for authenticated edge function calls
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const response = await fetch(`${supabaseUrl}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.url || null;
  } catch {
    return null;
  }
}

// ─── Clear (for logout) ─────────────────────────────────

export async function clearEntitlement(): Promise<void> {
  await setEntitlementState(freeEntitlement());
  if (isNativePlatform() && purchasesSDK) {
    try {
      await purchasesSDK.logOut();
    } catch { /* non-fatal */ }
  }
}
