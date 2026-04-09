
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const pendingPlanProcessed = useRef(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Process pending visit plan on any sign-in (email or OAuth)
        if (event === 'SIGNED_IN' && session?.user && !pendingPlanProcessed.current) {
          pendingPlanProcessed.current = true;

          // ── Process pending exhibitor invitation ──
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

          // ── Process pending visit plan ──
          const pendingRaw = localStorage.getItem('pending_visit_plan');
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw);
              const userId = session.user.id;

              // Add to favorites
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

              // Save visit plan
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

              // Invalidate caches
              await queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
              await queryClient.invalidateQueries({ queryKey: ['favorite-events', userId] });
              await queryClient.invalidateQueries({ queryKey: ['visit-plans', userId] });
              await queryClient.invalidateQueries({ queryKey: ['visit-plan', pending.event_id, userId] });

              // Navigate to event page via custom event (picked up by App)
              window.dispatchEvent(new CustomEvent('pending-visit-saved', { detail: { slug: pending.event_slug } }));
            } catch (err) {
              console.error('Failed to save pending visit plan:', err);
              localStorage.removeItem('pending_visit_plan');
            }
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

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
      // Fallback: manual cleanup if server logout fails
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      // Force page reload to clear all state
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
