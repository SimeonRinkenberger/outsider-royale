
-- ================================================
-- OUTSIDER ROYALE — FULL SECURITY HARDENING
-- Helper functions, Game RPCs, RLS policy replacement
-- ================================================

-- ================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS)
-- ================================================

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_lobby_member(p_lobby_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lobby_players
    WHERE lobby_id = p_lobby_id
    AND user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_lobby_host(p_lobby_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lobbies
    WHERE id = p_lobby_id
    AND host_user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_game_host(p_game_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM games g
    JOIN lobbies l ON l.id = g.lobby_id
    WHERE g.id = p_game_id
    AND l.host_user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
  )
$$;

-- ================================================
-- GAME RPCs
-- ================================================

-- Returns caller's role and word (outsiders get NULL or imposter word)
CREATE OR REPLACE FUNCTION public.get_my_game_role(p_game_id uuid)
RETURNS TABLE(
  is_outsider boolean,
  secret_word_text text,
  secret_word_category text,
  imposter_word_text text,
  imposter_word_category text,
  game_mode text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_lp_id uuid;
  v_game record;
  v_is_outsider boolean;
BEGIN
  v_profile_id := (SELECT p.id FROM profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1);
  IF v_profile_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT lp.id INTO v_lp_id FROM lobby_players lp
  WHERE lp.lobby_id = v_game.lobby_id AND lp.user_id = v_profile_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_is_outsider := EXISTS(SELECT 1 FROM game_outsiders WHERE game_id = p_game_id AND player_id = v_lp_id);
  is_outsider := v_is_outsider;
  game_mode := v_game.game_mode::text;

  IF v_game.game_mode = 'hidden_imposter' THEN
    IF v_is_outsider AND v_game.imposter_word_id IS NOT NULL THEN
      SELECT w.text, w.category INTO imposter_word_text, imposter_word_category FROM words w WHERE w.id = v_game.imposter_word_id;
      secret_word_text := NULL; secret_word_category := NULL;
    ELSE
      SELECT w.text, w.category INTO secret_word_text, secret_word_category FROM words w WHERE w.id = v_game.secret_word_id;
      imposter_word_text := NULL; imposter_word_category := NULL;
    END IF;
  ELSE
    imposter_word_text := NULL; imposter_word_category := NULL;
    IF v_is_outsider THEN
      secret_word_text := NULL; secret_word_category := NULL;
    ELSE
      SELECT w.text, w.category INTO secret_word_text, secret_word_category FROM words w WHERE w.id = v_game.secret_word_id;
    END IF;
  END IF;

  RETURN NEXT;
END;
$$;

-- Returns full game results (only when game is in results/finished)
CREATE OR REPLACE FUNCTION public.get_game_results(p_game_id uuid)
RETURNS TABLE(secret_word_text text, secret_word_category text, outsider_player_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game record;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.status NOT IN ('results', 'finished') THEN RETURN; END IF;

  SELECT w.text, w.category INTO secret_word_text, secret_word_category
  FROM words w WHERE w.id = v_game.secret_word_id;

  SELECT ARRAY_AGG(go.player_id) INTO outsider_player_ids
  FROM game_outsiders go WHERE go.game_id = p_game_id;

  RETURN NEXT;
END;
$$;

-- Server-side outsider guess check (outsider never sees the word client-side)
CREATE OR REPLACE FUNCTION public.check_outsider_guess(p_game_id uuid, p_guess text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_word text;
BEGIN
  SELECT w.text INTO v_word
  FROM games g JOIN words w ON w.id = g.secret_word_id
  WHERE g.id = p_game_id;
  RETURN lower(trim(p_guess)) = lower(v_word);
END;
$$;

-- One-time migration: claim an unclaimed profile for the current auth user
CREATE OR REPLACE FUNCTION public.claim_profile(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_claimed uuid;
BEGIN
  -- If auth user already owns a profile, return that
  SELECT id INTO v_existing FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Try to claim the specified unclaimed profile
  UPDATE profiles SET auth_user_id = auth.uid()
  WHERE id = p_profile_id AND auth_user_id IS NULL
  RETURNING id INTO v_claimed;

  RETURN v_claimed;
END;
$$;

-- ================================================
-- DROP ALL OLD PERMISSIVE POLICIES
-- ================================================

-- profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- lobbies
DROP POLICY IF EXISTS "Anyone can create lobbies" ON lobbies;
DROP POLICY IF EXISTS "Anyone can view lobbies" ON lobbies;
DROP POLICY IF EXISTS "Anyone can update lobbies" ON lobbies;
DROP POLICY IF EXISTS "Anyone can delete lobbies" ON lobbies;

-- lobby_players
DROP POLICY IF EXISTS "Anyone can join lobbies" ON lobby_players;
DROP POLICY IF EXISTS "Anyone can view lobby players" ON lobby_players;
DROP POLICY IF EXISTS "Players can update their own status" ON lobby_players;
DROP POLICY IF EXISTS "Players can leave lobbies" ON lobby_players;

-- games
DROP POLICY IF EXISTS "Anyone can create games" ON games;
DROP POLICY IF EXISTS "Anyone can update games" ON games;
DROP POLICY IF EXISTS "Anyone can view games" ON games;

-- game_outsiders
DROP POLICY IF EXISTS "Anyone can create game outsiders" ON game_outsiders;
DROP POLICY IF EXISTS "Anyone can view game outsiders" ON game_outsiders;

-- rounds
DROP POLICY IF EXISTS "Anyone can create rounds" ON rounds;
DROP POLICY IF EXISTS "Anyone can update rounds" ON rounds;
DROP POLICY IF EXISTS "Anyone can view rounds" ON rounds;

-- clues
DROP POLICY IF EXISTS "Anyone can submit clues" ON clues;
DROP POLICY IF EXISTS "Anyone can view clues" ON clues;

-- votes
DROP POLICY IF EXISTS "Anyone can cast votes" ON votes;
DROP POLICY IF EXISTS "Anyone can view votes" ON votes;

-- ================================================
-- NEW STRICT RLS POLICIES
-- ================================================

-- PROFILES
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "select_profiles" ON profiles FOR SELECT TO authenticated
  USING (true);

-- LOBBIES
CREATE POLICY "insert_lobby" ON lobbies FOR INSERT TO authenticated
  WITH CHECK (host_user_id = public.get_my_profile_id());
CREATE POLICY "select_lobby" ON lobbies FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "update_lobby_host" ON lobbies FOR UPDATE TO authenticated
  USING (host_user_id = public.get_my_profile_id());
CREATE POLICY "delete_lobby_host" ON lobbies FOR DELETE TO authenticated
  USING (host_user_id = public.get_my_profile_id());

-- LOBBY_PLAYERS
CREATE POLICY "select_lobby_players" ON lobby_players FOR SELECT TO authenticated
  USING (public.is_lobby_member(lobby_id));
CREATE POLICY "insert_self_lobby_player" ON lobby_players FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_my_profile_id());
CREATE POLICY "update_own_lobby_player" ON lobby_players FOR UPDATE TO authenticated
  USING (user_id = public.get_my_profile_id());
CREATE POLICY "update_lobby_player_host" ON lobby_players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM lobbies l WHERE l.id = lobby_players.lobby_id AND l.host_user_id = public.get_my_profile_id()));
CREATE POLICY "delete_own_lobby_player" ON lobby_players FOR DELETE TO authenticated
  USING (user_id = public.get_my_profile_id());
CREATE POLICY "delete_lobby_player_host" ON lobby_players FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM lobbies l WHERE l.id = lobby_players.lobby_id AND l.host_user_id = public.get_my_profile_id()));

-- GAMES
CREATE POLICY "select_game_member" ON games FOR SELECT TO authenticated
  USING (public.is_lobby_member(lobby_id));
CREATE POLICY "insert_game_host" ON games FOR INSERT TO authenticated
  WITH CHECK (public.is_lobby_host(lobby_id));
CREATE POLICY "update_game_host" ON games FOR UPDATE TO authenticated
  USING (public.is_lobby_host(lobby_id));

-- GAME_OUTSIDERS
CREATE POLICY "select_own_or_results_or_host" ON game_outsiders FOR SELECT TO authenticated
  USING (
    player_id IN (SELECT lp.id FROM lobby_players lp WHERE lp.user_id = public.get_my_profile_id())
    OR EXISTS (SELECT 1 FROM games g WHERE g.id = game_outsiders.game_id AND g.status IN ('results', 'finished'))
    OR EXISTS (SELECT 1 FROM games g WHERE g.id = game_outsiders.game_id AND public.is_lobby_host(g.lobby_id))
  );
CREATE POLICY "insert_game_outsider_host" ON game_outsiders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM games g WHERE g.id = game_outsiders.game_id AND public.is_lobby_host(g.lobby_id)));

