-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create user_stats table for tracking game statistics (only for authenticated users)
CREATE TABLE public.user_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won_as_outsider INTEGER NOT NULL DEFAULT 0,
  games_played_as_outsider INTEGER NOT NULL DEFAULT 0,
  games_won_as_safe INTEGER NOT NULL DEFAULT 0,
  games_played_as_safe INTEGER NOT NULL DEFAULT 0,
  current_win_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  total_clues_submitted INTEGER NOT NULL DEFAULT 0,
  total_correct_votes INTEGER NOT NULL DEFAULT 0,
  total_votes_cast INTEGER NOT NULL DEFAULT 0,
  favorite_category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats
CREATE POLICY "Users can view their own stats"
ON public.user_stats
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own stats
CREATE POLICY "Users can insert their own stats"
ON public.user_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own stats
CREATE POLICY "Users can update their own stats"
ON public.user_stats
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_stats_updated_at
BEFORE UPDATE ON public.user_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add auth_user_id column to profiles table for linking to authenticated users
ALTER TABLE public.profiles ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE;

-- Add is_guest column to profiles to distinguish guest vs authenticated users
ALTER TABLE public.profiles ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT true;