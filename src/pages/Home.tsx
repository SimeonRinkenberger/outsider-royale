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
import { useTransition } from '@/contexts/TransitionContext';

console.log('Home mounted');

const Home = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const { startTransition } = useTransition();

  const createLobby = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    const userId = getStoredUserId();
    const displayName = getStoredDisplayName();
    if (!userId || !displayName) {
      navigate('/');
      return;
    }

    // Capture button position
    let origin: { x: number; y: number } | undefined;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    
    startTransition('', {
      loadingText: 'Creating lobby',
      origin,
      prepare: async () => {
        setIsCreating(true);
        const code = generateLobbyCode();
        
        const { data: lobby, error: lobbyError } = await supabase
          .from('lobbies')
          .insert({ code, host_user_id: userId })
          .select()
          .single();

        if (lobbyError) {
          setIsCreating(false);
          toast.error('Failed to create lobby');
          throw lobbyError;
        }

        const { error: playerError } = await supabase
          .from('lobby_players')
          .insert({
            lobby_id: lobby.id,
            user_id: userId,
            display_name: displayName,
            is_host: true
          });

        if (playerError) {
          setIsCreating(false);
          toast.error('Failed to join lobby');
          throw playerError;
        }

        toast.success('Lobby created!');
        setIsCreating(false);
        return `/lobby/${lobby.id}`;
      }
    });
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

    // Capture button position
    let origin: { x: number; y: number } | undefined;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    startTransition('', {
      loadingText: 'Joining lobby',
      origin,
      prepare: async () => {
        setIsJoining(true);
        const { data: lobby, error: lobbyError } = await supabase
          .from('lobbies')
          .select('*')
          .eq('code', joinCode.toUpperCase())
          .in('status', ['waiting', 'results'])
          .single();

        if (lobbyError || !lobby) {
          toast.error('Lobby not found or game in progress');
          setIsJoining(false);
          throw new Error('Lobby not found');
        }

        const { data: existing } = await supabase
          .from('lobby_players')
          .select('*')
          .eq('lobby_id', lobby.id)
          .eq('user_id', userId)
          .single();

        if (!existing) {
          const isOriginalHost = lobby.host_user_id === userId;
          const { error: playerError } = await supabase
            .from('lobby_players')
            .insert({
              lobby_id: lobby.id,
              user_id: userId,
              display_name: displayName,
              is_host: isOriginalHost
            });

          if (playerError) {
            setIsJoining(false);
            toast.error('Failed to join lobby');
            throw playerError;
          }
          toast.success('Joined lobby!');
        }
        
        setIsJoining(false);
        return `/lobby/${lobby.id}`;
      }
    });
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
