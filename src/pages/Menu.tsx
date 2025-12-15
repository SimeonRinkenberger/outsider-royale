import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, getStoredDisplayName, clearStorage } from '@/lib/gameUtils';
import { Users, Wifi, User, LogIn, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const Menu = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

  const handleOnline = () => {
    // Check if user has a profile (guest or authenticated)
    const userId = getStoredUserId();
    if (userId) {
      navigate('/home');
    } else {
      navigate('/onboarding');
    }
  };

  const handleAuth = () => {
    navigate('/auth');
  };

  const handleStats = () => {
    navigate('/stats');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Outsider Royale
          </h1>
          {isAuthenticated ? (
            <Button variant="ghost" size="icon" onClick={handleStats}>
              <BarChart3 className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleAuth}>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col justify-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-2"
        >
          <h2 className="text-3xl font-bold">Welcome!</h2>
          {displayName && (
            <p className="text-muted-foreground">Playing as <span className="font-semibold text-foreground">{displayName}</span></p>
          )}
          <p className="text-muted-foreground">Choose how you want to play</p>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card 
              className="p-6 cursor-pointer hover:scale-[1.02] transition-all duration-300 border-2 hover:border-primary/50"
              onClick={handleInPerson}
            >
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

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card 
              className="p-6 cursor-pointer hover:scale-[1.02] transition-all duration-300 border-2 hover:border-primary/50"
              onClick={handleOnline}
            >
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
            </Card>
          </motion.div>
        </div>

        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="pt-4"
          >
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
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Menu;