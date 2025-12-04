import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Send, Eye, EyeOff, Users, CheckCircle2 } from 'lucide-react';

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
  const { lobby, players, game, currentRound, clues, allClues, votes, secretWord } = useGameState(lobbyId || null);
  const [clueInput, setClueInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const userId = getStoredUserId();

  // Shuffle players based on game ID - same order for all rounds
  const shuffledPlayers = useMemo(() => {
    if (!game?.id || players.length === 0) return players;
    return getShuffledPlayersForGame(players, game.id);
  }, [game?.id, players]);

  const currentPlayer = players.find(p => p.user_id === userId);
  const isOutsider = game?.outsider_player_id === currentPlayer?.id;
  const hasSubmittedClue = clues.some(c => c.player_id === currentPlayer?.id);
  const hasVoted = votes.some(v => v.voter_player_id === currentPlayer?.id);

  // Calculate whose turn it is based on clues submitted THIS ROUND
  const currentTurnIndex = clues.length;
  const currentTurnPlayer = shuffledPlayers[currentTurnIndex];
  const isMyTurn = currentTurnPlayer?.id === currentPlayer?.id;

  // Debug logging
  useEffect(() => {
    if (game && currentPlayer) {
      console.log('Game outsider check:', {
        outsiderPlayerId: game.outsider_player_id,
        currentPlayerId: currentPlayer.id,
        currentPlayerName: currentPlayer.display_name,
        isOutsider,
        match: game.outsider_player_id === currentPlayer.id
      });
    }
  }, [game?.outsider_player_id, currentPlayer?.id, isOutsider]);

  useEffect(() => {
    if (!game || !currentPlayer) return;

    // Only host handles round transitions to prevent race conditions
    if (!currentPlayer.is_host) return;

    // Add delay to ensure all clients receive real-time updates before transitioning
    const timer = setTimeout(() => {
      // Check if all clues submitted for current round (each player has submitted once this round)
      if (currentRound && !currentRound.is_complete && clues.length === shuffledPlayers.length) {
        checkRoundComplete();
      }

      // Check if all votes submitted
      if (game.status === 'voting' && votes.length === shuffledPlayers.length) {
        moveToResults();
      }
    }, 500); // 500ms delay for sync

    return () => clearTimeout(timer);
  }, [clues.length, votes.length, shuffledPlayers.length, currentRound, game, currentPlayer]);

  const checkRoundComplete = async () => {
    if (!currentRound || !game) return;

    try {
      await supabase
        .from('rounds')
        .update({ is_complete: true })
        .eq('id', currentRound.id);

      // Move to next round or voting
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
      } else {
        await supabase
          .from('games')
          .update({ status: 'voting' })
          .eq('id', game.id);
      }
    } catch (error) {
      console.error('Error completing round:', error);
    }
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
      await supabase
        .from('votes')
        .insert({
          game_id: game.id,
          voter_player_id: currentPlayer.id,
          suspected_outsider_player_id: suspectedPlayerId
        });

      setSelectedVote(suspectedPlayerId);
      toast.success('Vote submitted!');
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
          <div className="max-w-md mx-auto text-center">
            <p className="text-sm text-muted-foreground">
              Round {game.current_round_number} of {game.total_rounds}
            </p>
            <h1 className="text-xl font-bold">
              {isMyTurn && !hasSubmittedClue ? "Your Turn!" : "Submit Your Clue"}
            </h1>
          </div>
        </header>

        <main className="p-4 max-w-md mx-auto space-y-6 py-6">
          {isOutsider ? (
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
            <Card className={`p-4 ${isMyTurn ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}>
              <div className="text-center">
                {isMyTurn ? (
                  <p className="font-semibold text-primary">It's your turn to give a clue!</p>
                ) : (
                  <p className="text-muted-foreground">
                    Waiting for <span className="font-semibold text-foreground">{currentTurnPlayer.display_name}</span> to submit their clue...
                  </p>
                )}
              </div>
            </Card>
          )}

          {!hasSubmittedClue && isMyTurn ? (
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
          ) : hasSubmittedClue ? (
            <Card className="p-6 bg-gradient-card border-border text-center">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
              <h3 className="font-bold text-lg mb-1">Clue Submitted!</h3>
            <p className="text-sm text-muted-foreground">
                {clues.length === shuffledPlayers.length 
                  ? "All clues submitted! Moving to next round..."
                  : `Waiting for ${shuffledPlayers.length - clues.length} other player(s)...`}
              </p>
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
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-xl font-bold">Vote for the Outsider</h1>
            <p className="text-sm text-muted-foreground">
              Who didn't know: "{secretWord.text}"?
            </p>
          </div>
        </header>

        <main className="p-4 max-w-md mx-auto space-y-6 py-6">
          <Card className="p-6 bg-gradient-primary text-white shadow-card border-0 text-center">
            <p className="text-white/80 text-sm mb-1">The secret word was</p>
            <h2 className="text-3xl font-bold">{secretWord.text}</h2>
          </Card>

          {!hasVoted ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">
                Select a player:
              </h3>
              <div className="space-y-2">
                {players.map((player) => (
                  <Button
                    key={player.id}
                    onClick={() => submitVote(player.id)}
                    disabled={isSubmitting || player.id === currentPlayer?.id}
                    variant={selectedVote === player.id ? 'default' : 'outline'}
                    className="w-full h-14 text-base justify-start"
                  >
                    {player.display_name}
                    {player.id === currentPlayer?.id && ' (You)'}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <Card className="p-6 bg-gradient-card border-border text-center">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
              <h3 className="font-bold text-lg mb-1">Vote Submitted!</h3>
              <p className="text-sm text-muted-foreground">
                Waiting for {shuffledPlayers.length - votes.length} other vote(s)...
              </p>
            </Card>
          )}
        </main>
      </div>
    );
  }

  return null;
};

export default Game;
