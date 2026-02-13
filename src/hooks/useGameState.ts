import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Lobby, LobbyPlayer, Game, Round, Clue, Vote } from '@/types/game';
import { getCachedGameData, getCachedResultsData } from '@/lib/gamePreloadCache';

export interface GameOutsider {
  id: string;
  game_id: string;
  player_id: string;
  created_at: string;
}

// Debounce helper
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
}

export const useGameState = (lobbyId: string | null) => {
  // Try to use preloaded cache for instant render
  const cachedGame = lobbyId ? getCachedGameData(lobbyId) : null;
  const cachedResults = lobbyId ? getCachedResultsData(lobbyId) : null;
  
  const [lobby, setLobby] = useState<Lobby | null>(cachedGame?.lobby || cachedResults?.lobby || null);
  const [players, setPlayers] = useState<LobbyPlayer[]>(cachedGame?.players || cachedResults?.players || []);
  const [game, setGame] = useState<Game | null>(cachedGame?.game || cachedResults?.game || null);
  const [currentRound, setCurrentRound] = useState<Round | null>(cachedGame?.currentRound || null);
  const [clues, setClues] = useState<Clue[]>(cachedGame?.clues || []); // Current round clues
  const [allClues, setAllClues] = useState<Clue[]>(cachedGame?.allClues || []); // All clues for the game
  const [votes, setVotes] = useState<Vote[]>(cachedResults?.votes || []);
  // secretWord and imposterWord are no longer fetched here for security
  // Use get_my_game_role RPC in Game.tsx and get_game_results RPC in Results.tsx
  const [outsiders, setOutsiders] = useState<GameOutsider[]>(cachedGame?.outsiders || cachedResults?.outsiders || []);
  
  // Track current round ID for filtered clues subscription
  const currentRoundIdRef = useRef<string | null>(null);
  
  // Track if we already initialized from cache
  const initializedFromCacheRef = useRef(!!cachedGame || !!cachedResults);

  // Debounced refetch for players (only when needed for avatar join)
  const debouncedRefetchPlayers = useDebouncedCallback(async () => {
    if (!lobbyId) return;
    const { data } = await supabase
      .from('lobby_players')
      .select('id, lobby_id, user_id, is_host, is_connected, is_spectator, joined_at, display_name, profiles:user_id(avatar_url)')
      .eq('lobby_id', lobbyId)
      .order('joined_at');
    if (data) {
      const playersWithAvatars = data.map((p: any) => ({
        ...p,
        avatar_url: p.profiles?.avatar_url || null,
        profiles: undefined
      }));
      setPlayers(playersWithAvatars as LobbyPlayer[]);
    }
  }, 300);

  useEffect(() => {
    if (!lobbyId) return;

    console.log('useGameState: Setting up for lobby', lobbyId);

    // Fetch initial data only if not already from cache
    const fetchData = async () => {
      // Skip initial fetch if we have valid cache data
      if (initializedFromCacheRef.current) {
        console.log('useGameState: Using cached data, skipping initial fetch');
        initializedFromCacheRef.current = false; // Only skip once
        
        // But we still need to update currentRoundIdRef
        if (cachedGame?.currentRound) {
          currentRoundIdRef.current = cachedGame.currentRound.id;
        }
        return;
      }
      
      const { data: lobbyData } = await supabase
        .from('lobbies')
        .select('id, code, host_user_id, status, current_game_id, created_at')
        .eq('id', lobbyId)
        .single();
      
      if (lobbyData) {
        setLobby(lobbyData as Lobby);

        // Fetch players with their avatars
        const { data: playersData } = await supabase
          .from('lobby_players')
          .select('id, lobby_id, user_id, is_host, is_connected, is_spectator, joined_at, display_name, profiles:user_id(avatar_url)')
          .eq('lobby_id', lobbyId)
          .order('joined_at');
        
        if (playersData) {
          const playersWithAvatars = playersData.map((p: any) => ({
            ...p,
            avatar_url: p.profiles?.avatar_url || null,
            profiles: undefined
          }));
          setPlayers(playersWithAvatars as LobbyPlayer[]);
        }

        // Fetch game if exists
        if (lobbyData.current_game_id) {
          const { data: gameData } = await supabase
            .from('games')
            .select('id, lobby_id, secret_word_id, outsider_player_id, total_rounds, current_round_number, status, created_at, game_mode, imposter_word_id')
            .eq('id', lobbyData.current_game_id)
            .single();
          
          if (gameData) {
            setGame(gameData as Game);

            // Secret word and imposter word are fetched via secure RPCs in components
            // (get_my_game_role for Game.tsx, get_game_results for Results.tsx)

            // Fetch current round
            const { data: roundData } = await supabase
              .from('rounds')
              .select('id, game_id, round_number, is_complete, created_at')
              .eq('game_id', gameData.id)
              .eq('round_number', gameData.current_round_number)
              .single();
            
            if (roundData) {
              setCurrentRound(roundData as Round);
              currentRoundIdRef.current = roundData.id;

              // Fetch clues for current round
              const { data: cluesData } = await supabase
                .from('clues')
                .select('id, round_id, player_id, clue_text, created_at')
                .eq('round_id', roundData.id)
                .order('created_at');
              
              if (cluesData) setClues(cluesData as Clue[]);
            }

            // Fetch ALL clues for the game (for turn calculation)
            const { data: allRounds } = await supabase
              .from('rounds')
              .select('id')
              .eq('game_id', gameData.id);
            
            if (allRounds) {
              const roundIds = allRounds.map(r => r.id);
              const { data: allCluesData } = await supabase
                .from('clues')
                .select('id, round_id, player_id, clue_text, created_at')
                .in('round_id', roundIds)
                .order('created_at');
              
              if (allCluesData) setAllClues(allCluesData as Clue[]);
            }

            // Fetch votes if in voting phase
            if (gameData.status === 'voting' || gameData.status === 'results') {
              const { data: votesData } = await supabase
                .from('votes')
                .select('id, game_id, voter_player_id, suspected_outsider_player_id, created_at')
                .eq('game_id', gameData.id);
              
              if (votesData) setVotes(votesData as Vote[]);
            }
          }
        }
      }
    };

    fetchData();

    // Set up real-time subscriptions with unique channel ID
    const channelId = `lobby-${lobbyId}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating channel:', channelId);
    
    const lobbyChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('Lobby update received:', payload);
          if (payload.eventType === 'UPDATE') {
            setLobby(payload.new as Lobby);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobby_players',
          filter: `lobby_id=eq.${lobbyId}`
        },
        (payload) => {
          console.log('Lobby player change received:', payload.eventType);
          
          // Apply payload directly instead of refetching
          if (payload.eventType === 'INSERT') {
            const newPlayer = payload.new as LobbyPlayer;
            // We need to refetch once to get avatar, but debounced
            debouncedRefetchPlayers();
          } else if (payload.eventType === 'UPDATE') {
            const updatedPlayer = payload.new as LobbyPlayer;
            setPlayers(prev => prev.map(p => 
              p.id === updatedPlayer.id 
                ? { ...p, ...updatedPlayer }
                : p
            ));
          } else if (payload.eventType === 'DELETE') {
            const deletedPlayer = payload.old as LobbyPlayer;
            setPlayers(prev => prev.filter(p => p.id !== deletedPlayer.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Lobby subscription status:', status);
      });

    return () => {
      supabase.removeChannel(lobbyChannel);
    };
  }, [lobbyId, debouncedRefetchPlayers]);

  // Watch for new game when lobby's current_game_id changes
  useEffect(() => {
    if (!lobby?.current_game_id) return;

    const fetchNewGame = async () => {
      // Check if we already have this game in cache
      if (game?.id === lobby.current_game_id) {
        console.log('useGameState: Game already loaded, skipping refetch');
        return;
      }
      
      console.log('useGameState: Fetching game for current_game_id', lobby.current_game_id);
      
      const { data: gameData } = await supabase
        .from('games')
        .select('id, lobby_id, secret_word_id, outsider_player_id, total_rounds, current_round_number, status, created_at, game_mode, imposter_word_id')
        .eq('id', lobby.current_game_id)
        .single();
      
      if (gameData) {
        setGame(gameData as Game);

        // Secret word and imposter word are fetched via secure RPCs in components

        // Fetch current round
        const { data: roundData } = await supabase
          .from('rounds')
          .select('id, game_id, round_number, is_complete, created_at')
          .eq('game_id', gameData.id)
          .eq('round_number', gameData.current_round_number)
          .single();
        
        if (roundData) {
          setCurrentRound(roundData as Round);
          currentRoundIdRef.current = roundData.id;

          // Fetch clues for current round
          const { data: cluesData } = await supabase
            .from('clues')
            .select('id, round_id, player_id, clue_text, created_at')
            .eq('round_id', roundData.id)
            .order('created_at');
          
          if (cluesData) setClues(cluesData as Clue[]);
        }

        // Fetch ALL clues for the game (for turn calculation)
        const { data: allRounds } = await supabase
          .from('rounds')
          .select('id')
          .eq('game_id', gameData.id);
        
        if (allRounds) {
          const roundIds = allRounds.map(r => r.id);
          const { data: allCluesData } = await supabase
            .from('clues')
            .select('id, round_id, player_id, clue_text, created_at')
            .in('round_id', roundIds)
            .order('created_at');
          
          if (allCluesData) setAllClues(allCluesData as Clue[]);
        }

        // Reset votes for new game
        setVotes([]);
      }
    };

    fetchNewGame();
  }, [lobby?.current_game_id, game?.id]);

  // Subscribe to game changes - FILTERED clues subscription
  useEffect(() => {
    if (!game?.id || !currentRound?.id) return;

    console.log('useGameState: Setting up game subscriptions for', game.id, 'round', currentRound.id);
    
    // Update the ref for filter comparison
    currentRoundIdRef.current = currentRound.id;
    
    const channelId = `game-${game.id}-${currentRound.id}-${Math.random().toString(36).substr(2, 9)}`;
    const gameChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${game.id}`
        },
        async (payload) => {
          console.log('Game update received:', payload.eventType);
          if (payload.eventType === 'UPDATE') {
            const updatedGame = payload.new as Game;
            setGame(updatedGame);

            // Fetch new round if round number changed
            if (updatedGame.current_round_number !== game.current_round_number) {
              const { data: roundData } = await supabase
                .from('rounds')
                .select('id, game_id, round_number, is_complete, created_at')
                .eq('game_id', updatedGame.id)
                .eq('round_number', updatedGame.current_round_number)
                .single();
              
              if (roundData) {
                setCurrentRound(roundData as Round);
                currentRoundIdRef.current = roundData.id;
                setClues([]); // Clear clues for new round
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clues',
          filter: `round_id=eq.${currentRound.id}` // FILTERED to current round only
        },
        (payload) => {
          console.log('Clue change received for current round:', payload.eventType);
          
          // Apply payload directly instead of refetching
          if (payload.eventType === 'INSERT') {
            const newClue = payload.new as Clue;
            // Update current round clues
            setClues(prev => {
              // Avoid duplicates
              if (prev.some(c => c.id === newClue.id)) return prev;
              return [...prev, newClue].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
            // Update all clues
            setAllClues(prev => {
              if (prev.some(c => c.id === newClue.id)) return prev;
              return [...prev, newClue].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedClue = payload.new as Clue;
            setClues(prev => prev.map(c => c.id === updatedClue.id ? updatedClue : c));
            setAllClues(prev => prev.map(c => c.id === updatedClue.id ? updatedClue : c));
          } else if (payload.eventType === 'DELETE') {
            const deletedClue = payload.old as Clue;
            setClues(prev => prev.filter(c => c.id !== deletedClue.id));
            setAllClues(prev => prev.filter(c => c.id !== deletedClue.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `game_id=eq.${game.id}`
        },
        (payload) => {
          console.log('Vote change received:', payload.eventType);
          
          // Apply payload directly instead of refetching
          if (payload.eventType === 'INSERT') {
            const newVote = payload.new as Vote;
            setVotes(prev => {
              // Avoid duplicates
              if (prev.some(v => v.id === newVote.id)) return prev;
              return [...prev, newVote];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedVote = payload.new as Vote;
            setVotes(prev => prev.map(v => v.id === updatedVote.id ? updatedVote : v));
          } else if (payload.eventType === 'DELETE') {
            const deletedVote = payload.old as Vote;
            setVotes(prev => prev.filter(v => v.id !== deletedVote.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Game subscription status:', status);
      });

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [game?.id, game?.current_round_number, currentRound?.id]);

  // Fetch outsiders when game changes
  useEffect(() => {
    if (!game?.id) {
      setOutsiders([]);
      return;
    }
    
    // Check if we already have outsiders from cache
    if (outsiders.length > 0 && outsiders[0]?.game_id === game.id) {
      return;
    }

    const fetchOutsiders = async () => {
      const { data } = await supabase
        .from('game_outsiders')
        .select('id, game_id, player_id, created_at')
        .eq('game_id', game.id);
      
      if (data) setOutsiders(data as GameOutsider[]);
    };

    fetchOutsiders();
  }, [game?.id]);

  return {
    lobby,
    players,
    game,
    currentRound,
    clues,
    allClues,
    votes,
    outsiders
  };
};
