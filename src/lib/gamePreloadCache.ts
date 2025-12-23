/**
 * Preload cache for game data to eliminate loading flashes during transitions.
 * Data is fetched in prepare() and read synchronously on destination mount.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Lobby, LobbyPlayer, Game, Round, Clue, Vote, Word } from '@/types/game';

export interface GameOutsider {
  id: string;
  game_id: string;
  player_id: string;
  created_at: string;
}

export interface PreloadedGameData {
  lobby: Lobby;
  players: LobbyPlayer[];
  game: Game;
  currentRound: Round;
  secretWord: Word;
  imposterWord: Word | null;
  outsiders: GameOutsider[];
  clues: Clue[];
  allClues: Clue[];
  timestamp: number;
}

export interface PreloadedResultsData {
  lobby: Lobby;
  players: LobbyPlayer[];
  game: Game;
  secretWord: Word;
  imposterWord: Word | null;
  outsiders: GameOutsider[];
  votes: Vote[];
  timestamp: number;
}

// In-memory cache
const gameCache = new Map<string, PreloadedGameData>();
const resultsCache = new Map<string, PreloadedResultsData>();

// Cache TTL - 30 seconds
const CACHE_TTL = 30000;

/**
 * Preload game data for Lobby → Game transition.
 * Waits for game to exist before fetching all required data.
 */
export async function preloadGameData(lobbyId: string): Promise<PreloadedGameData | null> {
  
  try {
    // First, wait for the game to exist (poll briefly if needed)
    let lobbyData: Lobby | null = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const { data } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();
      
      if (data?.current_game_id) {
        lobbyData = data as Lobby;
        break;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!lobbyData?.current_game_id) {
      return null;
    }
    
    // Fetch all game data in parallel
    const [
      playersResult,
      gameResult,
    ] = await Promise.all([
      supabase
        .from('lobby_players')
        .select('*, profiles:user_id(avatar_url)')
        .eq('lobby_id', lobbyId)
        .order('joined_at'),
      supabase
        .from('games')
        .select('*')
        .eq('id', lobbyData.current_game_id)
        .single(),
    ]);
    
    const players = playersResult.data?.map((p: any) => ({
      ...p,
      avatar_url: p.profiles?.avatar_url || null,
      profiles: undefined
    })) as LobbyPlayer[] || [];
    
    const game = gameResult.data as Game | null;
    
    if (!game) {
      return null;
    }
    
    // Fetch remaining data in parallel
    const [
      secretWordResult,
      imposterWordResult,
      roundResult,
      outsidersResult,
    ] = await Promise.all([
      supabase
        .from('words')
        .select('*')
        .eq('id', game.secret_word_id)
        .single(),
      game.imposter_word_id
        ? supabase.from('words').select('*').eq('id', game.imposter_word_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from('rounds')
        .select('*')
        .eq('game_id', game.id)
        .eq('round_number', game.current_round_number)
        .single(),
      supabase
        .from('game_outsiders')
        .select('*')
        .eq('game_id', game.id),
    ]);
    
    const secretWord = secretWordResult.data as Word | null;
    const imposterWord = imposterWordResult.data as Word | null;
    const currentRound = roundResult.data as Round | null;
    const outsiders = outsidersResult.data as GameOutsider[] || [];
    
    if (!secretWord || !currentRound) {
      return null;
    }
    
    // Fetch clues
    const [cluesResult, allRoundsResult] = await Promise.all([
      supabase
        .from('clues')
        .select('*')
        .eq('round_id', currentRound.id)
        .order('created_at'),
      supabase
        .from('rounds')
        .select('id')
        .eq('game_id', game.id),
    ]);
    
    const clues = cluesResult.data as Clue[] || [];
    
    let allClues: Clue[] = [];
    if (allRoundsResult.data) {
      const roundIds = allRoundsResult.data.map(r => r.id);
      const { data: allCluesData } = await supabase
        .from('clues')
        .select('*')
        .in('round_id', roundIds)
        .order('created_at');
      allClues = allCluesData as Clue[] || [];
    }
    
    const preloadedData: PreloadedGameData = {
      lobby: lobbyData,
      players,
      game,
      currentRound,
      secretWord,
      imposterWord,
      outsiders,
      clues,
      allClues,
      timestamp: Date.now(),
    };
    
    gameCache.set(lobbyId, preloadedData);
    
    return preloadedData;
  } catch {
    return null;
  }
}

/**
 * Preload results data for Game → Results transition.
 */
export async function preloadResultsData(lobbyId: string, gameId: string): Promise<PreloadedResultsData | null> {
  
  try {
    // Fetch all required data in parallel
    const [
      lobbyResult,
      playersResult,
      gameResult,
      votesResult,
      outsidersResult,
    ] = await Promise.all([
      supabase.from('lobbies').select('*').eq('id', lobbyId).single(),
      supabase
        .from('lobby_players')
        .select('*, profiles:user_id(avatar_url)')
        .eq('lobby_id', lobbyId)
        .order('joined_at'),
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('votes').select('*').eq('game_id', gameId),
      supabase.from('game_outsiders').select('*').eq('game_id', gameId),
    ]);
    
    const lobby = lobbyResult.data as Lobby | null;
    const players = playersResult.data?.map((p: any) => ({
      ...p,
      avatar_url: p.profiles?.avatar_url || null,
      profiles: undefined
    })) as LobbyPlayer[] || [];
    const game = gameResult.data as Game | null;
    const votes = votesResult.data as Vote[] || [];
    const outsiders = outsidersResult.data as GameOutsider[] || [];
    
    if (!lobby || !game) {
      return null;
    }
    
    // Fetch words
    const [secretWordResult, imposterWordResult] = await Promise.all([
      supabase.from('words').select('*').eq('id', game.secret_word_id).single(),
      game.imposter_word_id
        ? supabase.from('words').select('*').eq('id', game.imposter_word_id).single()
        : Promise.resolve({ data: null }),
    ]);
    
    const secretWord = secretWordResult.data as Word | null;
    const imposterWord = imposterWordResult.data as Word | null;
    
    if (!secretWord) {
      return null;
    }
    
    const preloadedData: PreloadedResultsData = {
      lobby,
      players,
      game,
      secretWord,
      imposterWord,
      outsiders,
      votes,
      timestamp: Date.now(),
    };
    
    resultsCache.set(lobbyId, preloadedData);
    
    return preloadedData;
  } catch {
    return null;
  }
}

/**
 * Get cached game data. Returns null if cache miss or expired.
 */
export function getCachedGameData(lobbyId: string): PreloadedGameData | null {
  const cached = gameCache.get(lobbyId);
  if (!cached) return null;
  
  // Check TTL
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    gameCache.delete(lobbyId);
    return null;
  }
  
  return cached;
}

/**
 * Get cached results data. Returns null if cache miss or expired.
 */
export function getCachedResultsData(lobbyId: string): PreloadedResultsData | null {
  const cached = resultsCache.get(lobbyId);
  if (!cached) return null;
  
  // Check TTL
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    resultsCache.delete(lobbyId);
    return null;
  }
  
  return cached;
}

/**
 * Clear cached game data for a lobby.
 */
export function clearGameCache(lobbyId: string): void {
  gameCache.delete(lobbyId);
}

/**
 * Clear cached results data for a lobby.
 */
export function clearResultsCache(lobbyId: string): void {
  resultsCache.delete(lobbyId);
}
