import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Lobby, LobbyPlayer, Game, Round, Clue, Vote, Word } from '@/types/game';

export const useGameState = (lobbyId: string | null) => {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [secretWord, setSecretWord] = useState<Word | null>(null);

  useEffect(() => {
    if (!lobbyId) return;

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

    // Set up real-time subscriptions
    const lobbyChannel = supabase
      .channel(`lobby-${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobbyId}`
        },
        (payload) => {
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
        async () => {
          const { data } = await supabase
            .from('lobby_players')
            .select('*')
            .eq('lobby_id', lobbyId)
            .order('joined_at');
          if (data) setPlayers(data as LobbyPlayer[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lobbyChannel);
    };
  }, [lobbyId]);

  // Subscribe to game changes
  useEffect(() => {
    if (!game?.id) return;

    const gameChannel = supabase
      .channel(`game-${game.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${game.id}`
        },
        async (payload) => {
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
        async () => {
          if (currentRound) {
            const { data } = await supabase
              .from('clues')
              .select('*')
              .eq('round_id', currentRound.id)
              .order('created_at');
            if (data) setClues(data as Clue[]);
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
        async () => {
          const { data } = await supabase
            .from('votes')
            .select('*')
            .eq('game_id', game.id);
          if (data) setVotes(data as Vote[]);
        }
      )
      .subscribe();

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
    votes,
    secretWord
  };
};
