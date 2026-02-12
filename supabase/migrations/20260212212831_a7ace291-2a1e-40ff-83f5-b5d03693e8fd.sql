
-- Clean up game-related data that references words, then delete old words
-- Order matters due to foreign key constraints

-- Delete clues (references rounds)
DELETE FROM clues;

-- Delete votes (references games)
DELETE FROM votes;

-- Delete game_outsiders (references games)  
DELETE FROM game_outsiders;

-- Delete rounds (references games)
DELETE FROM rounds;

-- Update lobbies to remove game references
UPDATE lobbies SET current_game_id = NULL;

-- Delete games (references words)
DELETE FROM games;

-- Now delete all old words
DELETE FROM words;
