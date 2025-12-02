-- Create enum types
CREATE TYPE public.lobby_status AS ENUM ('waiting', 'in_progress', 'voting', 'results');
CREATE TYPE public.game_status AS ENUM ('clue_round', 'voting', 'results', 'finished');
CREATE TYPE public.word_category AS ENUM ('brand', 'food', 'movie', 'animal', 'place', 'thing', 'person');

-- Create profiles table for user display names
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL CHECK (length(display_name) > 0 AND length(display_name) <= 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (true);

-- Create lobbies table
CREATE TABLE public.lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (length(code) >= 4 AND length(code) <= 6),
  host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.lobby_status NOT NULL DEFAULT 'waiting',
  current_game_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lobbies"
  ON public.lobbies FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create lobbies"
  ON public.lobbies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Host can update their lobby"
  ON public.lobbies FOR UPDATE
  USING (host_user_id = auth.uid() OR true);

CREATE POLICY "Host can delete their lobby"
  ON public.lobbies FOR DELETE
  USING (host_user_id = auth.uid() OR true);

-- Create lobby_players table
CREATE TABLE public.lobby_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, user_id)
);

ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lobby players"
  ON public.lobby_players FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join lobbies"
  ON public.lobby_players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update their own status"
  ON public.lobby_players FOR UPDATE
  USING (true);

CREATE POLICY "Players can leave lobbies"
  ON public.lobby_players FOR DELETE
  USING (true);

-- Create words table
CREATE TABLE public.words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL UNIQUE,
  category public.word_category NOT NULL
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view words"
  ON public.words FOR SELECT
  USING (true);

-- Create games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  secret_word_id UUID NOT NULL REFERENCES public.words(id),
  outsider_player_id UUID NOT NULL REFERENCES public.lobby_players(id),
  total_rounds INTEGER NOT NULL DEFAULT 3,
  current_round_number INTEGER NOT NULL DEFAULT 1,
  status public.game_status NOT NULL DEFAULT 'clue_round',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view games"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create games"
  ON public.games FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update games"
  ON public.games FOR UPDATE
  USING (true);

-- Create rounds table
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, round_number)
);

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rounds"
  ON public.rounds FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create rounds"
  ON public.rounds FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update rounds"
  ON public.rounds FOR UPDATE
  USING (true);

-- Create clues table
CREATE TABLE public.clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.lobby_players(id) ON DELETE CASCADE,
  clue_text TEXT NOT NULL CHECK (length(clue_text) > 0 AND length(clue_text) <= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_id)
);

ALTER TABLE public.clues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view clues"
  ON public.clues FOR SELECT
  USING (true);

CREATE POLICY "Anyone can submit clues"
  ON public.clues FOR INSERT
  WITH CHECK (true);

-- Create votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  voter_player_id UUID NOT NULL REFERENCES public.lobby_players(id) ON DELETE CASCADE,
  suspected_outsider_player_id UUID NOT NULL REFERENCES public.lobby_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, voter_player_id)
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can cast votes"
  ON public.votes FOR INSERT
  WITH CHECK (true);

-- Add foreign key for current_game_id in lobbies
ALTER TABLE public.lobbies
  ADD CONSTRAINT lobbies_current_game_id_fkey
  FOREIGN KEY (current_game_id) REFERENCES public.games(id) ON DELETE SET NULL;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- Seed words table with 100 words across different categories
INSERT INTO public.words (text, category) VALUES
  -- Brands
  ('KFC', 'brand'), ('McDonald''s', 'brand'), ('Starbucks', 'brand'), ('Nike', 'brand'), ('Adidas', 'brand'),
  ('Apple', 'brand'), ('Samsung', 'brand'), ('Sony', 'brand'), ('Tesla', 'brand'), ('Netflix', 'brand'),
  ('Spotify', 'brand'), ('Amazon', 'brand'), ('Google', 'brand'), ('Microsoft', 'brand'), ('Coca-Cola', 'brand'),
  
  -- Food
  ('Pizza', 'food'), ('Burger', 'food'), ('Sushi', 'food'), ('Pasta', 'food'), ('Tacos', 'food'),
  ('Ice Cream', 'food'), ('Chocolate', 'food'), ('Cookies', 'food'), ('Popcorn', 'food'), ('Donut', 'food'),
  ('Pancakes', 'food'), ('Waffles', 'food'), ('Hot Dog', 'food'), ('Sandwich', 'food'), ('Salad', 'food'),
  
  -- Movies/Shows
  ('Star Wars', 'movie'), ('Harry Potter', 'movie'), ('Spider-Man', 'movie'), ('Batman', 'movie'), ('Avengers', 'movie'),
  ('Frozen', 'movie'), ('Toy Story', 'movie'), ('The Lion King', 'movie'), ('Titanic', 'movie'), ('Avatar', 'movie'),
  ('Jurassic Park', 'movie'), ('The Matrix', 'movie'), ('Inception', 'movie'), ('Shrek', 'movie'), ('Finding Nemo', 'movie'),
  
  -- Animals
  ('Dog', 'animal'), ('Cat', 'animal'), ('Elephant', 'animal'), ('Lion', 'animal'), ('Tiger', 'animal'),
  ('Giraffe', 'animal'), ('Penguin', 'animal'), ('Dolphin', 'animal'), ('Monkey', 'animal'), ('Bear', 'animal'),
  ('Rabbit', 'animal'), ('Horse', 'animal'), ('Panda', 'animal'), ('Kangaroo', 'animal'), ('Zebra', 'animal'),
  
  -- Places
  ('Paris', 'place'), ('New York', 'place'), ('Tokyo', 'place'), ('London', 'place'), ('Rome', 'place'),
  ('Beach', 'place'), ('Mountain', 'place'), ('Desert', 'place'), ('Forest', 'place'), ('Airport', 'place'),
  ('School', 'place'), ('Hospital', 'place'), ('Library', 'place'), ('Museum', 'place'), ('Stadium', 'place'),
  
  -- Things
  ('iPhone', 'thing'), ('Guitar', 'thing'), ('Camera', 'thing'), ('Bicycle', 'thing'), ('Laptop', 'thing'),
  ('Watch', 'thing'), ('Sunglasses', 'thing'), ('Umbrella', 'thing'), ('Backpack', 'thing'), ('Book', 'thing'),
  ('Piano', 'thing'), ('Television', 'thing'), ('Microphone', 'thing'), ('Headphones', 'thing'), ('Skateboard', 'thing'),
  
  -- People/Characters
  ('Mickey Mouse', 'person'), ('Mario', 'person'), ('Pikachu', 'person'), ('Elsa', 'person'), ('Santa Claus', 'person'),
  ('Spongebob', 'person'), ('Homer Simpson', 'person'), ('Darth Vader', 'person'), ('Superman', 'person'), ('Wonder Woman', 'person'),
  ('Einstein', 'person'), ('Mozart', 'person'), ('Leonardo da Vinci', 'person'), ('Shakespeare', 'person'), ('Sherlock Holmes', 'person');