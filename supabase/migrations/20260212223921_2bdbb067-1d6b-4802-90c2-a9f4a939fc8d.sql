
-- Fix trees sort_order conflict (both trees and scientists had sort_order=9)
UPDATE public.categories SET sort_order = 10 WHERE id = 'scientists';
UPDATE public.categories SET sort_order = 11 WHERE id = 'video_game_characters';
