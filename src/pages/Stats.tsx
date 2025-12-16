import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getStoredDisplayName, clearStorage, setStoredDisplayName } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Target, Flame, MessageSquare, Vote, LogOut, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { AvatarPicker, getAvatarById } from '@/components/AvatarPicker';
import { AccountSettings } from '@/components/AccountSettings';

interface UserStats {
  games_played: number;
  games_won_as_outsider: number;
  games_played_as_outsider: number;
  games_won_as_safe: number;
  games_played_as_safe: number;
  current_win_streak: number;
  best_win_streak: number;
  total_clues_submitted: number;
  total_correct_votes: number;
  total_votes_cast: number;
  favorite_category: string | null;
}

const Stats = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(getStoredDisplayName());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Check if we came from a game/lobby context
  const fromGame = location.state?.fromGame || false;

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      // Fetch stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (statsError) {
        console.error('Error fetching stats:', statsError);
        toast.error('Failed to load stats');
      } else {
        setStats(statsData);
      }

      // Fetch profile for avatar
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, avatar_url, display_name')
        .eq('auth_user_id', session.user.id)
        .single();

      if (profileData) {
        setProfileId(profileData.id);
        setAvatarUrl(profileData.avatar_url);
        if (profileData.display_name) {
          setDisplayName(profileData.display_name);
        }
      }

      // Store email from session
      setUserEmail(session.user.email || null);
      
      setIsLoading(false);
    };

    fetchStats();
  }, [navigate]);

  const handleDisplayNameChange = (newName: string) => {
    setDisplayName(newName);
    setStoredDisplayName(newName);
  };

  const handleAvatarSelect = async (avatarId: string) => {
    if (!profileId) return;

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarId })
      .eq('id', profileId);

    if (error) {
      toast.error('Failed to update avatar');
    } else {
      setAvatarUrl(avatarId);
      toast.success('Avatar updated!');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearStorage();
    toast.success('Logged out');
    navigate('/menu');
  };

  const calculatePercentage = (wins: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading stats...</div>
      </div>
    );
  }

  const outsiderWinRate = stats ? calculatePercentage(stats.games_won_as_outsider, stats.games_played_as_outsider) : 0;
  const safeWinRate = stats ? calculatePercentage(stats.games_won_as_safe, stats.games_played_as_safe) : 0;
  const voteAccuracy = stats ? calculatePercentage(stats.total_correct_votes, stats.total_votes_cast) : 0;

  const handleBack = () => {
    if (fromGame) {
      navigate(-1); // Go back to the game/lobby
    } else {
      navigate('/menu');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Your Stats</h1>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* Profile Section with Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-4"
        >
          <AvatarPicker
            currentAvatar={avatarUrl}
            displayName={displayName || undefined}
            onSelect={handleAvatarSelect}
          />
          {displayName && (
            <h2 className="text-2xl font-bold mt-3">{displayName}</h2>
          )}
          <p className="text-sm text-muted-foreground">Tap avatar to change</p>
        </motion.div>

        {/* Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 bg-gradient-primary text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Games</p>
                <p className="text-4xl font-bold">{stats?.games_played || 0}</p>
              </div>
              <Trophy className="h-12 w-12 text-white/30" />
            </div>
          </Card>
        </motion.div>

        {/* Win Rates */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-accent" />
                <span className="text-sm text-muted-foreground">Outsider Wins</span>
              </div>
              <p className="text-3xl font-bold">{outsiderWinRate}%</p>
              <p className="text-xs text-muted-foreground">
                {stats?.games_won_as_outsider || 0}/{stats?.games_played_as_outsider || 0} games
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Safe Player Wins</span>
              </div>
              <p className="text-3xl font-bold">{safeWinRate}%</p>
              <p className="text-xs text-muted-foreground">
                {stats?.games_won_as_safe || 0}/{stats?.games_played_as_safe || 0} games
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Streaks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Win Streaks</span>
            </div>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold">{stats?.current_win_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{stats?.best_win_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Best</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clues Given</span>
              </div>
              <p className="text-2xl font-bold">{stats?.total_clues_submitted || 0}</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Vote className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Vote Accuracy</span>
              </div>
              <p className="text-2xl font-bold">{voteAccuracy}%</p>
              <p className="text-xs text-muted-foreground">
                {stats?.total_correct_votes || 0}/{stats?.total_votes_cast || 0}
              </p>
            </Card>
          </motion.div>
        </div>

        {stats?.favorite_category && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Favorite Category</p>
              <p className="text-xl font-bold capitalize">{stats.favorite_category}</p>
            </Card>
          </motion.div>
        )}

        {/* Account Settings */}
        <AccountSettings
          profileId={profileId}
          currentDisplayName={displayName}
          currentEmail={userEmail}
          onDisplayNameChange={handleDisplayNameChange}
        />
      </main>
    </div>
  );
};

export default Stats;