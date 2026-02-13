import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, setStoredUserId, setStoredDisplayName, clearStorage } from '@/lib/gameUtils';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profileId: string | null;
  isGuest: boolean;
  isLoading: boolean;
  isAnonymous: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profileId, setProfileId] = useState<string | null>(getStoredUserId());
  const [isLoading, setIsLoading] = useState(true);

  const resolveProfile = useCallback(async (): Promise<string | null> => {
    try {
      const { data: pid } = await supabase.rpc('get_my_profile_id');
      if (pid) {
        setProfileId(pid);
        setStoredUserId(pid);
        // Sync display name cache
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', pid)
          .single();
        if (profile) setStoredDisplayName(profile.display_name);
        return pid;
      }
    } catch (e) {
      // Profile doesn't exist yet - that's OK
    }
    return null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Try to get existing session with timeout
        let s: Session | null = null;
        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('getSession timeout')), 3000)
            )
          ]);
          s = result.data.session;
        } catch (e) {
          console.warn('[Auth] getSession failed, clearing tokens and signing in fresh');
          // Clear stale auth tokens directly from localStorage
          // Don't call signOut() as it may also hang
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        }

        if (!s) {
          try {
            const { data, error } = await Promise.race([
              supabase.auth.signInAnonymously(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('signInAnonymously timeout')), 5000)
              )
            ]);
            if (error) {
              console.error('[Auth] Anonymous sign-in failed:', error);
              if (mounted) setIsLoading(false);
              return;
            }
            s = data.session;
          } catch (e) {
            console.error('[Auth] Anonymous sign-in timed out:', e);
            if (mounted) setIsLoading(false);
            return;
          }
        }

        if (mounted) setSession(s);

        // 2. Resolve profile from DB
        if (s) {
          const pid = await resolveProfile();

          // 3. If no profile linked, try claiming legacy localStorage profile
          if (!pid && mounted) {
            const legacyId = getStoredUserId();
            if (legacyId) {
              try {
                const { data: claimed } = await supabase.rpc('claim_profile', { p_profile_id: legacyId });
                if (claimed && mounted) {
                  setProfileId(claimed);
                  setStoredUserId(claimed);
                }
              } catch (e) {
                // Claim failed - user needs new profile
              }
            }
          }
        }
      } catch (e) {
        console.error('[Auth] Init error:', e);
      }

      if (mounted) setIsLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s) {
        await resolveProfile();
      } else {
        setProfileId(null);
        clearStorage();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveProfile]);

  const refreshProfile = useCallback(async () => {
    await resolveProfile();
  }, [resolveProfile]);

  const isAnonymous = session?.user?.is_anonymous ?? true;

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    profileId,
    isGuest: isAnonymous,
    isLoading,
    isAnonymous,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
