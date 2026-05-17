import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_ROLE_CACHE_TTL_MS = 30_000;

let adminRoleCache: { userId: string; isAdmin: boolean; checkedAt: number } | null = null;
const adminRoleRequests = new Map<string, Promise<boolean>>();

const getCachedAdminRole = (userId: string) => {
  if (!adminRoleCache || adminRoleCache.userId !== userId) return null;
  if (Date.now() - adminRoleCache.checkedAt > ADMIN_ROLE_CACHE_TTL_MS) return null;
  return adminRoleCache.isAdmin;
};

/**
 * Custom hook to check if the current user is an admin.
 * Uses server-side RPC call to is_admin() function for security.
 * 
 * @returns {boolean} isAdmin - Whether the current user is an admin
 * @returns {boolean} loading - Whether the admin check is still in progress
 */
export const useIsAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const cachedAdminRole = user ? getCachedAdminRole(user.id) : null;
  const [isAdmin, setIsAdmin] = useState(cachedAdminRole ?? false);
  const [loading, setLoading] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(cachedAdminRole !== null && user ? user.id : null);

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

      const cachedRole = getCachedAdminRole(user.id);
      if (cachedRole !== null) {
        setIsAdmin(cachedRole);
        setCheckedUserId(user.id);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let adminRoleRequest = adminRoleRequests.get(user.id);

        if (!adminRoleRequest) {
          adminRoleRequest = Promise.resolve(supabase.rpc('is_admin'))
            .then(({ data, error }) => {
              if (error) throw error;
              return data || false;
            })
            .finally(() => {
              adminRoleRequests.delete(user.id);
            });

          adminRoleRequests.set(user.id, adminRoleRequest);
        }

        const adminRole = await adminRoleRequest;
        if (cancelled) return;
        
        adminRoleCache = { userId: user.id, isAdmin: adminRole, checkedAt: Date.now() };
        setIsAdmin(adminRole);
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
