-- Drop the old unique constraint that prevents multiple votes per player
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_game_id_voter_player_id_key;

-- Add a new unique constraint that allows multiple votes but prevents duplicate votes for the same suspected player
ALTER TABLE public.votes ADD CONSTRAINT votes_unique_voter_per_suspect UNIQUE(game_id, voter_player_id, suspected_outsider_player_id);