import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { getStoredDisplayName, clearStorage, setStoredDisplayName, setStoredAvatarId, isAuthenticated, getSessionMode, getStoredUserId, setStoredUserId, setStoredIsGuest } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Target, MessageSquare, Vote, LogOut, TrendingUp, Mail, Lock, User, Loader2, HelpCircle, ChevronDown, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AvatarPicker, getAvatarById } from '@/components/AvatarPicker';
import { AccountSettings } from '@/components/AccountSettings';
import { useTransition } from '@/contexts/TransitionContext';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

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
  correct_vote_streak: number;
  best_correct_vote_streak: number;
  in_person_games_played: number;
}

const Stats = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { startTransition } = useTransition();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(getStoredDisplayName());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [totalGamesExpanded, setTotalGamesExpanded] = useState(false);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  
  // Auth form state for guests
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authErrors, setAuthErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});

  useEffect(() => {
    const fetchStats = async () => {
      const sessionMode = getSessionMode();
      console.log('[GUARD] route=/stats mode=', sessionMode);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if guest (has userId but not authed)
      if (!session || !isAuthenticated()) {
        setIsGuest(true);
        setIsLoading(false);
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
        if (profileData.avatar_url) {
          setStoredAvatarId(profileData.avatar_url);
        }
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
      setStoredAvatarId(avatarId);
      toast.success('Avatar updated!');
    }
  };

  const handleLogout = async (event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    await supabase.auth.signOut();
    clearStorage();
    toast.success('Logged out');
    
    startTransition('/menu', {
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    });
  };

  const calculatePercentage = (wins: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  // Auth form validation for guests
  const validateAuthForm = () => {
    const newErrors: typeof authErrors = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    if (authMode === 'signup' && (!authDisplayName.trim() || authDisplayName.length > 50)) {
      newErrors.displayName = 'Display name must be 1-50 characters';
    }

    setAuthErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle auth for guests
  const handleGuestAuth = async () => {
    if (!validateAuthForm()) return;

    setIsAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const redirectUrl = `${window.location.origin}/`;
        const guestProfileId = getStoredUserId();
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl }
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in instead.');
          } else {
            throw error;
          }
          return;
        }

        if (data.user) {
          // Link guest profile to auth account
          if (guestProfileId) {
            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update({ 
                auth_user_id: data.user.id,
                is_guest: false,
                display_name: authDisplayName.trim()
              })
              .eq('id', guestProfileId)
              .select()
              .single();

            if (!updateError && updatedProfile) {
              await supabase.from('user_stats').insert({ user_id: data.user.id });
              setStoredUserId(updatedProfile.id);
              setStoredDisplayName(updatedProfile.display_name);
              setStoredIsGuest(false);
              toast.success('Account created! Your progress has been saved.');
              setIsGuest(false);
              // Refetch stats
              window.location.reload();
              return;
            }
          }
          
          // Create new profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({ 
              display_name: authDisplayName.trim(),
              auth_user_id: data.user.id,
              is_guest: false
            })
            .select()
            .single();

          if (profileError) throw profileError;

          await supabase.from('user_stats').insert({ user_id: data.user.id });
          setStoredUserId(profile.id);
          setStoredDisplayName(profile.display_name);
          setStoredIsGuest(false);
          toast.success('Account created successfully!');
          setIsGuest(false);
          window.location.reload();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            throw error;
          }
          return;
        }

        if (data.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('auth_user_id', data.user.id)
            .single();

          if (profileError || !profile) {
            toast.error('Profile not found. Please sign up first.');
            await supabase.auth.signOut();
            return;
          }

          setStoredUserId(profile.id);
          setStoredDisplayName(profile.display_name);
          setStoredIsGuest(false);
          toast.success(`Welcome back, ${profile.display_name}!`);
          setIsGuest(false);
          window.location.reload();
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (isLoading) {
    // Inline skeleton - TransitionOverlay is the only full-screen loader
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border p-4">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-muted rounded animate-pulse"></div>
              <div className="h-6 w-24 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
          </div>
        </header>
        <main className="p-4 max-w-md mx-auto space-y-4">
          <div className="h-32 bg-muted rounded-lg animate-pulse"></div>
          <div className="h-24 bg-muted rounded-lg animate-pulse"></div>
          <div className="h-24 bg-muted rounded-lg animate-pulse"></div>
        </main>
      </div>
    );
  }

  // Guest view - show create account form
  if (isGuest) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
        <header className="bg-card border-b border-border p-4">
          <div className="max-w-md mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold">Create an account to track your stats</h2>
                <p className="text-sm text-muted-foreground">Your game progress will be saved across devices</p>
              </div>

              <div className="space-y-4">
                {authMode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="authDisplayName">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="authDisplayName"
                        placeholder="Your name"
                        value={authDisplayName}
                        onChange={(e) => setAuthDisplayName(e.target.value)}
                        maxLength={50}
                        className="pl-10 h-12"
                      />
                    </div>
                    {authErrors.displayName && (
                      <p className="text-sm text-destructive">{authErrors.displayName}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {authErrors.email && (
                    <p className="text-sm text-destructive">{authErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {authErrors.password && (
                    <p className="text-sm text-destructive">{authErrors.password}</p>
                  )}
                </div>

                <Button
                  className="w-full h-12 text-base"
                  onClick={handleGuestAuth}
                  disabled={isAuthLoading}
                >
                  {isAuthLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : authMode === 'signin' ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                    setAuthErrors({});
                  }}
                >
                  {authMode === 'signin' ? (
                    <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>
                  ) : (
                    <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
                  )}
                </button>
              </div>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  const outsiderWinRate = stats ? calculatePercentage(stats.games_won_as_outsider, stats.games_played_as_outsider) : 0;
  const safeWinRate = stats ? calculatePercentage(stats.games_won_as_safe, stats.games_played_as_safe) : 0;
  const voteAccuracy = stats ? calculatePercentage(stats.total_correct_votes, stats.total_votes_cast) : 0;

  const handleBack = () => {
    navigate(-1); // Always go back to previous page
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
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

        {/* Overview - Expandable Total Games */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card 
            className="p-4 bg-gradient-primary text-white cursor-pointer transition-all"
            onClick={() => setTotalGamesExpanded(!totalGamesExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Games</p>
                <p className="text-4xl font-bold">{stats?.games_played || 0}</p>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-12 w-12 text-white/30" />
                <ChevronDown className={`h-5 w-5 text-white/60 transition-transform duration-200 ${totalGamesExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <AnimatePresence>
              {totalGamesExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex justify-between mt-4 pt-3 border-t border-white/20">
                    <div>
                      <p className="text-white/70 text-xs">Online</p>
                      <p className="text-xl font-bold">{(stats?.games_played || 0) - (stats?.in_person_games_played || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/70 text-xs">In-Person</p>
                      <p className="text-xl font-bold">{stats?.in_person_games_played || 0}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Win Rates */}
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="h-4 w-4 text-accent" />
                  <span className="text-sm text-muted-foreground">Outsider Wins</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-auto" type="button">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      You win as outsider when less than 50% of the lobby votes for you.
                    </TooltipContent>
                  </Tooltip>
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
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Safe Player Wins</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-auto" type="button">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      You win as a safe player when 50% or more of the lobby votes for the outsider.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold">{safeWinRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {stats?.games_won_as_safe || 0}/{stats?.games_played_as_safe || 0} games
                </p>
              </Card>
            </motion.div>
          </div>
        </TooltipProvider>

        {/* Correct Vote Streak */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Crosshair className="h-5 w-5 text-primary" />
              <span className="font-medium">Correct Vote Streak</span>
            </div>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold">{stats?.correct_vote_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{stats?.best_correct_vote_streak || 0}</p>
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
