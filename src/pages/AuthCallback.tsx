import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { setStoredUserId, setStoredDisplayName, setStoredIsGuest } from '@/lib/gameUtils';
import { getAndClearAuthReturnTo } from '@/lib/authRedirect';
import { toast } from 'sonner';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session?.user) {
          // Check if user already has a profile
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single();

          if (existingProfile) {
            setStoredUserId(existingProfile.id);
            setStoredDisplayName(existingProfile.display_name);
            setStoredIsGuest(false); // OAuth = authed
            toast.success(`Welcome back, ${existingProfile.display_name}!`);
            const returnTo = getAndClearAuthReturnTo() || '/menu';
            navigate(returnTo);
            return;
          }

          // Create new profile for OAuth user
          const displayName = session.user.user_metadata?.full_name || 
                             session.user.user_metadata?.name || 
                             session.user.email?.split('@')[0] || 
                             'Player';

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({ 
              display_name: displayName,
              auth_user_id: session.user.id,
              is_guest: false
            })
            .select()
            .single();

          if (profileError) throw profileError;

          // Create user stats
          await supabase
            .from('user_stats')
            .insert({ user_id: session.user.id });

          setStoredUserId(profile.id);
          setStoredDisplayName(profile.display_name);
          setStoredIsGuest(false); // OAuth = authed
          
          toast.success('Account created successfully!');
          const returnTo = getAndClearAuthReturnTo() || '/menu';
          navigate(returnTo);
        } else {
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('Authentication failed');
        navigate('/auth');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;