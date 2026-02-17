/**
 * EntitlementContext
 * 
 * Single source of truth for user entitlement (Pro) status.
 * Fail-closed: defaults to free on any error or stale cache.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { syncCategories } from '@/lib/categoryCache';
import {
  initPurchases,
  getEntitlement,
  purchase,
  restorePurchases,
  forceRefreshEntitlement,
  onEntitlementUpdate,
  getProducts,
  openSubscriptionManagement,
  isIOSNative,
  debugPurchases,
  type Entitlement,
  type ProductInfo,
  type PurchaseResult,
  type RestoreResult,
  type ProductId,
  PRODUCT_IDS,
} from '@/services/purchases/applePurchases';

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
  restorePurchases: () => Promise<RestoreResult>;
  refreshEntitlement: () => Promise<void>;
  openManageSubscription: () => Promise<void>;
  canPurchase: boolean;
  isIOSNative: boolean;
  debug?: typeof debugPurchases;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
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
        await initPurchases();
        
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
    const newEntitlement = await forceRefreshEntitlement();
    setEntitlement(newEntitlement);
  }, []);

  const value: EntitlementContextValue = {
    isPro: entitlement.isPro,
    entitlement,
    isLoading,
    products,
    isLoadingProducts,
    purchase: handlePurchase,
    restorePurchases: handleRestore,
    refreshEntitlement: handleRefresh,
    openManageSubscription: openSubscriptionManagement,
    canPurchase: isIOSNative(),
    isIOSNative: isIOSNative(),
    debug: process.env.NODE_ENV !== 'production' ? debugPurchases : undefined,
  };

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
