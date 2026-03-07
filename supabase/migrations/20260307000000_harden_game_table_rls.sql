-- Security hardening for game-state table RLS policies.
-- Addresses overly permissive INSERT/UPDATE policies on games, rounds, clues, votes.
--
-- Strategy:
--   - SELECT stays open (all players need to see game state for realtime)
--   - INSERT/UPDATE restricted to lobby participants (via lobby_players → profiles → auth.uid())
--   - clues: only the player themselves can submit their own clue
--   - votes: only the voter themselves can cast their own vote
--   - games: only lobby participants can create/update games for their lobby
--   - rounds: only lobby participants can create/update rounds for their game

-- ─── Helper: Check if caller is a participant in a given lobby ───
-- This avoids repeating the same sub-query across multiple policies.
CREATE OR REPLACE FUNCTION public.is_lobby_participant(p_lobby_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM lobby_players lp
    JOIN profiles p ON p.id = lp.user_id
    WHERE lp.lobby_id = p_lobby_id
      AND p.auth_user_id = auth.uid()
  );
$$;

-- Restrict to authenticated + service_role (not anon/public)
REVOKE EXECUTE ON FUNCTION public.is_lobby_participant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lobby_participant(UUID) TO authenticated, service_role;

-- ═══════════════════════════════════════════════════════════
-- GAMES
-- ═══════════════════════════════════════════════════════════

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;
DROP POLICY IF EXISTS "Anyone can update games" ON public.games;

-- Only lobby participants can create games for their lobby
CREATE POLICY "Lobby participants can create games"
ON public.games
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_lobby_participant(lobby_id)
);

-- Only lobby participants can update their game
CREATE POLICY "Lobby participants can update games"
ON public.games
FOR UPDATE
TO authenticated
USING (
  public.is_lobby_participant(lobby_id)
);

-- ═══════════════════════════════════════════════════════════
-- ROUNDS
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can create rounds" ON public.rounds;
DROP POLICY IF EXISTS "Anyone can update rounds" ON public.rounds;

-- Only participants of the game's lobby can create rounds
CREATE POLICY "Lobby participants can create rounds"
ON public.rounds
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM games g
    WHERE g.id = rounds.game_id
      AND public.is_lobby_participant(g.lobby_id)
  )
);

-- Only participants can update rounds
CREATE POLICY "Lobby participants can update rounds"
ON public.rounds
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM games g
    WHERE g.id = rounds.game_id
      AND public.is_lobby_participant(g.lobby_id)
  )
);

-- ═══════════════════════════════════════════════════════════
-- CLUES
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can submit clues" ON public.clues;

-- Players can only submit clues as themselves
CREATE POLICY "Players can submit own clues"
ON public.clues
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM lobby_players lp
    JOIN profiles p ON p.id = lp.user_id
    WHERE lp.id = clues.player_id
      AND p.auth_user_id = auth.uid()
  )
);

-- ═══════════════════════════════════════════════════════════
-- VOTES
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can cast votes" ON public.votes;

-- Players can only cast votes as themselves
CREATE POLICY "Players can cast own votes"
ON public.votes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM lobby_players lp
    JOIN profiles p ON p.id = lp.user_id
    WHERE lp.id = votes.voter_player_id
      AND p.auth_user_id = auth.uid()
  )
);
