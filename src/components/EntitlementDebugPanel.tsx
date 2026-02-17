/**
 * Dev-only Entitlement Debug Panel
 * 
 * Shows raw entitlement state for on-device verification.
 * Only rendered in development builds.
 */

import React, { useState, useEffect } from 'react';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { isIOSNative } from '@/services/purchases/applePurchases';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bug, RefreshCw, X } from 'lucide-react';

export function EntitlementDebugPanel() {
  const { entitlement, isPro, refreshEntitlement, debug } = useEntitlement();
  const [debugState, setDebugState] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  // Secret gesture: tap version text 5 times to open
  useEffect(() => {
    if (tapCount >= 5) {
      setIsOpen(true);
      setTapCount(0);
    }
    const timer = setTimeout(() => setTapCount(0), 2000);
    return () => clearTimeout(timer);
  }, [tapCount]);

  const refresh = async () => {
    await refreshEntitlement();
    if (debug) setDebugState(debug.getState());
  };

  useEffect(() => {
    if (isOpen && debug) setDebugState(debug.getState());
  }, [isOpen, debug, entitlement]);

  if (process.env.NODE_ENV === 'production') return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setTapCount(c => c + 1)}
        className="text-xs text-muted-foreground/30 select-none"
      >
        v1.0
      </button>
    );
  }

  const now = Date.now();
  const lastValidated = new Date(entitlement.lastValidatedAt).getTime();
  const timeSinceValidation = Math.round((now - lastValidated) / 1000);
  const expiresIn = entitlement.expiresAt
    ? Math.round((new Date(entitlement.expiresAt).getTime() - now) / 1000)
    : null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-[100] p-4 bg-background/95 backdrop-blur border-destructive/50 text-xs space-y-2 max-h-[50vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 font-bold text-sm">
          <Bug className="h-4 w-4" />
          Entitlement Debug
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <table className="w-full text-left">
        <tbody className="divide-y divide-border">
          <Row label="Platform" value={isIOSNative() ? 'iOS Native' : 'Web'} />
          <Row label="isPro" value={String(isPro)} highlight={isPro ? 'text-green-500' : 'text-red-500'} />
          <Row label="Source" value={entitlement.source} />
          <Row label="Product" value={entitlement.productId || '—'} />
          <Row label="Expires At" value={entitlement.expiresAt || '—'} />
          <Row label="Expires In" value={expiresIn !== null ? `${expiresIn}s` : '—'} highlight={expiresIn !== null && expiresIn < 0 ? 'text-red-500' : undefined} />
          <Row label="Last Validated" value={`${timeSinceValidation}s ago`} highlight={timeSinceValidation > 1800 ? 'text-red-500' : undefined} />
          {debugState && (
            <>
              <Row label="Cache Valid" value={String(debugState.cacheValid)} highlight={debugState.cacheValid ? 'text-green-500' : 'text-red-500'} />
              <Row label="Plugin Loaded" value={String(debugState.hasPlugin)} />
              <Row label="Initialized" value={String(debugState.isInitialized)} />
            </>
          )}
        </tbody>
      </table>

      <Button variant="outline" size="sm" className="w-full" onClick={refresh}>
        <RefreshCw className="h-3 w-3 mr-1" />
        Force Revalidate
      </Button>
    </Card>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <tr>
      <td className="py-1 pr-2 font-medium text-muted-foreground">{label}</td>
      <td className={`py-1 font-mono ${highlight || ''}`}>{value}</td>
    </tr>
  );
}
