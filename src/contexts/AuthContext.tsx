import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  setStoredUserId,
  setStoredDisplayName,
  setStoredIsGuest,
  clearStorage,
  getStoredUserId,
} from '@/lib/gameUtils';

export type AuthStatus = 'loading' | 'unauthenticated' | 'ready';

interface Profile {
  id: string;
  displayName: string;
  isGuest: boolean;
  avatarUrl: string | null;
}

interface AuthContextType {
  status: AuthStatus;
  uid: string | null;
  profile: Profile | null;
  profileId: string | null;
  displayName: string | null;
  isGuest: boolean;
  /** True only for non-anonymous (email/OAuth) sessions */
  isRealAuth: boolean;
  /** Create a fresh anonymous session + guest profile */
  createGuestProfile: (displayName: string) => Promise<void>;
  /** Full sign-out: clears session + all app caches */
  signOutAndReset: () => Promise<void>;
  /** Re-fetch profile from DB (after signup/upgrade) */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Guard: skip auto-fetch during createGuestProfile
  const creatingRef = useRef(false);

  // ── Sync profile → localStorage (backward compat) ──
  const syncToLS = useCallback((p: Profile | null) => {
    if (p) {
      setStoredUserId(p.id);
      setStoredDisplayName(p.displayName);
      setStoredIsGuest(p.isGuest);
    } else {
      clearStorage();
    }
  }, []);

  // ── Fetch profile by auth uid ──
  const fetchProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, is_guest, avatar_url')
      .eq('auth_user_id', uid)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      displayName: data.display_name,
      isGuest: data.is_guest,
      avatarUrl: data.avatar_url,
    };
  }, []);

  // ── Auth listener + initial session ──
  useEffect(() => {
    let mounted = true;

    // 1. Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (!newSession) {
          setProfile(null);
          syncToLS(null);
          setStatus('unauthenticated');
        }
      },
    );

    // 2. Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (!s) {
        clearStorage();
        setStatus('unauthenticated');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncToLS]);

  // ── Profile fetch when session changes ──
  useEffect(() => {
    if (!session?.user) return;
    if (creatingRef.current) return; // skip during guest creation

    let cancelled = false;

    const load = async () => {
      const p = await fetchProfile(session.user.id);
      if (cancelled) return;

      if (p) {
        // Validate: if localStorage has a stale profile id, overwrite
        const storedId = getStoredUserId();
        if (storedId !== p.id) syncToLS(p);
        else syncToLS(p); // always sync to keep LS fresh

        setProfile(p);
        setStatus('ready');
      } else {
        // Session exists but no profile (e.g. fresh anonymous before name entry)
        setProfile(null);
        clearStorage();
        setStatus('unauthenticated');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [session?.user?.id, fetchProfile, syncToLS]);

  // ── Actions ──

  const createGuestProfile = useCallback(async (displayName: string) => {
    creatingRef.current = true;
    try {
      // 1. Wipe any existing session
      await supabase.auth.signOut();
      clearStorage();

      // 2. Fresh anonymous session
      const { error: authErr } = await supabase.auth.signInAnonymously();
      if (authErr) throw authErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Failed to create anonymous session');

      // 3. Create profile via RPC
      const { data, error } = await supabase.rpc('get_or_create_profile', {
        p_display_name: displayName.trim(),
        p_is_guest: true,
      });

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Failed to create profile');

      const row = data[0] as any;
      const newProfile: Profile = {
        id: row.profile_id,
        displayName: row.profile_display_name,
        isGuest: row.profile_is_guest,
        avatarUrl: row.profile_avatar_url,
      };

      setProfile(newProfile);
      syncToLS(newProfile);
      setStatus('ready');

      // Update session state (will trigger onAuthStateChange, but profile already set)
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
    } finally {
      creatingRef.current = false;
    }
  }, [syncToLS]);

  const signOutAndReset = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    clearStorage();
    setStatus('unauthenticated');
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) {
      const p = await fetchProfile(s.user.id);
      setProfile(p);
      syncToLS(p);
      setSession(s);
      setStatus(p ? 'ready' : 'unauthenticated');
    }
  }, [fetchProfile, syncToLS]);

  const value: AuthContextType = {
    status,
    uid: session?.user?.id ?? null,
    profile,
    profileId: profile?.id ?? null,
    displayName: profile?.displayName ?? null,
    isGuest: profile?.isGuest ?? true,
    isRealAuth: !!session && !session.user?.is_anonymous,
    createGuestProfile,
    signOutAndReset,
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
