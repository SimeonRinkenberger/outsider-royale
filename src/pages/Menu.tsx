import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, getStoredDisplayName, clearStorage, setStoredUserId, setStoredDisplayName } from '@/lib/gameUtils';
import { Users, Wifi, User, LogIn, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { usePageTransition } from '@/components/PageTransition';

const Menu = () => {
  const navigate = useNavigate();
  const { navigateWithTransition } = usePageTransition();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      // Only show display name if authenticated or has a valid guest profile
      if (session) {
        setDisplayName(getStoredDisplayName());
      } else {
        // Clear any stale guest data when not authenticated
        clearStorage();
        setDisplayName(null);
      }
      setIsLoading(false);
    };
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (event === 'SIGNED_OUT') {
        clearStorage();
        setDisplayName(null);
      } else if (session) {
        setDisplayName(getStoredDisplayName());
      }
    });
    checkAuth();
    return () => subscription.unsubscribe();
  }, []);
  const handleInPerson = () => {
    navigate('/in-person');
  };
  const handleOnline = (event: React.MouseEvent) => {
    // Check if user has a profile (guest or authenticated)
    const userId = getStoredUserId();
    if (userId) {
      navigateWithTransition('/home', event);
    } else {
      // Show the guest input instead of navigating
      setShowGuestInput(true);
    }
  };
  const handleGuestContinue = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!guestName.trim() || guestName.length > 50) {
      toast.error('Please enter a name (1-50 characters)');
      return;
    }
    setIsCreatingGuest(true);
    try {
      const {
        data,
        error
      } = await supabase.from('profiles').insert({
        display_name: guestName.trim()
      }).select().single();
      if (error) throw error;
      setStoredUserId(data.id);
      setStoredDisplayName(data.display_name);
      toast.success(`Welcome, ${data.display_name}!`);
      
      if (event) {
        navigateWithTransition('/home', event);
      } else {
        navigate('/home');
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsCreatingGuest(false);
    }
  };
  const handleAuth = () => {
    navigate('/auth');
  };
  const handleStats = () => {
    navigate('/stats');
  };
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>;
  }
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Outsider Royale
          </h1>
          {isAuthenticated ? <Button variant="ghost" size="icon" onClick={handleStats}>
              <BarChart3 className="h-5 w-5" />
            </Button> : <Button variant="ghost" size="sm" onClick={handleAuth}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col justify-center space-y-6">
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.5
      }} className="text-center space-y-2">
          <h2 className="text-3xl font-bold">Welcome!</h2>
          {displayName && <p className="text-muted-foreground">Playing as <span className="font-semibold text-foreground">{displayName}</span></p>}
          <p className="text-muted-foreground">Choose how you want to play</p>
        </motion.div>

        <div className="space-y-4">
          <motion.div initial={{
          opacity: 0,
          x: -20
        }} animate={{
          opacity: 1,
          x: 0
        }} transition={{
          duration: 0.5,
          delay: 0.1
        }}>
            <Card className="p-6 cursor-pointer hover:scale-[1.02] transition-all duration-300 border-2 hover:border-primary/50" onClick={handleInPerson}>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-primary">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">In Person</h3>
                  <p className="text-muted-foreground text-sm">
                    Pass & Play - One device, take turns
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{
          opacity: 0,
          x: 20
        }} animate={{
          opacity: 1,
          x: 0
        }} transition={{
          duration: 0.5,
          delay: 0.2
        }}>
            <Card className={`p-6 cursor-pointer transition-all duration-300 border-2 ${showGuestInput ? 'border-primary' : 'hover:scale-[1.02] hover:border-primary/50'}`} onClick={!showGuestInput ? handleOnline : undefined}>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-primary">
                  <Wifi className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    Online as {isAuthenticated && displayName ? displayName : 'Guest'}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Everyone uses their own device
                  </p>
                </div>
              </div>

              {/* Animated Guest Input */}
              <AnimatePresence>
                {showGuestInput && <motion.div initial={{
                height: 0,
                opacity: 0
              }} animate={{
                height: 'auto',
                opacity: 1
              }} exit={{
                height: 0,
                opacity: 0
              }} transition={{
                duration: 0.3,
                ease: 'easeOut'
              }} className="overflow-visible">
                    <div className="pt-4 mt-4 border-t border-border space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="guest-name-input">Choose a display name</label>
                        <div className="relative rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                          <div className="relative overflow-hidden rounded-md">
                            <Input 
                              id="guest-name-input"
                              placeholder="" 
                              value={guestName} 
                              onChange={e => setGuestName(e.target.value)} 
                              maxLength={50} 
                              onKeyDown={e => e.key === 'Enter' && handleGuestContinue()} 
                              autoFocus 
                              onClick={e => e.stopPropagation()} 
                              onFocus={() => setHasAnimated(true)}
                              className="h-12 text-base pl-3 focus-visible:ring-0 focus-visible:ring-offset-0" 
                            />
                            {guestName.length === 0 && (
                              <span 
                                aria-hidden="true" 
                                className="absolute inset-y-0 left-0 flex items-center pl-3 pr-3 pointer-events-none max-w-full z-10"
                              >
                                <span className="relative text-base truncate">
                                  <span className="placeholder-base">Enter your name</span>
                                  {hasAnimated && (
                                    <span className="placeholder-highlight" aria-hidden="true">Enter your name</span>
                                  )}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {guestName.length}/50 characters
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={e => {
                      e.stopPropagation();
                      setShowGuestInput(false);
                      setGuestName('');
                      setHasAnimated(false);
                    }} className="flex-1">
                          Cancel
                        </Button>
                        <Button onClick={e => {
                      e.stopPropagation();
                      handleGuestContinue(e);
                    }} disabled={isCreatingGuest || !guestName.trim()} className="flex-1">
                          {isCreatingGuest ? 'Creating...' : 'Continue'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>

        {!isAuthenticated && <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.5,
        delay: 0.3
      }} className="pt-4">
            <Card className="p-4 bg-secondary/50 border-dashed">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Create an account</p>
                  <p className="text-xs text-muted-foreground">Track your stats and win streaks</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleAuth}>
                  Sign Up
                </Button>
              </div>
            </Card>
          </motion.div>}
      </main>
    </div>;
};
export default Menu;