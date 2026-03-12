import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useEntitlement } from '@/contexts/EntitlementContext';

/**
 * Handles ?checkout=success and ?checkout=cancel query params
 * after Stripe redirects the user back to the app.
 */
export function CheckoutRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshEntitlement } = useEntitlement();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutStatus = params.get('checkout');

    if (!checkoutStatus) return;

    if (checkoutStatus === 'success') {
      toast.success('Payment successful! 🎉', {
        description: 'Your Pro subscription is being activated. This may take a moment.',
        duration: 6000,
      });
      // Force-refresh entitlement to pick up the new subscription
      refreshEntitlement();
    } else if (checkoutStatus === 'cancel') {
      toast.info('Checkout cancelled', {
        description: 'No charges were made. You can subscribe anytime from the menu.',
        duration: 4000,
      });
    }

    // Clean up the query params from the URL without triggering a navigation
    params.delete('checkout');
    const cleanSearch = params.toString();
    const cleanPath = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    navigate(cleanPath, { replace: true });
  }, [location.search, location.pathname, navigate, refreshEntitlement]);

  return null;
}
