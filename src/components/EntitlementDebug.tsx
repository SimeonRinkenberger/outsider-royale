/**
 * EntitlementDebug Component
 * 
 * Development-only debug panel for entitlement state.
 * Shows current state and allows testing.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { ChevronDown, ChevronUp, RefreshCw, Bug } from 'lucide-react';

export function EntitlementDebug() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    isPro, 
    entitlement, 
    isLoading, 
    products, 
    canPurchase,
    isIOSNative,
    refreshEntitlement,
    debug 
  } = useEntitlement();

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleForceToggle = async () => {
    if (debug?.forceSetPro) {
      await debug.forceSetPro(!isPro);
    }
  };

  const handleRefresh = async () => {
    await refreshEntitlement();
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 left-4 z-50 p-2 rounded-full bg-yellow-500 text-yellow-900 shadow-lg hover:bg-yellow-400 transition-colors"
        title="Open Entitlement Debug"
      >
        <Bug className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 z-50 p-4 w-80 shadow-xl bg-card border-yellow-500/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-yellow-500" />
          <h3 className="font-semibold text-sm">Entitlement Debug</h3>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-muted rounded"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Pro Status:</span>
          <span className={isPro ? 'text-green-500 font-semibold' : 'text-red-500'}>
            {isPro ? 'ACTIVE' : 'FREE'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Platform:</span>
          <span>{isIOSNative ? 'iOS Native' : 'Web/Other'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Can Purchase:</span>
          <span className={canPurchase ? 'text-green-500' : 'text-muted-foreground'}>
            {canPurchase ? 'Yes' : 'No'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Source:</span>
          <span>{entitlement.source}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Expires:</span>
          <span>{entitlement.expiresAt || 'N/A'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last Checked:</span>
          <span className="truncate max-w-[120px]">
            {entitlement.lastCheckedAt 
              ? new Date(entitlement.lastCheckedAt).toLocaleTimeString()
              : 'Never'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Loading:</span>
          <span>{isLoading ? 'Yes' : 'No'}</span>
        </div>

        {/* Products */}
        <div className="border-t pt-2">
          <p className="text-muted-foreground mb-1">Products:</p>
          <div className="pl-2 space-y-1">
            <div className="flex justify-between">
              <span>Monthly:</span>
              <span>{products.monthly?.price || 'Not loaded'}</span>
            </div>
            <div className="flex justify-between">
              <span>Yearly:</span>
              <span>{products.yearly?.price || 'Not loaded'}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="flex-1 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant={isPro ? 'destructive' : 'default'}
            onClick={handleForceToggle}
            className="flex-1 text-xs"
          >
            {isPro ? 'Force Free' : 'Force Pro'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default EntitlementDebug;
