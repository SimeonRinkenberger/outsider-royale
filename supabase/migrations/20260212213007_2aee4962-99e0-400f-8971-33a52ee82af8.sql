
-- Add new word_category enum values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dog_breeds' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'dog_breeds';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'birds' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'birds';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'desserts' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'desserts';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'car_brands' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'car_brands';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ocean_animals' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'ocean_animals';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'musical_instruments' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'musical_instruments';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'kitchen_appliances' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'kitchen_appliances';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'superheroes' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'superheroes';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'board_games' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'board_games';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'trees' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'trees';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scientists' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'scientists';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'video_game_characters' AND enumtypid = 'word_category'::regtype) THEN
    ALTER TYPE word_category ADD VALUE 'video_game_characters';
  END IF;
END $$;
