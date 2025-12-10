import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Trophy, XCircle, Home, RotateCcw, UserMinus, DoorOpen } from 'lucide-react';
import Confetti from '@/components/Confetti';

const Results = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { lobby, players, game, votes, secretWord, outsiders } = useGameState(lobbyId || null);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const userId = getStoredUserId();

  const isHost = lobby?.host_user_id === userId;
  const outsiderPlayers = players.filter(p => outsiders.some(o => o.player_id === p.id));

  
  // When a new game is started (play again), navigate everyone to the new game
  useEffect(() => {
    console.log('Results lobby state changed:', {
      status: lobby?.status,
      currentGameId: lobby?.current_game_id,
      lobbyId,
    });

    if (lobby?.status === 'in_progress' && lobby.current_game_id) {
      console.log('Results: navigating to new game for lobby', lobbyId);
      navigate(`/game/${lobbyId}`);
    }
  }, [lobby?.status, lobby?.current_game_id, lobbyId, navigate]);
  
  // Calculate vote results
  const votesByPlayer = players.map(player => {
    const votesReceived = votes.filter(v => v.suspected_outsider_player_id === player.id).length;
    return { player, votesReceived };
  });

  // For elimination mode: check if all outsiders are spectators (group wins) or if outsiders have majority
  const isEliminationMode = game?.game_mode === 'elimination';
  const activePlayers = players.filter(p => !p.is_spectator);
  const activeOutsiders = outsiders.filter(o => activePlayers.some(p => p.id === o.player_id));
  
  const groupWins = isEliminationMode 
    ? activeOutsiders.length === 0 // All outsiders eliminated
    : votes.filter(v => outsiders.some(o => o.player_id === v.suspected_outsider_player_id)).length >= players.length / 2;

  const playAgain = async () => {
    if (!isHost || !lobbyId) return;

    setIsResetting(true);
    try {
      // Reset all spectators back to active players for the new game
      const { error: resetError } = await supabase
        .from('lobby_players')
        .update({ is_spectator: false })
        .eq('lobby_id', lobbyId);

      if (resetError) {
        console.error('Error resetting spectators:', resetError);
      }

      // Get random word
      const { data: words } = await supabase
        .from('words')
        .select('*');
      
      if (!words || words.length === 0) {
        toast.error('No words available');
        setIsResetting(false);
        return;
      }

      const randomWord = words[Math.floor(Math.random() * words.length)];

      // Get fresh player list after resetting spectators
      const { data: freshPlayers } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', lobbyId);

      if (!freshPlayers || freshPlayers.length === 0) {
        toast.error('No players in lobby');
        setIsResetting(false);
        return;
      }

      // Pick random outsider from fresh player list
      const randomOutsider = freshPlayers[Math.floor(Math.random() * freshPlayers.length)];

      // Create new game
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          lobby_id: lobbyId,
          secret_word_id: randomWord.id,
          outsider_player_id: randomOutsider.id,
          total_rounds: 3,
          current_round_number: 1,
          status: 'clue_round'
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // Create first round
      const { error: roundError } = await supabase
        .from('rounds')
        .insert({
          game_id: newGame.id,
          round_number: 1,
          is_complete: false
        });

      if (roundError) throw roundError;

      // Update lobby
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .update({
          status: 'in_progress',
          current_game_id: newGame.id
        })
        .eq('id', lobbyId);

      if (lobbyError) throw lobbyError;

      toast.success('New game started!');
      navigate(`/game/${lobbyId}`);
    } catch (error) {
      console.error('Error starting new game:', error);
      toast.error('Failed to start new game');
      setIsResetting(false);
    }
  };

  const goHome = async () => {
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

  const kickPlayer = async (playerId: string, playerName: string) => {
    if (!isHost || !lobbyId) return;

    try {
      await supabase
        .from('lobby_players')
        .delete()
        .eq('id', playerId)
        .eq('lobby_id', lobbyId);

      toast.success(`${playerName} has been removed from the lobby`);
    } catch (error) {
      console.error('Error kicking player:', error);
      toast.error('Failed to remove player');
    }
  };

  if (!game || !secretWord || outsiderPlayers.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  // Trigger confetti on group win
  useEffect(() => {
    if (groupWins && game && secretWord) {
      setShowConfetti(true);
    }
  }, [groupWins, game, secretWord]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Confetti isActive={showConfetti} />
      
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="w-10" />
          <h1 className="text-xl font-bold">Game Results</h1>
          <Button variant="ghost" size="sm" onClick={goHome} className="gap-1 text-muted-foreground">
            <DoorOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6 py-6">
        <Card className={`p-6 shadow-card border-0 text-center animate-bounce-in ${
          groupWins ? 'bg-gradient-primary text-white' : 'bg-destructive/10 border-destructive/20'
        }`}>
          {groupWins ? (
            <>
              <Trophy className="h-16 w-16 mx-auto mb-3 text-white animate-float" />
              <h2 className="text-2xl font-bold mb-2">Group Wins!</h2>
              <p className="text-white/90">
                You found the imposter! Great job detectives!
              </p>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-3 animate-shake" />
              <h2 className="text-2xl font-bold text-destructive mb-2">Imposter Wins!</h2>
              <p className="text-muted-foreground">
                The imposter fooled everyone!
              </p>
            </>
          )}
        </Card>

        <Card className="p-6 bg-gradient-card border-border">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-1">The secret word was</p>
            <h3 className="text-3xl font-bold text-primary">{secretWord.text}</h3>
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-1">
              {outsiderPlayers.length > 1 ? 'The outsiders were' : 'The outsider was'}
            </p>
            <h4 className="text-xl font-bold">
              {outsiderPlayers.map(p => p.display_name).join(', ')}
            </h4>
          </div>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Vote Results
          </h3>
          <div className="space-y-2">
            {votesByPlayer
              .sort((a, b) => b.votesReceived - a.votesReceived)
              .map(({ player, votesReceived }) => (
                <Card key={player.id} className="p-4 bg-gradient-card border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{player.display_name}</span>
                      {outsiders.some(o => o.player_id === player.id) && (
                        <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-full">
                          Outsider
                        </span>
                      )}
                      {player.is_host && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          Host
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="font-bold text-primary">{votesReceived}</span>
                        <span className="text-muted-foreground"> votes</span>
                      </div>
                      {isHost && player.user_id !== userId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => kickPlayer(player.id, player.display_name)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </div>

        <div className="space-y-3 pt-4">
          {isHost && (
            <Button
              onClick={playAgain}
              disabled={isResetting}
              className="w-full h-14 text-lg"
              size="lg"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              {isResetting ? 'Starting...' : 'Play Again'}
            </Button>
          )}
          <Button
            onClick={goHome}
            variant="outline"
            className="w-full h-12 text-base"
          >
            <Home className="h-5 w-5 mr-2" />
            Leave Lobby
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Results;
