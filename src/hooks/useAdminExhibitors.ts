import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GovernanceStatus = 'unmanaged' | 'pending' | 'managed' | 'test';

export interface AdminExhibitor {
  id: string;
  name: string;
  slug: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  approved: boolean | null;
  owner_user_id: string | null;
  verified_at: string | null;
  is_test: boolean;
  created_at: string | null;
  updated_at: string | null;
  plan: string | null;
  // Computed
  team_count: number;
  has_pending_claim: boolean;
  governance_status: GovernanceStatus;
}

export interface AdminExhibitorsFilters {
  search: string;
  status: GovernanceStatus | 'all';
  verified: 'all' | 'verified' | 'unverified';
  isTest: 'all' | 'test' | 'production';
}

export function useAdminExhibitors(filters: AdminExhibitorsFilters) {
  return useQuery({
    queryKey: ['admin-exhibitors', filters],
    queryFn: async (): Promise<AdminExhibitor[]> => {
      let query = supabase
        .from('exhibitors')
        .select('id, name, slug, website, description, logo_url, approved, owner_user_id, verified_at, is_test, created_at, updated_at, plan')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      if (filters.isTest === 'test') {
        query = query.eq('is_test', true);
      } else if (filters.isTest === 'production') {
        query = query.eq('is_test', false);
      }
      if (filters.verified === 'verified') {
        query = query.not('verified_at', 'is', null);
      } else if (filters.verified === 'unverified') {
        query = query.is('verified_at', null);
      }

      const { data: exhibitors, error } = await query;
      if (error) throw error;
      if (!exhibitors?.length) return [];

      const ids = exhibitors.map(e => e.id);

      const [teamRes, claimRes] = await Promise.all([
        supabase
          .from('exhibitor_team_members')
          .select('exhibitor_id')
          .in('exhibitor_id', ids)
          .eq('status', 'active'),
        supabase
          .from('exhibitor_claim_requests')
          .select('exhibitor_id')
          .in('exhibitor_id', ids)
          .eq('status', 'pending'),
      ]);

      const teamCounts: Record<string, number> = {};
      (teamRes.data || []).forEach((t: any) => {
        teamCounts[t.exhibitor_id] = (teamCounts[t.exhibitor_id] || 0) + 1;
      });

      const pendingClaims = new Set(
        (claimRes.data || []).map((c: any) => c.exhibitor_id)
      );

      const result: AdminExhibitor[] = exhibitors.map(e => {
        const tc = teamCounts[e.id] || 0;
        const hasPending = pendingClaims.has(e.id);
        let governance_status: GovernanceStatus = 'unmanaged';
        if (e.is_test) governance_status = 'test';
        else if (e.owner_user_id || tc > 0) governance_status = 'managed';
        else if (hasPending) governance_status = 'pending';

        return {
          ...e,
          team_count: tc,
          has_pending_claim: hasPending,
          governance_status,
        };
      });

      if (filters.status !== 'all') {
        return result.filter(e => e.governance_status === filters.status);
      }

      return result;
    },
    staleTime: 30_000,
  });
}

export interface AdminExhibitorDetail {
  exhibitor: AdminExhibitor;
  team_members: {
    id: string;
    user_id: string;
    role: string;
    status: string;
    created_at: string;
    profile?: {
      first_name: string | null;
      last_name: string | null;
      email?: string;
      avatar_url?: string | null;
      job_title?: string | null;
      company?: string | null;
      phone?: string | null;
    };
  }[];
  claims: {
    id: string;
    requester_user_id: string;
    status: string;
    created_at: string;
    profile?: {
      first_name: string | null;
      last_name: string | null;
      email?: string;
      avatar_url?: string | null;
      job_title?: string | null;
      company?: string | null;
    };
  }[];
}

export function useAdminExhibitorDetail(exhibitorId: string | null) {
  return useQuery({
    queryKey: ['admin-exhibitor-detail', exhibitorId],
    queryFn: async (): Promise<AdminExhibitorDetail | null> => {
      if (!exhibitorId) return null;

      const [exRes, teamRes, claimsRes] = await Promise.all([
        supabase
          .from('exhibitors')
          .select('id, name, slug, website, description, logo_url, approved, owner_user_id, verified_at, is_test, created_at, updated_at, plan')
          .eq('id', exhibitorId)
          .single(),
        supabase
          .from('exhibitor_team_members')
          .select('id, user_id, role, status, created_at')
          .eq('exhibitor_id', exhibitorId)
          .order('created_at', { ascending: true }),
        supabase
          .from('exhibitor_claim_requests')
          .select('id, requester_user_id, status, created_at')
          .eq('exhibitor_id', exhibitorId)
          .order('created_at', { ascending: false }),
      ]);

      if (exRes.error) throw exRes.error;

      const userIds = new Set<string>();
      (teamRes.data || []).forEach((t: any) => userIds.add(t.user_id));
      (claimsRes.data || []).forEach((c: any) => userIds.add(c.requester_user_id));

      let profilesMap: Record<string, any> = {};
      let emailsMap: Record<string, string> = {};

      if (userIds.size > 0) {
        const ids = Array.from(userIds);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, avatar_url, job_title, company')
          .in('user_id', ids);

        (profiles || []).forEach((p: any) => {
          profilesMap[p.user_id] = p;
        });

        try {
          const { data: emails } = await supabase.rpc('get_user_emails_for_moderation', {
            user_ids: ids,
          });
          (emails || []).forEach((e: any) => {
            emailsMap[e.user_id] = e.email;
          });
        } catch {
          // Non-critical
        }
      }

      const enrichProfile = (userId: string) => {
        const p = profilesMap[userId];
        return {
          first_name: p?.first_name || null,
          last_name: p?.last_name || null,
          email: emailsMap[userId],
          avatar_url: p?.avatar_url || null,
          job_title: p?.job_title || null,
          company: p?.company || null,
          phone: null,
        };
      };

      const exhibitor: AdminExhibitor = {
        ...exRes.data,
        team_count: (teamRes.data || []).filter((t: any) => t.status === 'active').length,
        has_pending_claim: (claimsRes.data || []).some((c: any) => c.status === 'pending'),
        governance_status: exRes.data.is_test
          ? 'test'
          : exRes.data.owner_user_id || (teamRes.data || []).some((t: any) => t.status === 'active')
          ? 'managed'
          : (claimsRes.data || []).some((c: any) => c.status === 'pending')
          ? 'pending'
          : 'unmanaged',
      };

      return {
        exhibitor,
        team_members: (teamRes.data || [])
          .filter((t: any) => t.status === 'active')
          .map((t: any) => ({
            ...t,
            profile: enrichProfile(t.user_id),
          })),
        claims: (claimsRes.data || []).map((c: any) => ({
          ...c,
          profile: enrichProfile(c.requester_user_id),
        })),
      };
    },
    enabled: !!exhibitorId,
  });
}
