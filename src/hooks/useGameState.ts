import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Lobby, LobbyPlayer, Game, Round, Clue, Vote, Word } from '@/types/game';

export const useGameState = (lobbyId: string | null) => {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [clues, setClues] = useState<Clue[]>([]); // Current round clues
  const [allClues, setAllClues] = useState<Clue[]>([]); // All clues for the game
  const [votes, setVotes] = useState<Vote[]>([]);
  const [secretWord, setSecretWord] = useState<Word | null>(null);

  useEffect(() => {
    if (!lobbyId) return;

    console.log('useGameState: Setting up for lobby', lobbyId);

    // Fetch initial data
    const fetchData = async () => {
      const { data: lobbyData } = await supabase
        .from('lobbies')
        .select('*')
        .eq('id', lobbyId)
        .single();
      
      if (lobbyData) {
        setLobby(lobbyData as Lobby);

        // Fetch players
        const { data: playersData } = await supabase
          .from('lobby_players')
          .select('*')
          .eq('lobby_id', lobbyId)
          .order('joined_at');
        
        if (playersData) setPlayers(playersData as LobbyPlayer[]);

        // Fetch game if exists
        if (lobbyData.current_game_id) {
          const { data: gameData } = await supabase
            .from('games')
            .select('*')
            .eq('id', lobbyData.current_game_id)
            .single();
          
          if (gameData) {
            setGame(gameData as Game);

            // Fetch secret word
            const { data: wordData } = await supabase
              .from('words')
              .select('*')
              .eq('id', gameData.secret_word_id)
              .single();
            
            if (wordData) setSecretWord(wordData as Word);

            // Fetch current round
            const { data: roundData } = await supabase
              .from('rounds')
              .select('*')
              .eq('game_id', gameData.id)
              .eq('round_number', gameData.current_round_number)
              .single();
            
            if (roundData) {
              setCurrentRound(roundData as Round);

              // Fetch clues for current round
              const { data: cluesData } = await supabase
                .from('clues')
                .select('*')
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
                .select('*')
                .in('round_id', roundIds)
                .order('created_at');
              
              if (allCluesData) setAllClues(allCluesData as Clue[]);
            }

            // Fetch votes if in voting phase
            if (gameData.status === 'voting' || gameData.status === 'results') {
              const { data: votesData } = await supabase
                .from('votes')
                .select('*')
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
        async (payload) => {
          console.log('Lobby player change received:', payload.eventType);
          const { data } = await supabase
            .from('lobby_players')
            .select('*')
            .eq('lobby_id', lobbyId)
            .order('joined_at');
          if (data) {
            console.log('Updated players:', data.length);
            setPlayers(data as LobbyPlayer[]);
          }
        }
      )
      .subscribe((status) => {
        console.log('Lobby subscription status:', status);
      });

    return () => {
      supabase.removeChannel(lobbyChannel);
    };
  }, [lobbyId]);

  // Subscribe to game changes
  useEffect(() => {
    if (!game?.id) return;

    console.log('useGameState: Setting up game subscriptions for', game.id);
    
    const channelId = `game-${game.id}-${Math.random().toString(36).substr(2, 9)}`;
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
                .select('*')
                .eq('game_id', updatedGame.id)
                .eq('round_number', updatedGame.current_round_number)
                .single();
              
              if (roundData) {
                setCurrentRound(roundData as Round);
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
          table: 'clues'
        },
        async (payload) => {
          console.log('Clue change received:', payload.eventType);
          if (currentRound) {
            const { data } = await supabase
              .from('clues')
              .select('*')
              .eq('round_id', currentRound.id)
              .order('created_at');
            if (data) setClues(data as Clue[]);
          }
          // Also fetch all clues for turn calculation
          if (game?.id) {
            const { data: allRounds } = await supabase
              .from('rounds')
              .select('id')
              .eq('game_id', game.id);
            
            if (allRounds) {
              const roundIds = allRounds.map(r => r.id);
              const { data: allCluesData } = await supabase
                .from('clues')
                .select('*')
                .in('round_id', roundIds)
                .order('created_at');
              
              if (allCluesData) setAllClues(allCluesData as Clue[]);
            }
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
        async (payload) => {
          console.log('Vote change received:', payload.eventType);
          const { data } = await supabase
            .from('votes')
            .select('*')
            .eq('game_id', game.id);
          if (data) setVotes(data as Vote[]);
        }
      )
      .subscribe((status) => {
        console.log('Game subscription status:', status);
      });

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [game?.id, game?.current_round_number, currentRound?.id]);

  return {
    lobby,
    players,
    game,
    currentRound,
    clues,
    allClues,
    votes,
    secretWord
  };
};
