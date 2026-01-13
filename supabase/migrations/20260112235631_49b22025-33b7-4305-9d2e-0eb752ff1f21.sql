-- Create RPC function for server-side random word selection
-- This eliminates the need to fetch all words client-side

CREATE OR REPLACE FUNCTION public.get_random_words_from_categories(
  p_categories text[],
  p_count int DEFAULT 1,
  p_exclude_word_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  text text,
  category text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.text,
    w.category::text
  FROM words w
  WHERE w.category::text = ANY(p_categories)
    AND (p_exclude_word_id IS NULL OR w.id != p_exclude_word_id)
  ORDER BY random()
  LIMIT p_count;
END;
$$;

-- Create a function to get an imposter word from the same category
CREATE OR REPLACE FUNCTION public.get_imposter_word(
  p_secret_word_id uuid,
  p_categories text[]
)
RETURNS TABLE (
  id uuid,
  text text,
  category text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_secret_category text;
BEGIN
  -- Get the category of the secret word
  SELECT w.category::text INTO v_secret_category
  FROM words w
  WHERE w.id = p_secret_word_id;
  
  -- First try to get a word from the same category
  RETURN QUERY
  SELECT 
    w.id,
    w.text,
    w.category::text
  FROM words w
  WHERE w.category::text = v_secret_category
    AND w.id != p_secret_word_id
  ORDER BY random()
  LIMIT 1;
  
  -- If no rows returned, try from any of the selected categories
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      w.id,
      w.text,
      w.category::text
    FROM words w
    WHERE w.category::text = ANY(p_categories)
      AND w.id != p_secret_word_id
    ORDER BY random()
    LIMIT 1;
  END IF;
END;
$$;