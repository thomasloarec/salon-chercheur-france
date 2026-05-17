import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook to check if the current user is an admin.
 * Uses server-side RPC call to is_admin() function for security.
 * 
 * @returns {boolean} isAdmin - Whether the current user is an admin
 * @returns {boolean} loading - Whether the admin check is still in progress
 */
export const useIsAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAdminRole = async () => {
      if (authLoading) {
        return;
      }

      if (!user) {
        if (cancelled) return;
        setIsAdmin(false);
        setCheckedUserId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('is_admin');
        
        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data || false);
        }
      } catch (err) {
        console.error('Unexpected error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        if (!cancelled) {
          setCheckedUserId(user.id);
          setLoading(false);
        }
      }
    };

    checkAdminRole();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  const waitingForCurrentUserCheck = !!user && checkedUserId !== user.id;

  return { isAdmin, loading: authLoading || loading || waitingForCurrentUserCheck };
};
