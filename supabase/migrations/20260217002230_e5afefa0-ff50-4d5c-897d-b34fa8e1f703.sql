
-- Phase 2+3: DB migration for identity model, RLS hardening, and RPCs

-- 1. Unique partial index on profiles.auth_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_auth_user_id_unique
  ON public.profiles (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 2. RPC: get_or_create_profile (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_or_create_profile(
  p_display_name text DEFAULT NULL,
  p_is_guest boolean DEFAULT true
)
RETURNS TABLE(
  profile_id uuid,
  profile_display_name text,
  profile_is_guest boolean,
  profile_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Try existing profile
  RETURN QUERY
  SELECT p.id, p.display_name, p.is_guest, p.avatar_url
  FROM profiles p
  WHERE p.auth_user_id = v_uid
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Need display name for new profile
  IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
    RAISE EXCEPTION 'Display name required for new profile';
  END IF;

  -- Create new profile
  RETURN QUERY
  INSERT INTO profiles (display_name, auth_user_id, is_guest)
  VALUES (trim(p_display_name), v_uid, p_is_guest)
  RETURNING profiles.id, profiles.display_name, profiles.is_guest, profiles.avatar_url;
END;
$$;

-- 3. Tighten profiles INSERT policy: must set auth_user_id = auth.uid()
DROP POLICY IF EXISTS "insert_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- 4. Restrict words SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view words" ON public.words;
CREATE POLICY "authenticated_view_words" ON public.words
  FOR SELECT TO authenticated
  USING (true);

-- 5. Restrict categories SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "authenticated_view_categories" ON public.categories
  FOR SELECT TO authenticated
  USING (true);

-- 6. Update claim_profile to handle anonymous→email upgrade
CREATE OR REPLACE FUNCTION public.claim_profile(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_claimed uuid;
BEGIN
  -- If auth user already owns a profile, return that
  SELECT id INTO v_existing FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Try to claim the specified profile (only unclaimed ones for security)
  UPDATE profiles SET auth_user_id = auth.uid(), is_guest = false
  WHERE id = p_profile_id AND auth_user_id IS NULL
  RETURNING id INTO v_claimed;

  RETURN v_claimed;
END;
$$;
