
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SUPABASE_AUTH_STORAGE_PREFIX = 'sb-vxivdvzzhebobveedxbj-auth-token';

const clearStaleAuthStorage = () => {
  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SUPABASE_AUTH_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear stale auth storage:', error);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const pendingPlanProcessed = useRef(false);

  useEffect(() => {
    const processPostSignInTasks = async (currentSession: Session) => {
      if (pendingPlanProcessed.current) return;
      pendingPlanProcessed.current = true;

      const inviteToken = localStorage.getItem('pending_exhibitor_invite');
      if (inviteToken) {
        try {
          await supabase.functions.invoke('exhibitors-manage', {
            body: { action: 'accept_invite', token: inviteToken },
          });
          localStorage.removeItem('pending_exhibitor_invite');
          await queryClient.invalidateQueries({ queryKey: ['my-exhibitors'] });
        } catch (err) {
          console.error('Failed to accept exhibitor invitation:', err);
        }
      }

      try {
        const { data: checkResult } = await supabase.functions.invoke('exhibitors-manage', {
          body: { action: 'check_pending_invites' },
        });
        if (checkResult?.accepted > 0) {
          console.log(`Auto-accepted ${checkResult.accepted} exhibitor invitation(s)`);
          await queryClient.invalidateQueries({ queryKey: ['my-exhibitors'] });
        }
      } catch (err) {
        console.error('Failed to check pending invitations:', err);
      }

      const pendingRaw = localStorage.getItem('pending_visit_plan');
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          const userId = currentSession.user.id;

          const { data: existingFav } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('event_uuid', pending.event_id)
            .maybeSingle();

          if (!existingFav) {
            await supabase.from('favorites').insert({
              user_id: userId,
              event_uuid: pending.event_id,
              event_id: pending.event_id,
            } as any);
          }

          await supabase.from('visit_plans' as any).upsert({
            user_id: userId,
            event_id: pending.event_id,
            role: pending.role,
            objectif: pending.objectif,
            keywords: pending.keywords,
            duration: pending.duration,
            prioritaires: pending.prioritaires,
            optionnels: pending.optionnels,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,event_id' });

          localStorage.removeItem('pending_visit_plan');

          await queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
          await queryClient.invalidateQueries({ queryKey: ['favorite-events', userId] });
          await queryClient.invalidateQueries({ queryKey: ['visit-plans', userId] });
          await queryClient.invalidateQueries({ queryKey: ['visit-plan', pending.event_id, userId] });

          window.dispatchEvent(new CustomEvent('pending-visit-saved', { detail: { slug: pending.event_slug } }));
        } catch (err) {
          console.error('Failed to save pending visit plan:', err);
          localStorage.removeItem('pending_visit_plan');
        }
      }
    };

    const resetAuthState = () => {
      pendingPlanProcessed.current = false;
      setSession(null);
      setUser(null);
      setLoading(false);
    };

    const handleInvalidSession = async (error: unknown) => {
      console.error('Invalid Supabase session detected:', error);
      clearStaleAuthStorage();
      await supabase.auth.signOut({ scope: 'local' });
      resetAuthState();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (event === 'SIGNED_OUT') {
          resetAuthState();
          return;
        }

        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);

        if (!nextSession?.user) {
          pendingPlanProcessed.current = false;
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          // Fire-and-forget: never await Supabase calls inside onAuthStateChange
          // to avoid deadlocking the auth event processing pipeline
          processPostSignInTasks(nextSession).catch((err) =>
            console.error('processPostSignInTasks failed:', err)
          );
        }
      }
    );

    const bootstrapAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          const message = error.message.toLowerCase();
          if (message.includes('refresh token') || message.includes('invalid')) {
            await handleInvalidSession(error);
            return;
          }
          throw error;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        await handleInvalidSession(error);
        return;
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Logout error:', error);
      clearStaleAuthStorage();
      sessionStorage.clear();
      window.location.href = '/';
      return { error: null };
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
