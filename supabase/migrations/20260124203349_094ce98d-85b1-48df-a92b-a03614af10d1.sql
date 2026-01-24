-- Add AI generation usage tracking to user_entitlements
ALTER TABLE public.user_entitlements 
ADD COLUMN IF NOT EXISTS ai_generations_used INTEGER NOT NULL DEFAULT 0;

-- Create function to increment AI generation usage
CREATE OR REPLACE FUNCTION public.increment_ai_generation_usage(p_user_id UUID)
RETURNS TABLE(
  ai_generations_used INTEGER,
  is_pro BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ai_generations_used INTEGER;
  v_is_pro BOOLEAN;
BEGIN
  -- Check if user has entitlement record
  SELECT 
    COALESCE(ue.ai_generations_used, 0) + 1,
    COALESCE(ue.is_active AND (ue.expires_at IS NULL OR ue.expires_at > NOW()), FALSE)
  INTO v_ai_generations_used, v_is_pro
  FROM public.user_entitlements ue
  WHERE ue.user_id = p_user_id
  LIMIT 1;

  -- If no record exists, create one with usage = 1
  IF v_ai_generations_used IS NULL THEN
    INSERT INTO public.user_entitlements (user_id, product_id, is_active, ai_generations_used)
    VALUES (p_user_id, gen_random_uuid(), FALSE, 1)
    ON CONFLICT (user_id) DO UPDATE SET ai_generations_used = user_entitlements.ai_generations_used + 1;
    
    v_ai_generations_used := 1;
    v_is_pro := FALSE;
  ELSE
    -- Increment usage
    UPDATE public.user_entitlements
    SET ai_generations_used = v_ai_generations_used,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_ai_generations_used, v_is_pro;
END;
$$;

-- Create function to check AI generation entitlement
CREATE OR REPLACE FUNCTION public.check_ai_generation_entitlement(p_user_id UUID)
RETURNS TABLE(
  can_generate BOOLEAN,
  is_pro BOOLEAN,
  ai_generations_used INTEGER,
  free_generations_remaining INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ai_generations_used INTEGER DEFAULT 0;
  v_is_pro BOOLEAN DEFAULT FALSE;
  v_free_limit INTEGER DEFAULT 2;
BEGIN
  -- Get user's current state
  SELECT 
    COALESCE(ue.ai_generations_used, 0),
    COALESCE(ue.is_active AND (ue.expires_at IS NULL OR ue.expires_at > NOW()), FALSE)
  INTO v_ai_generations_used, v_is_pro
  FROM public.user_entitlements ue
  WHERE ue.user_id = p_user_id
  LIMIT 1;

  RETURN QUERY SELECT 
    (v_ai_generations_used < v_free_limit OR v_is_pro) AS can_generate,
    v_is_pro,
    v_ai_generations_used,
    GREATEST(0, v_free_limit - v_ai_generations_used) AS free_generations_remaining;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_ai_generation_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_generation_entitlement(UUID) TO authenticated;