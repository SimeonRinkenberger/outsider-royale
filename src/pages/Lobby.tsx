import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Copy, Users, Crown, ArrowLeft, Play } from 'lucide-react';

const Lobby = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { lobby, players } = useGameState(lobbyId || null);
  const [isStarting, setIsStarting] = useState(false);
  const userId = getStoredUserId();

  const isHost = lobby?.host_user_id === userId;
  const canStart = players.length >= 3;

  useEffect(() => {
    if (lobby?.status !== 'waiting' && lobby?.current_game_id) {
      navigate(`/game/${lobbyId}`);
    }
  }, [lobby?.status, lobby?.current_game_id, lobbyId, navigate]);

  const copyCode = () => {
    if (lobby?.code) {
      navigator.clipboard.writeText(lobby.code);
      toast.success('Code copied!');
    }
  };

  const leaveLobby = async () => {
    if (!userId || !lobbyId) return;

    try {
      await supabase
        .from('lobby_players')
        .delete()
        .eq('lobby_id', lobbyId)
        .eq('user_id', userId);

      toast.success('Left lobby');
      navigate('/home');
    } catch (error) {
      console.error('Error leaving lobby:', error);
      toast.error('Failed to leave lobby');
    }
  };

  const startGame = async () => {
    if (!isHost || !lobbyId || !canStart) return;

    setIsStarting(true);
    try {
      // Get random word
      const { data: words } = await supabase
        .from('words')
        .select('*');
      
      if (!words || words.length === 0) {
        toast.error('No words available');
        setIsStarting(false);
        return;
      }

      const randomWord = words[Math.floor(Math.random() * words.length)];

      // Pick random outsider
      const randomOutsider = players[Math.floor(Math.random() * players.length)];
      console.log('Starting game with outsider:', {
        outsiderName: randomOutsider.display_name,
        outsiderId: randomOutsider.id,
        allPlayers: players.map(p => ({ name: p.display_name, id: p.id }))
      });

      // Create game
      const { data: game, error: gameError } = await supabase
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
          game_id: game.id,
          round_number: 1,
          is_complete: false
        });

      if (roundError) throw roundError;

      // Update lobby
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .update({
          status: 'in_progress',
          current_game_id: game.id
        })
        .eq('id', lobbyId);

      if (lobbyError) throw lobbyError;

      toast.success('Game started!');
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('Failed to start game');
      setIsStarting(false);
    }
  };

  if (!lobby) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={leaveLobby}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Lobby</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6 py-6">
        <Card className="p-6 bg-gradient-primary text-white shadow-card border-0">
          <div className="text-center space-y-4">
            <div>
              <p className="text-white/80 text-sm mb-1">Lobby Code</p>
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-4xl font-bold font-mono tracking-wider">
                  {lobby.code}
                </h2>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={copyCode}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-white/90 text-sm">
              Share this code with friends to join
            </p>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Players ({players.length})
            </h3>
            {!canStart && (
              <p className="text-xs text-muted-foreground">
                Need {3 - players.length} more
              </p>
            )}
          </div>

          <div className="space-y-2">
            {players.map((player) => (
              <Card key={player.id} className="p-4 bg-gradient-card border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{player.display_name}</p>
                      {player.is_host && (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <Crown className="h-3 w-3" />
                          Host
                        </p>
                      )}
                    </div>
                  </div>
                  {player.is_connected ? (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto">
            <Button
              onClick={startGame}
              disabled={!canStart || isStarting}
              className="w-full h-14 text-lg shadow-lg"
              size="lg"
            >
              <Play className="h-5 w-5 mr-2" />
              {isStarting ? 'Starting...' : 'Start Game'}
            </Button>
            {!canStart && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                At least 3 players needed (4+ recommended)
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Lobby;
