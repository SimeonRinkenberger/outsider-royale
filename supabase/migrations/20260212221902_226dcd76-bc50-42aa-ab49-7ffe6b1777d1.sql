
-- Create categories metadata table
CREATE TABLE public.categories (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📦',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

-- Populate with current categories (trees excluded since we deleted its words)
INSERT INTO public.categories (id, name, emoji, is_paid, sort_order) VALUES
  ('birds', 'Birds', '🦅', false, 1),
  ('desserts', 'Desserts', '🍰', false, 2),
  ('car_brands', 'Car Brands', '🚗', false, 3),
  ('ocean_animals', 'Ocean Animals', '🐙', false, 4),
  ('musical_instruments', 'Musical Instruments', '🎸', false, 5),
  ('kitchen_appliances', 'Kitchen Tools', '🍳', true, 6),
  ('superheroes', 'Superheroes', '🦸', true, 7),
  ('board_games', 'Board Games', '🎲', true, 8),
  ('scientists', 'Famous Scientists', '🔬', true, 9),
  ('video_game_characters', 'Video Game Characters', '🎮', true, 10);
