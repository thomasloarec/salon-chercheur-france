import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Onglet « Invitations » de l'espace exposant (lot 4).
 * RPC et tables du lot 1 : get_invitation_pages_overview, upsert_invitation_page,
 * exhibitor_staff, exhibitor_invitation_pages, exhibitor_invitation_page_staff,
 * bucket exhibitor-staff. Casts `as never` : objets absents des types générés.
 */

export type InvitationState = 'locked' | 'pending' | 'ready' | 'draft' | 'online' | 'suspended' | 'ended';

export interface InvitationOverviewRow {
  event_id: string;
  event_name: string;
  event_slug: string | null;
  date_debut: string;
  date_fin: string | null;
  ville: string | null;
  state: InvitationState;
  novelty_id: string | null;
  novelty_title: string | null;
  novelty_status: string | null;
  invitation_id: string | null;
  invitation_slug: string | null;
  invitation_status: string | null;
  requests_count: number;
}

export interface StaffMember {
  id: string;
  exhibitor_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface InvitationDraft {
  id: string;
  headline: string | null;
  message: string | null;
  status: 'draft' | 'published';
  slug: string;
  staff_ids: string[];
}

export const invitationKeys = {
  overview: (exhibitorId?: string) => ['invitation-overview', exhibitorId] as const,
  staff: (exhibitorId?: string) => ['exhibitor-staff', exhibitorId] as const,
  draft: (exhibitorId?: string, eventId?: string) => ['invitation-draft', exhibitorId, eventId] as const,
};

export const INVITATION_BASE_URL = 'https://lotexpo.com/invitation/';

export function useInvitationOverview(exhibitorId?: string) {
  return useQuery({
    queryKey: invitationKeys.overview(exhibitorId),
    queryFn: async (): Promise<InvitationOverviewRow[]> => {
      const { data, error } = await supabase.rpc(
        'get_invitation_pages_overview' as never,
        { p_exhibitor_id: exhibitorId } as never,
      );
      if (error) throw error;
      return (data ?? []) as unknown as InvitationOverviewRow[];
    },
    enabled: !!exhibitorId,
    staleTime: 30_000,
  });
}

export function useExhibitorStaff(exhibitorId?: string) {
  return useQuery({
    queryKey: invitationKeys.staff(exhibitorId),
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase
        .from('exhibitor_staff' as never)
        .select('*')
        .eq('exhibitor_id', exhibitorId as string)
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as StaffMember[];
    },
    enabled: !!exhibitorId,
  });
}

export function useInvitationDraft(exhibitorId?: string, eventId?: string) {
  return useQuery({
    queryKey: invitationKeys.draft(exhibitorId, eventId),
    queryFn: async (): Promise<InvitationDraft | null> => {
      const { data, error } = await supabase
        .from('exhibitor_invitation_pages' as never)
        .select('id, headline, message, status, slug, exhibitor_invitation_page_staff(staff_id, sort_order)')
        .eq('exhibitor_id', exhibitorId as string)
        .eq('event_id', eventId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as InvitationDraft & {
        exhibitor_invitation_page_staff: { staff_id: string; sort_order: number }[];
      };
      return {
        id: row.id,
        headline: row.headline,
        message: row.message,
        status: row.status,
        slug: row.slug,
        staff_ids: [...(row.exhibitor_invitation_page_staff ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => s.staff_id),
      };
    },
    enabled: !!exhibitorId && !!eventId,
  });
}

export function useSaveInvitation(exhibitorId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      eventId: string;
      headline: string;
      message: string;
      staffIds: string[];
      publish: boolean;
    }) => {
      const { data, error } = await supabase.rpc(
        'upsert_invitation_page' as never,
        {
          p_exhibitor_id: exhibitorId,
          p_event_id: input.eventId,
          p_headline: input.headline,
          p_message: input.message,
          p_staff_ids: input.staffIds,
          p_publish: input.publish,
        } as never,
      );
      if (error) throw error;
      const saved = data as unknown as { slug?: string; status?: string } | null;
      // Garde anti-échec silencieux : la RPC renvoie toujours la ligne enregistrée.
      if (!saved?.slug) throw new Error('save_not_confirmed');
      return saved as { slug: string; status: 'draft' | 'published' };
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.overview(exhibitorId) });
      queryClient.invalidateQueries({ queryKey: invitationKeys.draft(exhibitorId, v.eventId) });
    },
  });
}

