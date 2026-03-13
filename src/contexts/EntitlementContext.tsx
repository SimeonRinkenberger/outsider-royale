/**
 * EntitlementContext
 * 
 * Single source of truth for user entitlement (Pro) status.
 * Uses RevenueCat as the authoritative backend for both iOS and web.
 * Fail-closed: defaults to free on any error or stale cache.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { syncCategories } from '@/lib/categoryCache';
import { useAuth } from '@/contexts/AuthContext';
import {
  initPurchases,
  identifyUser,
  getEntitlement,
  purchase,
  purchaseConsumable,
  restorePurchases,
  forceRefreshEntitlement,
  onEntitlementUpdate,
  getProducts,
  openSubscriptionManagement,
  getWebCheckoutUrl,
  isIOSNative,
  clearEntitlement,
  type Entitlement,
  type ProductInfo,
  type PurchaseResult,
  type RestoreResult,
  type ProductId,
  PRODUCT_IDS,
} from '@/services/purchases/purchaseService';

interface EntitlementContextValue {
  isPro: boolean;
  entitlement: Entitlement;
  isLoading: boolean;
  products: {
    monthly: ProductInfo | null;
    yearly: ProductInfo | null;
  };
  isLoadingProducts: boolean;
  purchase: (productId: ProductId) => Promise<PurchaseResult>;
  purchaseConsumable: (productId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<RestoreResult>;
  refreshEntitlement: () => Promise<void>;
  openManageSubscription: () => Promise<void>;
  openWebCheckout: (plan?: 'monthly' | 'yearly') => Promise<void>;
  canPurchase: boolean;
  canWebPurchase: boolean;
  isIOSNative: boolean;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const { profileId } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement>(getEntitlement());
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<{ monthly: ProductInfo | null; yearly: ProductInfo | null }>({
    monthly: null,
    yearly: null,
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // Initialize with user ID for RevenueCat identification
        await initPurchases(profileId || undefined);
        
        if (mounted) {
          const currentEntitlement = getEntitlement();
          setEntitlement(currentEntitlement);
          setIsLoading(false);
          syncCategories(currentEntitlement.isPro);
        }

        try {
          const loadedProducts = await getProducts();
          if (mounted) setProducts(loadedProducts);
        } catch { /* non-fatal */ }
        
        if (mounted) setIsLoadingProducts(false);
      } catch {
        if (mounted) {
          setIsLoading(false);
          setIsLoadingProducts(false);
        }
      }
    };

    init();

    // Subscribe to updates from the purchase service
    const unsubscribe = onEntitlementUpdate((newEntitlement) => {
      if (mounted) {
        setEntitlement(newEntitlement);
        syncCategories(newEntitlement.isPro);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // When user profile changes, identify with RevenueCat
  useEffect(() => {
    if (profileId) {
      identifyUser(profileId).catch(() => {
        // Non-fatal: entitlement will be checked on next refresh
      });
    }
  }, [profileId]);

  const handlePurchase = useCallback(async (productId: ProductId): Promise<PurchaseResult> => {
    setIsLoading(true);
    try {
      const result = await purchase(productId);
      setEntitlement(getEntitlement());
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePurchaseConsumable = useCallback(async (productId: string): Promise<PurchaseResult> => {
    setIsLoading(true);
    try {
      const result = await purchaseConsumable(productId);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRestore = useCallback(async (): Promise<RestoreResult> => {
    setIsLoading(true);
    try {
      const result = await restorePurchases();
      setEntitlement(getEntitlement());
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async (): Promise<void> => {
    const newEntitlement = await forceRefreshEntitlement(profileId || undefined);
    setEntitlement(newEntitlement);
  }, [profileId]);

  const handleWebCheckout = useCallback(async (plan: 'monthly' | 'yearly' = 'yearly'): Promise<void> => {
    if (!profileId) throw new Error('Please sign in to subscribe.');
    const url = await getWebCheckoutUrl(profileId, plan);
    window.open(url, '_blank');
  }, [profileId]);

  const isPro = entitlement.isPro;
  const canPurchase = isIOSNative();
  const canWebPurchase = !isIOSNative() && !!profileId;
  const isIOSNativeVal = isIOSNative();

  const value = useMemo<EntitlementContextValue>(() => ({
    isPro,
    entitlement,
    isLoading,
    products,
    isLoadingProducts,
    purchase: handlePurchase,
    purchaseConsumable: handlePurchaseConsumable,
    restorePurchases: handleRestore,
    refreshEntitlement: handleRefresh,
    openManageSubscription: openSubscriptionManagement,
    openWebCheckout: handleWebCheckout,
    canPurchase,
    canWebPurchase,
    isIOSNative: isIOSNativeVal,
  }), [isPro, entitlement, isLoading, products, isLoadingProducts, handlePurchase, handlePurchaseConsumable, handleRestore, handleRefresh, openSubscriptionManagement, handleWebCheckout, canPurchase, canWebPurchase, isIOSNativeVal]);

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement(): EntitlementContextValue {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error('useEntitlement must be used within EntitlementProvider');
  }
  return context;
}

export { PRODUCT_IDS, type ProductId, type Entitlement, type ProductInfo };
