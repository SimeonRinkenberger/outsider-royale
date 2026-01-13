/**
 * Paywall Component
 * 
 * Shows subscription options with Apple-required disclosures.
 * Displays localized prices from StoreKit.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crown, Sparkles, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEntitlement, PRODUCT_IDS } from '@/contexts/EntitlementContext';
import { toast } from 'sonner';

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  trigger?: 'menu' | 'category' | 'settings';
}

const BENEFITS = [
  'All 8 word categories unlocked',
  '500+ extra words to play with',
  'New words added monthly',
  'Support indie development',
];

export function Paywall({ isOpen, onClose, trigger = 'menu' }: PaywallProps) {
  const {
    isPro,
    products,
    isLoadingProducts,
    purchase,
    restorePurchases,
    canPurchase,
    isLoading,
  } = useEntitlement();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handlePurchase = async () => {
    if (!canPurchase) {
      toast.error('Purchases are only available on iOS devices');
      return;
    }

    const productId = selectedPlan === 'monthly' 
      ? PRODUCT_IDS.MONTHLY 
      : PRODUCT_IDS.YEARLY;

    setIsPurchasing(true);
    try {
      const result = await purchase(productId);
      
      if (result.status === 'success') {
        toast.success('Welcome to Outsider Royale Pro! 🎉');
        onClose();
      } else if (result.status === 'cancelled') {
        // User cancelled - no message needed
      } else {
        toast.error(result.error || 'Purchase failed. Please try again.');
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!canPurchase) {
      toast.error('Restore is only available on iOS devices');
      return;
    }

    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      
      if (result.status === 'success') {
        toast.success('Purchases restored successfully!');
        onClose();
      } else {
        toast.error(result.error || 'No previous purchases found.');
      }
    } catch (error) {
      toast.error('Failed to restore purchases.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Calculate savings
  const monthlyPrice = products.monthly?.priceValue || 2.99;
  const yearlyPrice = products.yearly?.priceValue || 14.99;
  const yearlySavings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  // If already Pro, show success state
  if (isPro) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="p-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-full flex items-center justify-center">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold">You're Pro!</h2>
                <p className="text-muted-foreground">
                  You have full access to all categories and words.
                </p>
                <Button onClick={onClose} className="w-full">
                  Continue Playing
                </Button>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

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
            <Card className="m-4 p-6 space-y-6 rounded-t-3xl sm:rounded-3xl">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="text-center space-y-2 pt-2">
                <div className="w-16 h-16 mx-auto bg-gradient-primary rounded-2xl flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Go Pro</h2>
                <p className="text-muted-foreground">
                  Unlock the full Outsider Royale experience
                </p>
              </div>

              {/* Benefits */}
              <div className="space-y-3">
                {BENEFITS.map((benefit, index) => (
                  <motion.div
                    key={benefit}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm">{benefit}</span>
                  </motion.div>
                ))}
              </div>

              {/* Plan selection */}
              {isLoadingProducts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Monthly */}
                  <button
                    onClick={() => setSelectedPlan('monthly')}
                    className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                      selectedPlan === 'monthly'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-semibold">Monthly</p>
                      <p className="text-2xl font-bold">
                        {products.monthly?.price || '$2.99'}
                      </p>
                      <p className="text-xs text-muted-foreground">per month</p>
                    </div>
                    {products.monthly?.introPrice && (
                      <div className="mt-2 text-xs text-primary">
                        First month: {products.monthly.introPrice}
                      </div>
                    )}
                  </button>

                  {/* Yearly */}
                  <button
                    onClick={() => setSelectedPlan('yearly')}
                    className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                      selectedPlan === 'yearly'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {yearlySavings > 0 && (
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                        Save {yearlySavings}%
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="font-semibold">Yearly</p>
                      <p className="text-2xl font-bold">
                        {products.yearly?.price || '$14.99'}
                      </p>
                      <p className="text-xs text-muted-foreground">per year</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Subscribe button */}
              <Button
                onClick={handlePurchase}
                disabled={isPurchasing || isLoading || !canPurchase}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
              >
                {isPurchasing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Crown className="h-5 w-5 mr-2" />
                    Subscribe {selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'}
                  </>
                )}
              </Button>

              {/* Restore */}
              <button
                onClick={handleRestore}
                disabled={isRestoring || !canPurchase}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {isRestoring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Restore Purchases
              </button>

              {/* Apple-required legal text */}
              <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
                <p>
                  Payment will be charged to your Apple ID account at the confirmation of purchase.
                  Subscription automatically renews unless it is canceled at least 24 hours before
                  the end of the current period. Your account will be charged for renewal within 24
                  hours prior to the end of the current period.
                </p>
                <p>
                  You can manage and cancel your subscriptions by going to your App Store account
                  settings after purchase.
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
                  Subscriptions are only available on iOS devices.
                  Please open Outsider Royale on your iPhone to subscribe.
                </div>
              )}
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Paywall;
