export type LobbyStatus = 'waiting' | 'in_progress' | 'voting' | 'results';
export type GameStatus = 'clue_round' | 'voting' | 'results' | 'finished';
export type WordCategory = 'dog_breeds' | 'birds' | 'desserts' | 'car_brands' | 'ocean_animals' | 'musical_instruments' | 'kitchen_appliances' | 'superheroes' | 'board_games' | 'trees' | 'scientists' | 'video_game_characters';
export type GameMode = 'classic' | 'elimination' | 'hidden_imposter';

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

export interface Lobby {
  id: string;
  code: string;
  host_user_id: string;
  status: LobbyStatus;
  current_game_id: string | null;
  created_at: string;
}

export interface LobbyPlayer {
  id: string;
  lobby_id: string;
  user_id: string;
  display_name: string;
  is_host: boolean;
  is_connected: boolean;
  is_spectator: boolean;
  joined_at: string;
  avatar_url?: string | null;
}

export interface Word {
  id: string;
  text: string;
  category: WordCategory;
}

export interface Game {
  id: string;
  lobby_id: string;
  secret_word_id: string;
  outsider_player_id: string;
  imposter_word_id: string | null;
  total_rounds: number;
  current_round_number: number;
  status: GameStatus;
  game_mode: GameMode;
  created_at: string;
}

export interface Round {
  id: string;
  game_id: string;
  round_number: number;
  is_complete: boolean;
  created_at: string;
}

export interface Clue {
  id: string;
  round_id: string;
  player_id: string;
  clue_text: string;
  created_at: string;
}

export interface Vote {
  id: string;
  game_id: string;
  voter_player_id: string;
  suspected_outsider_player_id: string;
  created_at: string;
}
