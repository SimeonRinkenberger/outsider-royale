
-- Add new stats columns
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS correct_vote_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_correct_vote_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_person_games_played integer NOT NULL DEFAULT 0;
