-- Allow game host to see all outsiders (needed for elimination mode game management)
-- This is additive to existing policies (PostgreSQL ORs all permissive policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'game_host_sees_all_outsiders' AND tablename = 'game_outsiders'
  ) THEN
    CREATE POLICY "game_host_sees_all_outsiders"
    ON public.game_outsiders FOR SELECT
    USING (public.is_game_host(game_id));
  END IF;
END $$;