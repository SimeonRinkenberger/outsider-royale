import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { generateLobbyCode, getStoredUserId, getStoredDisplayName } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Plus, LogIn } from 'lucide-react';
import GameHeader from '@/components/GameHeader';
import { usePageTransition } from '@/components/PageTransition';

const Home = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const { navigateWithTransitionFromCoords } = usePageTransition();

  const createLobby = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    const userId = getStoredUserId();
    const displayName = getStoredDisplayName();
    if (!userId || !displayName) {
      navigate('/');
      return;
    }

    // Capture button position before async
    let buttonX = window.innerWidth / 2;
    let buttonY = window.innerHeight / 2;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      buttonX = rect.left + rect.width / 2;
      buttonY = rect.top + rect.height / 2;
    }

    setIsCreating(true);
    try {
      const code = generateLobbyCode();
      
      const { data: lobby, error: lobbyError } = await supabase
        .from('lobbies')
        .insert({ code, host_user_id: userId })
        .select()
        .single();

      if (lobbyError) throw lobbyError;

      const { error: playerError } = await supabase
        .from('lobby_players')
        .insert({
          lobby_id: lobby.id,
          user_id: userId,
          display_name: displayName,
          is_host: true
        });

      if (playerError) throw playerError;

      toast.success('Lobby created!');
      setIsCreating(false);
      navigateWithTransitionFromCoords(`/lobby/${lobby.id}`, buttonX, buttonY);
    } catch (error) {
      console.error('Error creating lobby:', error);
      toast.error('Failed to create lobby');
      setIsCreating(false);
    }
  };

  const joinLobby = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    const userId = getStoredUserId();
    const displayName = getStoredDisplayName();
    if (!userId || !displayName) {
      navigate('/');
      return;
    }

    if (!joinCode.trim()) {
      toast.error('Please enter a lobby code');
      return;
    }

    // Capture button position before async
    let buttonX = window.innerWidth / 2;
    let buttonY = window.innerHeight / 2;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      buttonX = rect.left + rect.width / 2;
      buttonY = rect.top + rect.height / 2;
    }

    setIsJoining(true);
    try {
      // Allow joining lobbies that are waiting or showing results (between games)
      const { data: lobby, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .in('status', ['waiting', 'results'])
        .single();

      if (lobbyError || !lobby) {
        toast.error('Lobby not found or game in progress');
        setIsJoining(false);
        return;
      }

      // Check if already in lobby
      const { data: existing } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', lobby.id)
        .eq('user_id', userId)
        .single();

      if (existing) {
        setIsJoining(false);
        navigateWithTransitionFromCoords(`/lobby/${lobby.id}`, buttonX, buttonY);
        return;
      }

      // Check if this user is the original host
      const isOriginalHost = lobby.host_user_id === userId;

      const { error: playerError } = await supabase
        .from('lobby_players')
        .insert({
          lobby_id: lobby.id,
          user_id: userId,
          display_name: displayName,
          is_host: isOriginalHost
        });

      if (playerError) throw playerError;

      toast.success('Joined lobby!');
      setIsJoining(false);
      navigateWithTransitionFromCoords(`/lobby/${lobby.id}`, buttonX, buttonY);
    } catch (error) {
      console.error('Error joining lobby:', error);
      toast.error('Failed to join lobby');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <GameHeader title="Outsider Royale" showBack={true} backPath="/menu" />

      <main className="p-4 max-w-md mx-auto space-y-6 py-8">
        <Card className="p-6 bg-gradient-primary text-white shadow-card border-0 animate-fade-in-up hover:scale-[1.02] transition-transform duration-300">
          <h2 className="text-2xl font-bold mb-2">Find the Outsider!</h2>
          <p className="text-white/90">
            One player doesn't know the secret word. Can the group find them?
          </p>
        </Card>

        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Button
            onClick={(e) => createLobby(e)}
            disabled={isCreating}
            className="w-full h-14 text-lg transition-all duration-200 hover:scale-[1.02] active:scale-95"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            {isCreating ? 'Creating...' : 'Create Lobby'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Enter lobby code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="h-12 text-base text-center text-lg font-mono transition-all duration-200 focus:scale-[1.02]"
              onKeyDown={(e) => e.key === 'Enter' && joinLobby()}
            />
            <Button
              onClick={(e) => joinLobby(e)}
              disabled={isJoining || !joinCode.trim()}
              variant="secondary"
              className="w-full h-14 text-lg transition-all duration-200 hover:scale-[1.02] active:scale-95"
              size="lg"
            >
              <LogIn className="h-5 w-5 mr-2" />
              {isJoining ? 'Joining...' : 'Join Lobby'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
