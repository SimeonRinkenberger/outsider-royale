import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { setStoredUserId, setStoredDisplayName, getStoredUserId, setStoredIsGuest, getSessionMode } from '@/lib/gameUtils';
import { getAndClearAuthReturnTo, peekAuthReturnTo } from '@/lib/authRedirect';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Lock, User, Loader2, Check, X, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useTransition } from '@/contexts/TransitionContext';
import { useAuth } from '@/contexts/AuthContext';
import { passwordSchema, getPasswordRequirements, PASSWORD_REQUIREMENT_LABELS, sanitizeTextInput } from '@/lib/passwordValidation';

const emailSchema = z.string().email('Please enter a valid email address');

const Auth = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  const navigate = useNavigate();
  const { startTransition } = useTransition();
  const { refreshProfile } = useAuth();

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

    if (mode === 'signup') {
      const sanitized = sanitizeTextInput(displayName, 50);
      if (!sanitized) {
        newErrors.displayName = 'Display name must be 1-50 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailAuth = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        // Use production URL for OAuth redirects (works for both web and native)
        const redirectUrl = 'https://4b9de44f-1c68-4ee8-8e08-f7594c181759.lovableproject.com/';
        
        // Get current guest profile ID before signup
        const guestProfileId = getStoredUserId();
        
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
          // If guest has an existing profile, update it to link to auth account
          if (guestProfileId) {
            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update({ 
                auth_user_id: data.user.id,
                is_guest: false,
                display_name: sanitizeTextInput(displayName, 50)
              })
              .eq('id', guestProfileId)
              .select()
              .single();

            if (!updateError && updatedProfile) {
              // Create user stats linked to auth user
              await supabase
                .from('user_stats')
                .insert({ user_id: data.user.id });

              setStoredUserId(updatedProfile.id);
              setStoredDisplayName(updatedProfile.display_name);
              setStoredIsGuest(false);
              await refreshProfile();
              
              toast.success('Account created! Your progress has been saved.');
              const returnTo = getAndClearAuthReturnTo() || '/menu';
              navigate(returnTo);
              return;
            }
          }
          
          // Create new profile linked to auth user (no guest profile to migrate)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({ 
              display_name: sanitizeTextInput(displayName, 50),
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
          setStoredIsGuest(false);
          await refreshProfile();
          
          toast.success('Account created successfully!');
          const returnTo = getAndClearAuthReturnTo() || '/menu';
          navigate(returnTo);
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
          setStoredIsGuest(false);
          await refreshProfile();
          
          toast.success(`Welcome back, ${profile.display_name}!`);
          const returnTo = getAndClearAuthReturnTo() || '/menu';
          navigate(returnTo);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = (event: React.MouseEvent) => {
    const returnTo = peekAuthReturnTo();
    const historyLen = window.history.length;
    const sessionMode = getSessionMode();
    
    console.log('[AUTH_BACK] clicked returnTo=', returnTo, 'historyLen=', historyLen, 'mode=', sessionMode);
    
    // Get click origin for transition animation
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    
    // Option 1: Use stored returnTo if it exists and is not /auth
    if (returnTo && returnTo !== '/auth') {
      console.log('[AUTH_BACK] using returnTo, mode=', sessionMode);
      // Clear it before navigating
      getAndClearAuthReturnTo();
      startTransition(returnTo, {
        origin,
        loadingText: 'Returning…'
      });
      return;
    }
    
    // Option 2: Use browser history if we have somewhere to go back to
    // history.length > 2 means there's a real page to go back to (not just the initial page)
    if (historyLen > 2) {
      console.log('[AUTH_BACK] using navigate(-1)');
      navigate(-1);
      return;
    }
    
    // Option 3: Fallback to menu
    console.log('[AUTH_BACK] fallback to /menu');
    startTransition('/menu', {
      origin,
      loadingText: 'Returning…'
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
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
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                {mode === 'signup' && password.length > 0 && (
                  <div className="space-y-1 text-xs">
                    {PASSWORD_REQUIREMENT_LABELS.map(({ key, label }) => {
                      const met = getPasswordRequirements(password)[key];
                      return (
                        <div key={key} className={`flex items-center gap-1.5 ${met ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
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
