-- Grant lifetime pro subscription to swimdog (admin override)
-- This migration:
--   1. Ensures a 'premium_subscription' product row exists
--   2. Grants lifetime pro to the profile with display_name = 'swimdog'

-- 1. Seed the premium subscription product if missing
INSERT INTO public.products (product_key, name, description, product_type, price_tier)
VALUES ('premium_subscription', 'Premium Subscription', 'Outsider Royale Premium – full access', 'subscription', 1)
ON CONFLICT (product_key) DO NOTHING;

-- 2. Grant lifetime entitlement (expires_at = NULL → never expires)
INSERT INTO public.user_entitlements (user_id, product_id, is_active, expires_at)
SELECT p.id, prod.id, true, NULL
FROM public.profiles p
CROSS JOIN public.products prod
WHERE LOWER(p.display_name) = LOWER('swimdog')
  AND prod.product_key = 'premium_subscription'
ON CONFLICT (user_id, product_id) DO UPDATE
SET is_active  = true,
    expires_at = NULL,
    updated_at = now();
