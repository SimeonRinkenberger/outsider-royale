
-- Harden games table: require lobby membership for INSERT and UPDATE
DROP POLICY IF EXISTS "insert_game_host" ON public.games;
CREATE POLICY "insert_game_host" ON public.games
  FOR INSERT TO authenticated
  WITH CHECK (is_lobby_host(lobby_id) AND is_lobby_member(lobby_id));

DROP POLICY IF EXISTS "update_game_host" ON public.games;
CREATE POLICY "update_game_host" ON public.games
  FOR UPDATE TO authenticated
  USING (is_lobby_host(lobby_id) AND is_lobby_member(lobby_id));

-- Harden rounds table: require lobby membership for INSERT and UPDATE
DROP POLICY IF EXISTS "insert_round_host" ON public.rounds;
CREATE POLICY "insert_round_host" ON public.rounds
  FOR INSERT TO authenticated
  WITH CHECK (is_game_host(game_id) AND EXISTS (
    SELECT 1 FROM games g WHERE g.id = rounds.game_id AND is_lobby_member(g.lobby_id)
  ));

DROP POLICY IF EXISTS "update_round_host" ON public.rounds;
CREATE POLICY "update_round_host" ON public.rounds
  FOR UPDATE TO authenticated
  USING (is_game_host(game_id) AND EXISTS (
    SELECT 1 FROM games g WHERE g.id = rounds.game_id AND is_lobby_member(g.lobby_id)
  ));

-- Harden clues table: require lobby membership for INSERT
DROP POLICY IF EXISTS "insert_own_clue" ON public.clues;
CREATE POLICY "insert_own_clue" ON public.clues
  FOR INSERT TO authenticated
  WITH CHECK (
    player_id IN (SELECT lp.id FROM lobby_players lp WHERE lp.user_id = get_my_profile_id())
    AND EXISTS (
      SELECT 1 FROM rounds r JOIN games g ON g.id = r.game_id
      WHERE r.id = clues.round_id AND is_lobby_member(g.lobby_id)
    )
  );

-- Harden votes table: require lobby membership for INSERT and DELETE
DROP POLICY IF EXISTS "insert_own_vote" ON public.votes;
CREATE POLICY "insert_own_vote" ON public.votes
  FOR INSERT TO authenticated
  WITH CHECK (
    voter_player_id IN (SELECT lp.id FROM lobby_players lp WHERE lp.user_id = get_my_profile_id())
    AND EXISTS (
      SELECT 1 FROM games g WHERE g.id = votes.game_id AND is_lobby_member(g.lobby_id)
    )
  );

DROP POLICY IF EXISTS "delete_vote_host" ON public.votes;
CREATE POLICY "delete_vote_host" ON public.votes
  FOR DELETE TO authenticated
  USING (
    is_game_host(game_id) AND EXISTS (
      SELECT 1 FROM games g WHERE g.id = votes.game_id AND is_lobby_member(g.lobby_id)
    )
  );
