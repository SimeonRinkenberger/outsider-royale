-- Create game mode enum
CREATE TYPE public.game_mode AS ENUM ('classic', 'elimination', 'hidden_imposter');

-- Add game_mode column to games table
ALTER TABLE public.games ADD COLUMN game_mode public.game_mode NOT NULL DEFAULT 'classic';

-- Add imposter_word_id for hidden_imposter mode (the different word given to imposters)
ALTER TABLE public.games ADD COLUMN imposter_word_id uuid REFERENCES public.words(id);

-- Add is_spectator column to lobby_players for elimination mode
ALTER TABLE public.lobby_players ADD COLUMN is_spectator boolean NOT NULL DEFAULT false;