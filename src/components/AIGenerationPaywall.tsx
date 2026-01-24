/**
 * AI Generation Paywall
 * 
 * Shows when user has exhausted free AI generations.
 * Offers Pro subscription or single generation purchase.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Crown, Zap, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEntitlement, PRODUCT_IDS } from '@/contexts/EntitlementContext';
import { toast } from 'sonner';

// Product ID for consumable AI generation
export const AI_GENERATION_PRODUCT_ID = 'outsider_royale_ai_generation';

interface AIGenerationPaywallProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete?: () => void;
}

export function AIGenerationPaywall({ 
  isOpen, 
  onClose,
  onPurchaseComplete,
}: AIGenerationPaywallProps) {
  const {
    products,
    isLoadingProducts,
    purchase,
    canPurchase,
    isLoading,
  } = useEntitlement();

  const [isPurchasingPro, setIsPurchasingPro] = useState(false);
  const [isPurchasingSingle, setIsPurchasingSingle] = useState(false);

  const handlePurchasePro = async () => {
    if (!canPurchase) {
      toast.error('Purchases are only available on iOS devices');
      return;
    }

    setIsPurchasingPro(true);
    try {
      const result = await purchase(PRODUCT_IDS.YEARLY);
      
      if (result.status === 'success') {
        toast.success('Welcome to Pro! Unlimited AI generations unlocked! 🎉');
        onPurchaseComplete?.();
        onClose();
      } else if (result.status === 'cancelled') {
        // User cancelled
      } else {
        toast.error(result.error || 'Purchase failed. Please try again.');
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsPurchasingPro(false);
    }
  };

  const handlePurchaseSingle = async () => {
    if (!canPurchase) {
      toast.error('Purchases are only available on iOS devices');
      return;
    }

    setIsPurchasingSingle(true);
    try {
      // For consumable purchase, we would use a different flow
      // For now, show that this feature is coming
      toast.info('Single generation purchase coming soon! Get Pro for unlimited access.');
      
      // TODO: Implement consumable purchase when StoreKit consumable is set up
      // const result = await purchaseConsumable(AI_GENERATION_PRODUCT_ID);
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsPurchasingSingle(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="m-4 p-6 space-y-5 rounded-t-3xl sm:rounded-3xl">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="text-center space-y-2 pt-2">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold">AI Generation Limit Reached</h2>
                <p className="text-sm text-muted-foreground">
                  You've used your 2 free AI category generations
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {/* Pro option */}
                <button
                  onClick={handlePurchasePro}
                  disabled={isPurchasingPro || isLoading || !canPurchase}
                  className="w-full p-4 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all text-left relative"
                >
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                    Best Value
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Crown className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Go Pro</p>
                      <p className="text-sm text-muted-foreground">
                        Unlimited AI generations + all categories
                      </p>
                      <p className="text-lg font-bold text-primary mt-1">
                        {isLoadingProducts ? '...' : (products.yearly?.price || '$14.99')}/year
                      </p>
                    </div>
                    {isPurchasingPro && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                  </div>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t" />
                </div>

                {/* Single generation option */}
                <button
                  onClick={handlePurchaseSingle}
                  disabled={isPurchasingSingle || isLoading || !canPurchase}
                  className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Zap className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Single Generation</p>
                      <p className="text-sm text-muted-foreground">
                        Generate one AI category
                      </p>
                      <p className="text-lg font-bold mt-1">$0.99</p>
                    </div>
                    {isPurchasingSingle && (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    )}
                  </div>
                </button>
              </div>

              {/* Legal text */}
              <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
                <p>
                  Payment will be charged to your Apple ID account at the confirmation of purchase.
                </p>
                <div className="flex gap-4 pt-1">
                  <a
                    href="https://www.notion.so/Privacy-Policy-Outsider-Royale-2da1f594451b80d4a04bd700a4c35418"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Terms of Use
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Platform warning */}
              {!canPurchase && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg text-center">
                  Purchases are only available on iOS devices.
                  Please open Outsider Royale on your iPhone.
                </div>
              )}
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AIGenerationPaywall;
