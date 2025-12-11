import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { useTurnChime } from '@/hooks/useTurnChime';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Send, Eye, EyeOff, Users, CheckCircle2, DoorOpen, FastForward, ArrowRight } from 'lucide-react';
import { ActiveModifiersDisplay } from '@/components/ActiveModifiersDisplay';

interface GameMetadata {
  customWord: string | null;
  customCategory: string | null;
  modifiers: string[];
  imposterCustomWord: string | null;
}

// Seeded random shuffle - ensures all clients get the same order for a given seed
const seededShuffle = <T,>(array: T[], seed: string): T[] => {
  const shuffled = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const j = Math.abs(hash) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Get shuffled players for a game (same order all rounds)
const getShuffledPlayersForGame = <T,>(players: T[], gameId: string): T[] => {
  return seededShuffle(players, gameId);
};

const Game = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { lobby, players, game, currentRound, clues, allClues, votes, secretWord, imposterWord, outsiders } = useGameState(lobbyId || null);
  const [clueInput, setClueInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [skipVote, setSkipVote] = useState(false);
  const [gameMetadata, setGameMetadata] = useState<GameMetadata | null>(null);
  const userId = getStoredUserId();

  // Load game metadata (modifiers, custom words) from localStorage
  useEffect(() => {
    if (game?.id) {
      const stored = localStorage.getItem(`game-metadata-${game.id}`);
      if (stored) {
        try {
          setGameMetadata(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse game metadata:', e);
        }
      }
    }
  }, [game?.id]);

  const leaveLobby = async () => {
    if (!userId || !lobbyId) return;
    try {
      await supabase
        .from('lobby_players')
        .delete()
        .eq('lobby_id', lobbyId)
        .eq('user_id', userId);
      navigate('/home');
    } catch (error) {
      console.error('Error leaving lobby:', error);
      toast.error('Failed to leave lobby');
    }
  };

  // Filter out spectators for active players
  const activePlayers = useMemo(() => {
    return players.filter(p => !p.is_spectator);
  }, [players]);

  // Shuffle players based on game ID - same order for all rounds
  const shuffledPlayers = useMemo(() => {
    if (!game?.id || activePlayers.length === 0) return activePlayers;
    return getShuffledPlayersForGame(activePlayers, game.id);
  }, [game?.id, activePlayers]);

  const currentPlayer = players.find(p => p.user_id === userId);
  const isSpectator = currentPlayer?.is_spectator ?? false;
  
  // Check if current player is an outsider (using outsiders array)
  const isOutsider = outsiders.some(o => o.player_id === currentPlayer?.id);
  const hasSubmittedClue = clues.some(c => c.player_id === currentPlayer?.id);
  const hasVoted = votes.some(v => v.voter_player_id === currentPlayer?.id);

  // Calculate whose turn it is based on clues submitted THIS ROUND (only active players)
  const currentTurnIndex = clues.length;
  const currentTurnPlayer = shuffledPlayers[currentTurnIndex];
  const isMyTurn = currentTurnPlayer?.id === currentPlayer?.id && !isSpectator;

  // Play chime when it's the player's turn
  useTurnChime(isMyTurn, hasSubmittedClue);

  // Determine what word to show based on game mode
  const displayWord = useMemo(() => {
    if (!game || !secretWord) return null;
    
    if (game.game_mode === 'hidden_imposter') {
      // In hidden_imposter mode, everyone sees a word but imposters see imposterWord
      return isOutsider && imposterWord ? imposterWord : secretWord;
    }
    
    // In classic and elimination modes, outsiders don't see the word
    return isOutsider ? null : secretWord;
  }, [game?.game_mode, secretWord, imposterWord, isOutsider]);

  // Debug logging
  useEffect(() => {
    if (game && currentPlayer) {
      console.log('Game outsider check:', {
        outsiders: outsiders.map(o => o.player_id),
        currentPlayerId: currentPlayer.id,
        currentPlayerName: currentPlayer.display_name,
        isOutsider,
        outsiderCount: outsiders.length
      });
    }
  }, [outsiders, currentPlayer?.id, isOutsider]);

  // Track if all clues are submitted for this round
  const allCluesSubmitted = clues.length === shuffledPlayers.length;
  const isLastRound = game?.game_mode === 'elimination' ? false : game?.current_round_number === game?.total_rounds;
  const isEliminationMode = game?.game_mode === 'elimination';
  const isHiddenImposterMode = game?.game_mode === 'hidden_imposter';

  // For elimination mode: check win conditions
  const outsiderCount = outsiders.length;
  const nonOutsiderCount = activePlayers.length - outsiders.filter(o => activePlayers.some(p => p.id === o.player_id)).length;
  const outsidersWinByMajority = outsiderCount >= activePlayers.length / 2;

  useEffect(() => {
    if (!game || !currentPlayer) return;

    // Only host handles vote results transition
    if (!currentPlayer.is_host) return;

    console.log('Vote check:', {
      gameStatus: game.status,
      votesCount: votes.length,
      shuffledPlayersCount: shuffledPlayers.length,
      activePlayersCount: activePlayers.length,
      playersCount: players.length,
      isEliminationMode,
      isHost: currentPlayer.is_host
    });

    const timer = setTimeout(async () => {
      // Check if all votes submitted (for non-elimination modes)
      // Use players.length for classic mode since all players vote
      if (!isEliminationMode && game.status === 'voting' && votes.length === players.filter(p => !p.is_spectator).length) {
        console.log('Moving to results - classic mode');
        moveToResults();
      }
      
      // For elimination mode: check if all active players voted (including skips)
      if (isEliminationMode && game.status === 'voting' && votes.length === activePlayers.length) {
        console.log('Processing elimination votes');
        await processEliminationVotes();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [votes.length, shuffledPlayers.length, activePlayers.length, players.length, game, currentPlayer, isEliminationMode]);

  const startNextRound = async () => {
    if (!currentRound || !game || !currentPlayer?.is_host) return;

    try {
      // Mark current round as complete
      await supabase
        .from('rounds')
        .update({ is_complete: true })
        .eq('id', currentRound.id);

      // For elimination mode, always go to voting after each round
      if (isEliminationMode) {
        await supabase
          .from('games')
          .update({ status: 'voting' })
          .eq('id', game.id);
        toast.success('Moving to voting!');
        return;
      }

      if (game.current_round_number < game.total_rounds) {
        const nextRound = game.current_round_number + 1;
        
        const { data: newRound } = await supabase
          .from('rounds')
          .insert({
            game_id: game.id,
            round_number: nextRound,
            is_complete: false
          })
          .select()
          .single();

        if (newRound) {
          await supabase
            .from('games')
            .update({ current_round_number: nextRound })
            .eq('id', game.id);
        }
        toast.success(`Round ${nextRound} started!`);
      } else {
        await supabase
          .from('games')
          .update({ status: 'voting' })
          .eq('id', game.id);
        toast.success('Moving to voting!');
      }
    } catch (error) {
      console.error('Error starting next round:', error);
      toast.error('Failed to start next round');
    }
  };

  const processEliminationVotes = async () => {
    if (!game || !currentPlayer?.is_host) return;

    // Count votes for each player (excluding skip votes - where voter voted for themselves)
    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
      // Skip votes are marked by voting for yourself
      if (v.suspected_outsider_player_id !== v.voter_player_id) {
        voteCounts[v.suspected_outsider_player_id] = (voteCounts[v.suspected_outsider_player_id] || 0) + 1;
      }
    });

    // Find player with most votes (if they have majority)
    const majorityThreshold = Math.ceil(activePlayers.length / 2);
    let eliminatedPlayerId: string | null = null;
    
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count >= majorityThreshold) {
        eliminatedPlayerId = playerId;
      }
    });

    if (eliminatedPlayerId) {
      // Eliminate this player (make them spectator)
      await supabase
        .from('lobby_players')
        .update({ is_spectator: true })
        .eq('id', eliminatedPlayerId);

      const eliminatedPlayer = players.find(p => p.id === eliminatedPlayerId);
      toast.success(`${eliminatedPlayer?.display_name} has been eliminated!`);

      // Check if outsider was eliminated or if game should end
      const wasOutsider = outsiders.some(o => o.player_id === eliminatedPlayerId);
      const remainingActivePlayers = activePlayers.filter(p => p.id !== eliminatedPlayerId);
      const remainingOutsiders = outsiders.filter(o => remainingActivePlayers.some(p => p.id === o.player_id));
      
      // Check end conditions
      if (remainingOutsiders.length === 0) {
        // All outsiders eliminated - group wins
        await supabase
          .from('games')
          .update({ status: 'results' })
          .eq('id', game.id);
        await supabase
          .from('lobbies')
          .update({ status: 'results' })
          .eq('id', lobbyId);
        return;
      }

      if (remainingOutsiders.length >= remainingActivePlayers.length / 2) {
        // Outsiders have majority - outsiders win
        await supabase
          .from('games')
          .update({ status: 'results' })
          .eq('id', game.id);
        await supabase
          .from('lobbies')
          .update({ status: 'results' })
          .eq('id', lobbyId);
        return;
      }
    }

    // Continue to next round - clear votes and start new round
    await supabase
      .from('votes')
      .delete()
      .eq('game_id', game.id);

    const nextRound = game.current_round_number + 1;
    const { data: newRound } = await supabase
      .from('rounds')
      .insert({
        game_id: game.id,
        round_number: nextRound,
        is_complete: false
      })
      .select()
      .single();

    if (newRound) {
      await supabase
        .from('games')
        .update({ 
          current_round_number: nextRound,
          status: 'clue_round'
        })
        .eq('id', game.id);
    }
    
    setSelectedVote(null);
    setSkipVote(false);
    toast.success(`Round ${nextRound} started!`);
  };

  const moveToResults = async () => {
    if (!game) return;

    try {
      await supabase
        .from('games')
        .update({ status: 'results' })
        .eq('id', game.id);

      await supabase
        .from('lobbies')
        .update({ status: 'results' })
        .eq('id', lobbyId);
    } catch (error) {
      console.error('Error moving to results:', error);
    }
  };

  const skipToVoting = async () => {
    if (!game || !currentPlayer?.is_host || !currentRound) return;

    try {
      // Mark current round as complete
      await supabase
        .from('rounds')
        .update({ is_complete: true })
        .eq('id', currentRound.id);

      // Skip directly to voting
      await supabase
        .from('games')
        .update({ status: 'voting' })
        .eq('id', game.id);

      toast.success('Skipped to voting!');
    } catch (error) {
      console.error('Error skipping to voting:', error);
      toast.error('Failed to skip to voting');
    }
  };

  const submitClue = async () => {
    if (!currentPlayer || !currentRound || !clueInput.trim() || !game) return;

    setIsSubmitting(true);
    try {
      // Server-side validation: get clue count for CURRENT ROUND ONLY
      const { count } = await supabase
        .from('clues')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', currentRound.id);
      
      // Get shuffled order for this game (same for all rounds)
      const gameShuffledPlayers = getShuffledPlayersForGame(players, game.id);
      const currentTurn = count || 0;
      const expectedPlayer = gameShuffledPlayers[currentTurn];
      
      if (expectedPlayer?.id !== currentPlayer.id) {
        toast.error("It's not your turn!");
        setIsSubmitting(false);
        return;
      }

      await supabase
        .from('clues')
        .insert({
          round_id: currentRound.id,
          player_id: currentPlayer.id,
          clue_text: clueInput.trim()
        });

      setClueInput('');
      toast.success('Clue submitted!');
    } catch (error) {
      console.error('Error submitting clue:', error);
      toast.error('Failed to submit clue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitVote = async (suspectedPlayerId: string) => {
    if (!currentPlayer || !game || hasVoted) return;

    setIsSubmitting(true);
    try {
      // For skip votes in elimination mode, insert with voter's own ID as a marker
      // This will be filtered out in vote counting since you can't vote for yourself normally
      const voteTarget = suspectedPlayerId === 'skip' ? currentPlayer.id : suspectedPlayerId;
      
      await supabase
        .from('votes')
        .insert({
          game_id: game.id,
          voter_player_id: currentPlayer.id,
          suspected_outsider_player_id: voteTarget
        });

      setSelectedVote(suspectedPlayerId);
      setSkipVote(suspectedPlayerId === 'skip');
      toast.success(suspectedPlayerId === 'skip' ? 'Vote skipped!' : 'Vote submitted!');
    } catch (error) {
      console.error('Error submitting vote:', error);
      toast.error('Failed to submit vote');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (game?.status === 'results') {
      navigate(`/results/${lobbyId}`);
    }
  }, [game?.status, lobbyId, navigate]);

  if (!game || !secretWord || !currentRound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  // Clue Round View
  if (game.status === 'clue_round') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="w-10" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {isEliminationMode ? `Round ${game.current_round_number}` : `Round ${game.current_round_number} of ${game.total_rounds}`}
              </p>
              <h1 className="text-xl font-bold">
                {isSpectator ? "Spectating" : isMyTurn && !hasSubmittedClue ? "Your Turn!" : "Submit Your Clue"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {currentPlayer?.is_host && (
                <Button variant="ghost" size="sm" onClick={skipToVoting} className="gap-1 text-muted-foreground">
                  <FastForward className="h-4 w-4" />
                  <span className="hidden sm:inline">Skip</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={leaveLobby} className="gap-1 text-muted-foreground">
                <DoorOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Leave</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 max-w-md mx-auto space-y-6 py-6">
          {/* Active Modifiers Banner */}
          {gameMetadata?.modifiers && gameMetadata.modifiers.length > 0 && (
            <ActiveModifiersDisplay modifiers={gameMetadata.modifiers} />
          )}
          
          {isSpectator ? (
            <Card className="p-6 bg-muted/50 border-border">
              <div className="text-center space-y-2">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto" />
                <h2 className="text-xl font-bold text-muted-foreground">You're a Spectator</h2>
                <p className="text-sm text-muted-foreground">
                  You've been eliminated. Watch the game unfold!
                </p>
                <p className="text-lg font-bold text-primary mt-4">Secret Word: {secretWord.text}</p>
                <p className="text-sm text-muted-foreground">
                  Outsider{outsiders.length > 1 ? 's' : ''}: {players.filter(p => outsiders.some(o => o.player_id === p.id)).map(p => p.display_name).join(', ')}
                </p>
              </div>
            </Card>
          ) : isHiddenImposterMode ? (
            <Card className="p-6 bg-gradient-primary text-white shadow-card border-0">
              <div className="text-center space-y-2">
                <Eye className="h-8 w-8 mx-auto" />
                <p className="text-white/80 text-sm">Your Word</p>
                <h2 className="text-4xl font-bold">{displayWord?.text}</h2>
                <p className="text-white/90 text-sm">
                  Give a clue that relates to this word
                </p>
              </div>
            </Card>
          ) : isOutsider ? (
            <Card className="p-6 bg-destructive/10 border-destructive/20">
              <div className="text-center space-y-2">
                <EyeOff className="h-12 w-12 text-destructive mx-auto" />
                <h2 className="text-xl font-bold text-destructive">You're the Outsider!</h2>
                <p className="text-sm text-muted-foreground">
                  You don't know the secret word. Try to blend in by guessing what it might be from others' clues!
                </p>
              </div>
            </Card>
          ) : (
            <Card className="p-6 bg-gradient-primary text-white shadow-card border-0">
              <div className="text-center space-y-2">
                <Eye className="h-8 w-8 mx-auto" />
                <p className="text-white/80 text-sm">Secret Word</p>
                <h2 className="text-4xl font-bold">{secretWord.text}</h2>
                <p className="text-white/90 text-sm">
                  Give a clue that relates to this word
                </p>
              </div>
            </Card>
          )}

          {/* Turn indicator */}
          {!hasSubmittedClue && currentTurnPlayer && (
            <Card className={`p-4 transition-all duration-300 ${isMyTurn ? 'bg-primary/10 border-primary animate-pulse-glow' : 'bg-muted/50 border-border'}`}>
              <div className="text-center">
                {isMyTurn ? (
                  <p className="font-semibold text-primary animate-bounce-in">It's your turn to give a clue!</p>
                ) : (
                  <p className="text-muted-foreground">
                    Waiting for <span className="font-semibold text-foreground">{currentTurnPlayer.display_name}</span> to submit their clue...
                  </p>
                )}
              </div>
            </Card>
          )}

          {!isSpectator && !hasSubmittedClue && isMyTurn ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Clue</label>
                <Input
                  placeholder="Enter a one-word clue"
                  value={clueInput}
                  onChange={(e) => setClueInput(e.target.value)}
                  maxLength={30}
                  className="h-12 text-base"
                  onKeyDown={(e) => e.key === 'Enter' && submitClue()}
                />
                <p className="text-xs text-muted-foreground">
                  Keep it short and relevant!
                </p>
              </div>
              <Button
                onClick={submitClue}
                disabled={isSubmitting || !clueInput.trim()}
                className="w-full h-12"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit Clue'}
              </Button>
            </div>
          ) : !isSpectator && hasSubmittedClue ? (
            <Card className="p-6 bg-gradient-card border-border text-center space-y-4">
              <div>
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                <h3 className="font-bold text-lg mb-1">Clue Submitted!</h3>
                <p className="text-sm text-muted-foreground">
                  {allCluesSubmitted 
                    ? "All clues submitted! Waiting for host..."
                    : `Waiting for ${shuffledPlayers.length - clues.length} other player(s)...`}
                </p>
              </div>
              {currentPlayer?.is_host && allCluesSubmitted && (
                <Button onClick={startNextRound} className="w-full h-12">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {isEliminationMode ? 'Go to Voting' : isLastRound ? 'Go to Voting' : 'Next Round'}
                </Button>
              )}
            </Card>
          ) : null}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Turn Order ({clues.length}/{shuffledPlayers.length} this round)
            </h3>
            <div className="space-y-2">
              {shuffledPlayers.map((player, index) => {
                const playerClue = clues.find(c => c.player_id === player.id);
                const isCurrentTurn = index === currentTurnIndex && !playerClue;
                return (
                  <Card 
                    key={player.id} 
                    className={`p-4 border transition-colors ${
                      isCurrentTurn 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-gradient-card border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-medium">
                          {player.display_name}
                          {player.id === currentPlayer?.id && ' (You)'}
                        </span>
                        {isCurrentTurn && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            Turn
                          </span>
                        )}
                      </div>
                      {playerClue ? (
                        <span className="text-primary font-medium">"{playerClue.clue_text}"</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {isCurrentTurn ? 'Thinking...' : 'Waiting...'}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Voting View
  if (game.status === 'voting') {
    const votablePlayers = isEliminationMode ? activePlayers : players;
    
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="w-10" />
            <div className="text-center">
              <h1 className="text-xl font-bold">
                {isEliminationMode ? `Round ${game.current_round_number} Voting` : 'Vote for the Outsider'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isHiddenImposterMode 
                  ? `Who had a different word?`
                  : `Who didn't know: "${secretWord.text}"?`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={leaveLobby} className="gap-1 text-muted-foreground">
              <DoorOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          </div>
        </header>

        <main className="p-4 max-w-md mx-auto space-y-6 py-6">
          {/* Active Modifiers Banner */}
          {gameMetadata?.modifiers && gameMetadata.modifiers.length > 0 && (
            <ActiveModifiersDisplay modifiers={gameMetadata.modifiers} compact />
          )}
          
          {isSpectator ? (
            <Card className="p-6 bg-muted/50 border-border text-center">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <h3 className="font-bold text-lg mb-1">Spectating Voting</h3>
              <p className="text-sm text-muted-foreground">
                Watch as the remaining players vote.
              </p>
              <p className="text-lg font-bold text-primary mt-4">Secret Word: {secretWord.text}</p>
              <p className="text-sm text-muted-foreground">
                Outsider{outsiders.length > 1 ? 's' : ''}: {players.filter(p => outsiders.some(o => o.player_id === p.id)).map(p => p.display_name).join(', ')}
              </p>
            </Card>
          ) : (
            <>
              <Card className="p-6 bg-gradient-primary text-white shadow-card border-0 text-center">
                <p className="text-white/80 text-sm mb-1">The secret word was</p>
                <h2 className="text-3xl font-bold">{secretWord.text}</h2>
                {isHiddenImposterMode && imposterWord && (
                  <p className="text-white/80 text-sm mt-2">
                    Imposter word: <span className="font-bold">{imposterWord.text}</span>
                  </p>
                )}
              </Card>

              {!hasVoted ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground px-1">
                    Select a player{isEliminationMode ? ' (or skip)' : ''}:
                  </h3>
                  <div className="space-y-2">
                    {votablePlayers.map((player) => (
                      <Button
                        key={player.id}
                        onClick={() => submitVote(player.id)}
                        disabled={isSubmitting || player.id === currentPlayer?.id || player.is_spectator}
                        variant={selectedVote === player.id ? 'default' : 'outline'}
                        className="w-full h-14 text-base justify-start"
                      >
                        {player.display_name}
                        {player.id === currentPlayer?.id && ' (You)'}
                        {player.is_spectator && ' (Spectator)'}
                      </Button>
                    ))}
                    {isEliminationMode && (
                      <Button
                        onClick={() => submitVote('skip')}
                        disabled={isSubmitting}
                        variant={selectedVote === 'skip' ? 'default' : 'outline'}
                        className="w-full h-14 text-base justify-start text-muted-foreground"
                      >
                        Skip vote (no elimination)
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <Card className="p-6 bg-gradient-card border-border text-center">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                  <h3 className="font-bold text-lg mb-1">Vote Submitted!</h3>
                  <p className="text-sm text-muted-foreground">
                    Waiting for {activePlayers.length - votes.length} other vote(s)...
                  </p>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  return null;
};

export default Game;
