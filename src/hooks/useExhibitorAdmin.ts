import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ExhibitorLead {
  id: string;
  lead_type: 'resource_download' | 'meeting_request';
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  notes?: string;
  created_at: string;
  novelties: {
    id: string;
    title: string;
  };
}

export interface ExhibitorStats {
  total_likes: number;
  total_downloads: number;
  total_meetings: number;
  novelties_count: number;
}

export function useExhibitorAdmin(exhibitorId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['exhibitor-admin', exhibitorId, user?.id],
    queryFn: async () => {
      if (!user || !exhibitorId) return null;

      // Verify user is admin of this exhibitor
      const { data: exhibitor, error: exhibitorError } = await supabase
        .from('exhibitors')
        .select('id, name, owner_user_id')
        .eq('id', exhibitorId)
        .eq('owner_user_id', user.id)
        .single();

      if (exhibitorError || !exhibitor) {
        throw new Error('Access denied or exhibitor not found');
      }

      // Get leads for this exhibitor's novelties
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          lead_type,
          first_name,
          last_name,
          email,
          company,
          role,
          phone,
          notes,
          created_at,
          novelties!inner (
            id,
            title,
            exhibitor_id
          )
        `)
        .eq('novelties.exhibitor_id', exhibitorId)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Get stats
      const { data: novelties, error: noveltiesError } = await supabase
        .from('novelties')
        .select(`
          id,
          novelty_likes (count)
        `)
        .eq('exhibitor_id', exhibitorId)
        .eq('status', 'published');

      if (noveltiesError) throw noveltiesError;

      const stats: ExhibitorStats = {
        total_likes: novelties.reduce((sum, n) => sum + (n.novelty_likes?.length || 0), 0),
        total_downloads: leads.filter(l => l.lead_type === 'resource_download').length,
        total_meetings: leads.filter(l => l.lead_type === 'meeting_request').length,
        novelties_count: novelties.length,
      };

      return {
        exhibitor,
        leads: leads as ExhibitorLead[],
        stats
      };
    },
    enabled: !!user && !!exhibitorId,
  });
}

export function useUserExhibitors() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-exhibitors', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: memberships, error: mErr } = await supabase
        .from('exhibitor_team_members')
        .select('exhibitor_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin']);
      if (mErr) throw mErr;

      const ids = (memberships ?? []).map((m) => m.exhibitor_id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('exhibitors')
        .select('id, name, logo_url')
        .in('id', ids);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export interface ExhibitorMeetingRequest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
  exhibitor_id: string;
  event_id: string | null;
  events: { nom_event: string; slug: string | null; date_debut: string | null } | null;
}

export function useExhibitorMeetingRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['exhibitor-meeting-requests', user?.id],
    queryFn: async (): Promise<ExhibitorMeetingRequest[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, phone, company, role, notes, status, created_at, exhibitor_id, event_id, events(nom_event, slug, date_debut)')
        .is('novelty_id', null)
        .eq('lead_type', 'meeting_request')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExhibitorMeetingRequest[];
    },
    enabled: !!user,
  });
}

export function useUpdateMeetingRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exhibitor-meeting-requests'] });
    },
  });
}

export interface UserSalon {
  id: string;
  nom_event: string;
  slug: string | null;
  url_image: string | null;
  verified_at: string | null;
}

export function useUserSalons() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-salons', user?.id],
    queryFn: async (): Promise<UserSalon[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('events')
        .select('id, nom_event, slug, url_image, verified_at')
        .eq('owner_user_id', user.id)
        .eq('visible', true)
        .eq('is_test', false);

      if (error) throw error;
      return (data ?? []) as UserSalon[];
    },
    enabled: !!user,
  });
}