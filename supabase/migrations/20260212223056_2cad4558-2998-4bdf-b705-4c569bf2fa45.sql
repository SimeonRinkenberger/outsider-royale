-- Change words.category from enum to plain text for fully dynamic category management
ALTER TABLE public.words ALTER COLUMN category TYPE text USING category::text;

-- Add FK to categories table so deleting a category cascades to its words
ALTER TABLE public.words ADD CONSTRAINT words_category_fk FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE CASCADE;