export function useSaveStaff(exhibitorId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      first_name: string;
      last_name: string;
      job_title: string;
      linkedin_url: string;
      photo?: File | null;
      photo_url?: string | null;
    }) => {
      let photoUrl = input.photo_url ?? null;
      if (input.photo) {
        const ext = (input.photo.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${exhibitorId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('exhibitor-staff')
          .upload(path, input.photo, { contentType: input.photo.type, upsert: false });
        if (upErr) throw upErr;
        photoUrl = supabase.storage.from('exhibitor-staff').getPublicUrl(path).data.publicUrl;
      }
      const row = {
        exhibitor_id: exhibitorId,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        job_title: input.job_title.trim() || null,
        linkedin_url: input.linkedin_url.trim() || null,
        photo_url: photoUrl,
      };
      const query = input.id
        ? supabase.from('exhibitor_staff' as never).update(row as never).eq('id', input.id).select('id')
        : supabase.from('exhibitor_staff' as never).insert(row as never).select('id');
      const { data, error } = await query;
      if (error) throw error;
      if (!data || (data as unknown[]).length === 0) throw new Error('save_blocked');
      return (data as unknown as { id: string }[])[0].id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.staff(exhibitorId) }),
  });
}

export function useArchiveStaff(exhibitorId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('exhibitor_staff' as never)
        .update({ is_active: false } as never)
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || (data as unknown[]).length === 0) throw new Error('update_blocked');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.staff(exhibitorId) }),
  });
}

/** Texte de post LinkedIn prêt à coller (LinkedIn ne pré-remplit plus le texte via lien). */
export function buildLinkedInPost(opts: {
  eventName: string;
  dates: string;
  noveltyTitle?: string | null;
  url: string;
}) {
  const lines = [
    `Nous serons au ${opts.eventName} ${opts.dates}.`,
    opts.noveltyTitle ? `Nous y présenterons ${opts.noveltyTitle}, en avant-première.` : null,
    '',
    'Envie d’échanger sur votre projet ? Réservez dès maintenant un moment avec notre équipe sur le stand :',
    opts.url,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export function buildEmailTemplate(opts: {
  eventName: string;
  dates: string;
  noveltyTitle?: string | null;
  url: string;
}) {
  return {
    subject: `Invitation : retrouvons-nous au ${opts.eventName}`,
    body: [
      'Bonjour,',
      '',
      `Nous serons présents au ${opts.eventName} ${opts.dates}${opts.noveltyTitle ? ` et y présenterons ${opts.noveltyTitle}` : ''}.`,
      'Nous serions ravis de vous y retrouver. Vous pouvez choisir dès maintenant le jour et le moment qui vous conviennent :',
      opts.url,
      '',
      'À très bientôt,',
    ].join('\n'),
  };
}

export function linkedInShareUrl(url: string) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

/**
 * Données d'aperçu pour l'éditeur (exposant, salon, stand, Nouveauté), même
 * forme que la page publique, disponibles même en brouillon.
 * RPC get_invitation_preview : lot 4 backend (réservée aux managers).
 */
export function useInvitationPreview(exhibitorId?: string, eventId?: string) {
  return useQuery({
    queryKey: ['invitation-preview', exhibitorId, eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_invitation_preview' as never,
        { p_exhibitor_id: exhibitorId, p_event_id: eventId } as never,
      );
      if (error) throw error;
      return data as unknown as import('@/components/invitation/types').InvitationPageData;
    },
    enabled: !!exhibitorId && !!eventId,
  });
}
