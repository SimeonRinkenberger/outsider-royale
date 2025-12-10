-- Create table to track multiple outsiders per game
CREATE TABLE public.game_outsiders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- Enable RLS
ALTER TABLE public.game_outsiders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view game outsiders"
ON public.game_outsiders
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create game outsiders"
ON public.game_outsiders
FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_outsiders;