-- ROUNDS
CREATE POLICY "select_round_member" ON rounds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = rounds.game_id AND public.is_lobby_member(g.lobby_id)));
CREATE POLICY "insert_round_host" ON rounds FOR INSERT TO authenticated
  WITH CHECK (public.is_game_host(game_id));
CREATE POLICY "update_round_host" ON rounds FOR UPDATE TO authenticated
  USING (public.is_game_host(game_id));

-- CLUES
CREATE POLICY "select_clue_member" ON clues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rounds r JOIN games g ON g.id = r.game_id WHERE r.id = clues.round_id AND public.is_lobby_member(g.lobby_id)));
CREATE POLICY "insert_own_clue" ON clues FOR INSERT TO authenticated
  WITH CHECK (player_id IN (SELECT lp.id FROM lobby_players lp WHERE lp.user_id = public.get_my_profile_id()));

-- VOTES
CREATE POLICY "select_vote_member" ON votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = votes.game_id AND public.is_lobby_member(g.lobby_id)));
CREATE POLICY "insert_own_vote" ON votes FOR INSERT TO authenticated
  WITH CHECK (voter_player_id IN (SELECT lp.id FROM lobby_players lp WHERE lp.user_id = public.get_my_profile_id()));
CREATE POLICY "delete_vote_host" ON votes FOR DELETE TO authenticated
  USING (public.is_game_host(game_id));
