import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { generateLobbyCode, getStoredUserId, getStoredDisplayName } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Plus, LogIn, User, LogOut } from 'lucide-react';

const Home = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const displayName = getStoredDisplayName();

  const handleLogout = () => {
    localStorage.removeItem('wordgame_user_id');
    localStorage.removeItem('wordgame_display_name');
    toast.success('Logged out');
    navigate('/');
  };

  const createLobby = async () => {
    const userId = getStoredUserId();
    if (!userId || !displayName) {
      navigate('/');
      return;
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
      navigate(`/lobby/${lobby.id}`);
    } catch (error) {
      console.error('Error creating lobby:', error);
      toast.error('Failed to create lobby');
    } finally {
      setIsCreating(false);
    }
  };

  const joinLobby = async () => {
    const userId = getStoredUserId();
    if (!userId || !displayName) {
      navigate('/');
      return;
    }

    if (!joinCode.trim()) {
      toast.error('Please enter a lobby code');
      return;
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
        navigate(`/lobby/${lobby.id}`);
        setIsJoining(false);
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
      navigate(`/lobby/${lobby.id}`);
    } catch (error) {
      console.error('Error joining lobby:', error);
      toast.error('Failed to join lobby');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-center relative">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Sus Detector
          </h1>
          <div className="absolute right-0 flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="truncate max-w-[60px] sm:max-w-[100px]">{displayName}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6 py-8">
        <Card className="p-6 bg-gradient-primary text-white shadow-card border-0 animate-fade-in-up hover:scale-[1.02] transition-transform duration-300">
          <h2 className="text-2xl font-bold mb-2">Find the Imposter!</h2>
          <p className="text-white/90">
            One player doesn't know the secret word. Can the group find them?
          </p>
        </Card>

        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Button
            onClick={createLobby}
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
              onClick={joinLobby}
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
