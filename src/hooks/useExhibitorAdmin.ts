import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ExhibitorLead {
  id: string;
  lead_type: 'brochure_download' | 'meeting_request';
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
        total_downloads: leads.filter(l => l.lead_type === 'brochure_download').length,
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

      const { data, error } = await supabase
        .from('exhibitors')
        .select('id, name, logo_url')
        .eq('owner_user_id', user.id)
        .eq('approved', true);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}