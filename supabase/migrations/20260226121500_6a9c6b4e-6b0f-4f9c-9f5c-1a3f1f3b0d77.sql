-- Security hardening for entitlement/RLS paths.
-- Addresses:
-- 1) Privilege escalation via SECURITY DEFINER entitlement RPCs
-- 2) IDOR on profile/lobby/lobby_players mutations

-- ---------------------------------------------------------------------------
-- Restrict SECURITY DEFINER entitlement/usage functions to service_role only
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.grant_entitlement(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_entitlement(UUID, UUID, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_user_entitlement(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_entitlement(UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_ai_generation_usage(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_generation_usage(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_ai_generation_entitlement(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_generation_entitlement(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Tighten profiles UPDATE policy to caller-owned profile only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tighten lobbies UPDATE/DELETE to lobby host (mapped from auth.uid)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can update lobbies" ON public.lobbies;
DROP POLICY IF EXISTS "Anyone can delete lobbies" ON public.lobbies;
DROP POLICY IF EXISTS "Host can update their lobby" ON public.lobbies;
DROP POLICY IF EXISTS "Host can delete their lobby" ON public.lobbies;

CREATE POLICY "Host can update their lobby"
ON public.lobbies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = lobbies.host_user_id
      AND p.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = lobbies.host_user_id
      AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Host can delete their lobby"
ON public.lobbies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = lobbies.host_user_id
      AND p.auth_user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Tighten lobby_players INSERT/UPDATE/DELETE to self or lobby host
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can join lobbies" ON public.lobby_players;
DROP POLICY IF EXISTS "Players can update their own status" ON public.lobby_players;
DROP POLICY IF EXISTS "Players can leave lobbies" ON public.lobby_players;

CREATE POLICY "Players can join lobbies"
ON public.lobby_players
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = lobby_players.user_id
      AND p.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Players or host can update lobby players"
ON public.lobby_players
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = lobby_players.user_id
      AND p.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.lobbies l
    JOIN public.profiles hp ON hp.id = l.host_user_id
    WHERE l.id = lobby_players.lobby_id
      AND hp.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = lobby_players.user_id
      AND p.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.lobbies l
    JOIN public.profiles hp ON hp.id = l.host_user_id
    WHERE l.id = lobby_players.lobby_id
      AND hp.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Players or host can delete lobby players"
ON public.lobby_players
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = lobby_players.user_id
      AND p.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.lobbies l
    JOIN public.profiles hp ON hp.id = l.host_user_id
    WHERE l.id = lobby_players.lobby_id
      AND hp.auth_user_id = auth.uid()
  )
);
