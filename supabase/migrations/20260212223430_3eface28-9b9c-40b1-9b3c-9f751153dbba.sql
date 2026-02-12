
-- PHASE 1: Restore missing categories (kitchen_appliances and trees were accidentally deleted)
INSERT INTO public.categories (id, name, emoji, is_paid, sort_order) VALUES
  ('kitchen_appliances', 'Kitchen Tools', '🍳', true, 6),
  ('trees', 'Trees', '🌳', true, 9)
ON CONFLICT (id) DO NOTHING;

-- PHASE 2: Delete test category (tester) - CASCADE will remove its 5 words
DELETE FROM public.categories WHERE id = 'tester';

-- PHASE 3: Drop the stale word_category enum (column is now text, enum is unused)
DROP TYPE IF EXISTS public.word_category;
