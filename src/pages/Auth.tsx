import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { setStoredUserId, setStoredDisplayName } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Lock, User, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if user already has a profile linked to their auth account
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single();

        if (existingProfile) {
          setStoredUserId(existingProfile.id);
          setStoredDisplayName(existingProfile.display_name);
          navigate('/menu');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
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

    if (mode === 'signup' && (!displayName.trim() || displayName.length > 50)) {
      newErrors.displayName = 'Display name must be 1-50 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailAuth = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const redirectUrl = `${window.location.origin}/`;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
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
          // Create profile linked to auth user
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({ 
              display_name: displayName.trim(),
              auth_user_id: data.user.id,
              is_guest: false
            })
            .select()
            .single();

          if (profileError) throw profileError;

          // Create user stats
          await supabase
            .from('user_stats')
            .insert({ user_id: data.user.id });

          setStoredUserId(profile.id);
          setStoredDisplayName(profile.display_name);
          
          toast.success('Account created successfully!');
          navigate('/menu');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            throw error;
          }
          return;
        }

        if (data.user) {
          // Fetch existing profile
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
          
          toast.success(`Welcome back, ${profile.display_name}!`);
          navigate('/menu');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Apple sign in error:', error);
      toast.error('Apple sign in failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/menu')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
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
            {/* Apple Sign In */}
            <Button
              variant="outline"
              className="w-full h-12 text-base"
              onClick={handleAppleSignIn}
              disabled={isLoading}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            {/* Email Form */}
            <div className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="displayName"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={50}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.displayName && (
                    <p className="text-sm text-destructive">{errors.displayName}</p>
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
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
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
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <Button
                className="w-full h-12 text-base"
                onClick={handleEmailAuth}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : mode === 'signin' ? (
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
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setErrors({});
                }}
              >
                {mode === 'signin' ? (
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
};

export default Auth;