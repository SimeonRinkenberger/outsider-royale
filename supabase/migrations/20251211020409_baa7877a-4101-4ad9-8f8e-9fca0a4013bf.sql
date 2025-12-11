-- Drop the existing check constraint and add a new one for 50 characters
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_check CHECK (char_length(display_name) <= 50);