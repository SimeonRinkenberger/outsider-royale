-- Create enum for product types
CREATE TYPE public.product_type AS ENUM ('consumable', 'non_consumable', 'subscription');

-- Create enum for purchase platforms
CREATE TYPE public.purchase_platform AS ENUM ('ios', 'android', 'web');

-- Create products table
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_key TEXT NOT NULL UNIQUE, -- e.g., 'premium_categories', 'ad_free'
    name TEXT NOT NULL,
    description TEXT,
    product_type product_type NOT NULL,
    price_tier INTEGER NOT NULL DEFAULT 1, -- For App Store price tiers
    ios_product_id TEXT, -- App Store product ID
    android_product_id TEXT, -- Google Play product ID
    stripe_price_id TEXT, -- Stripe price ID
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_entitlements table
CREATE TABLE public.user_entitlements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for non-consumables (permanent)
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- Create purchase_history table
CREATE TABLE public.purchase_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    platform purchase_platform NOT NULL,
    transaction_id TEXT, -- Platform-specific transaction ID
    receipt_data TEXT, -- Encrypted receipt for validation
    amount_cents INTEGER, -- Actual amount paid in cents
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, refunded, failed
    purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;

-- Products: Anyone can view active products
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT
USING (is_active = true);

-- User entitlements: Users can only view their own
CREATE POLICY "Users can view their own entitlements"
ON public.user_entitlements FOR SELECT
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));

-- Purchase history: Users can only view their own
CREATE POLICY "Users can view their own purchase history"
ON public.purchase_history FOR SELECT
USING (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));

-- Create helper function to check entitlement
CREATE OR REPLACE FUNCTION public.check_user_entitlement(p_user_id UUID, p_product_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_entitlements ue
        JOIN public.products p ON ue.product_id = p.id
        WHERE ue.user_id = p_user_id
          AND p.product_key = p_product_key
          AND ue.is_active = true
          AND (ue.expires_at IS NULL OR ue.expires_at > now())
    )
$$;

-- Create function to grant entitlement (called by edge functions after validation)
CREATE OR REPLACE FUNCTION public.grant_entitlement(
    p_user_id UUID,
    p_product_id UUID,
    p_duration_days INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_entitlement_id UUID;
BEGIN
    -- Calculate expiration if duration provided
    IF p_duration_days IS NOT NULL THEN
        v_expires_at := now() + (p_duration_days || ' days')::INTERVAL;
    END IF;
    
    -- Upsert entitlement
    INSERT INTO public.user_entitlements (user_id, product_id, is_active, expires_at)
    VALUES (p_user_id, p_product_id, true, v_expires_at)
    ON CONFLICT (user_id, product_id)
    DO UPDATE SET
        is_active = true,
        expires_at = COALESCE(v_expires_at, user_entitlements.expires_at),
        updated_at = now()
    RETURNING id INTO v_entitlement_id;
    
    RETURN v_entitlement_id;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_entitlements_updated_at
BEFORE UPDATE ON public.user_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();