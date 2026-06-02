import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Novelty } from '@/hooks/useNovelties';

export interface PublicExhibitorProfile {
  public_identity_id: string | null;
  public_slug: string | null;
  source_type: string | null;
  legacy_exposant_id: string | null;
  exhibitor_id: string | null;
  display_name: string | null;
  canonical_name: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  ai_summary: string | null;
  linkedin_url: string | null;
  is_claimed: boolean | null;
  is_verified: boolean | null;
  is_test: boolean | null;
  total_participations: number | null;
  future_participations_count: number | null;
  past_participations_count: number | null;
  published_novelties_count: number | null;
  has_future_events: boolean | null;
  has_published_novelties: boolean | null;
  has_website: boolean | null;
  has_description: boolean | null;
  has_logo: boolean | null;
  seo_indexable: boolean | null;
  seo_reason: string | null;
  last_activity_at: string | null;
  next_event_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExhibitorUpcomingEvent {
  id: string;
  slug: string | null;
  nom_event: string;
  ville: string | null;
  nom_lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  stand: string | null;
}

export type ExhibitorParticipationStatus = 'ongoing' | 'upcoming' | 'past';

export interface ExhibitorParticipation extends ExhibitorUpcomingEvent {
  status: ExhibitorParticipationStatus;
  year: number | null;
}

/**
 * Fetches the public exhibitor profile from the `public_exhibitor_profiles`
 * view by its stable public slug. Returns null when no profile exists.
 * NOTE: `is_test` filtering (404) is handled by the page, not here, so the
 * page can distinguish "not found" from "test profile".
 */
export function useExhibitorProfile(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-exhibitor-profile', slug],
    queryFn: async (): Promise<PublicExhibitorProfile | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('public_exhibitor_profiles')
        .select('*')
        .eq('public_slug', slug)
        .maybeSingle();
      if (error) throw error;
      return (data as PublicExhibitorProfile) ?? null;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}

/**
 * Fetches the real list of upcoming / ongoing events for an exhibitor.
 * Links participations via legacy id (id_exposant) AND/OR modern id
 * (exhibitor_id), merges + dedupes by event UUID, keeps only visible,
 * non-test events whose end (or start) date is today or later.
 * Returns the full list sorted by date_debut ASC (page slices to display).
 */
export function useExhibitorUpcomingEvents(
  exhibitorId: string | null | undefined,
  legacyExposantId: string | null | undefined
) {
  return useQuery({
    queryKey: ['exhibitor-upcoming-events', exhibitorId, legacyExposantId],
    queryFn: async (): Promise<ExhibitorUpcomingEvent[]> => {
      if (!exhibitorId && !legacyExposantId) return [];

      // 1. Collect participation rows from both linking strategies.
      const standByEventId = new Map<string, string | null>();

      const queries = [];
      if (legacyExposantId) {
        queries.push(
          supabase
            .from('participation')
            .select('id_event, stand_exposant')
            .eq('id_exposant', legacyExposantId)
        );
      }
      if (exhibitorId) {
        queries.push(
          supabase
            .from('participation')
            .select('id_event, stand_exposant')
            .eq('exhibitor_id', exhibitorId)
        );
      }

      const results = await Promise.all(queries);
      for (const res of results) {
        for (const row of res.data ?? []) {
          const eventUuid = (row as any).id_event as string | null;
          if (!eventUuid) continue;
          // Dedupe: keep first known stand for an event.
          if (!standByEventId.has(eventUuid)) {
            standByEventId.set(eventUuid, (row as any).stand_exposant ?? null);
          } else if (!standByEventId.get(eventUuid) && (row as any).stand_exposant) {
            standByEventId.set(eventUuid, (row as any).stand_exposant);
          }
        }
      }

      const eventUuids = Array.from(standByEventId.keys());
      if (eventUuids.length === 0) return [];

      // 2. Fetch the real events (visible, non-test).
      const today = new Date().toISOString().slice(0, 10);
      const { data: events, error } = await supabase
        .from('events')
        .select('id, slug, nom_event, ville, nom_lieu, date_debut, date_fin, visible, is_test')
        .in('id', eventUuids)
        .eq('visible', true)
        .eq('is_test', false);
      if (error) throw error;

      // 3. Keep upcoming / ongoing: COALESCE(date_fin, date_debut) >= today.
      const upcoming = (events ?? []).filter((e) => {
        const end = (e.date_fin || e.date_debut) as string | null;
        return end ? end >= today : false;
      });

      // 4. Sort by date_debut ASC.
      upcoming.sort((a, b) => {
        const da = a.date_debut || '';
        const db = b.date_debut || '';
        return da < db ? -1 : da > db ? 1 : 0;
      });

      return upcoming.map((e) => ({
        id: e.id as string,
        slug: e.slug ?? null,
        nom_event: e.nom_event,
        ville: e.ville ?? null,
        nom_lieu: e.nom_lieu ?? null,
        date_debut: e.date_debut ?? null,
        date_fin: e.date_fin ?? null,
        stand: standByEventId.get(e.id as string) ?? null,
      }));
    },
    enabled: !!(exhibitorId || legacyExposantId),
    staleTime: 60_000,
  });
}

/**
 * Fetches the FULL participation history for an exhibitor (past, ongoing AND
 * upcoming events). Links participations via legacy id (id_exposant) AND/OR
 * modern id (exhibitor_id), merges + dedupes by event UUID, keeps only
 * visible, non-test events. Computes a status (ongoing / upcoming / past) per
 * event and returns the list ordered as: upcoming/ongoing first (date ASC),
 * then past (date DESC) — same security & visibility rules as the other blocks.
 */
export function useExhibitorParticipationHistory(
  exhibitorId: string | null | undefined,
  legacyExposantId: string | null | undefined
) {
  return useQuery({
    queryKey: ['exhibitor-participation-history', exhibitorId, legacyExposantId],
    queryFn: async (): Promise<ExhibitorParticipation[]> => {
      if (!exhibitorId && !legacyExposantId) return [];

      // 1. Collect participation rows from both linking strategies and dedupe
      //    by event UUID (anti-doublon entre exhibitor_id et id_exposant).
      const standByEventId = new Map<string, string | null>();

      const queries = [];
      if (legacyExposantId) {
        queries.push(
          supabase
            .from('participation')
            .select('id_event, stand_exposant')
            .eq('id_exposant', legacyExposantId)
        );
      }
      if (exhibitorId) {
        queries.push(
          supabase
            .from('participation')
            .select('id_event, stand_exposant')
            .eq('exhibitor_id', exhibitorId)
        );
      }

      const results = await Promise.all(queries);
      for (const res of results) {
        for (const row of res.data ?? []) {
          const eventUuid = (row as any).id_event as string | null;
          if (!eventUuid) continue;
          if (!standByEventId.has(eventUuid)) {
            standByEventId.set(eventUuid, (row as any).stand_exposant ?? null);
          } else if (!standByEventId.get(eventUuid) && (row as any).stand_exposant) {
            standByEventId.set(eventUuid, (row as any).stand_exposant);
          }
        }
      }

      const eventUuids = Array.from(standByEventId.keys());
      if (eventUuids.length === 0) return [];

      // 2. Fetch the real events (visible, non-test) — no date filter so the
      //    full history (incl. past editions) is returned.
      const { data: events, error } = await supabase
        .from('events')
        .select('id, slug, nom_event, ville, nom_lieu, date_debut, date_fin, visible, is_test')
        .in('id', eventUuids)
        .eq('visible', true)
        .eq('is_test', false);
      if (error) throw error;

      const today = new Date().toISOString().slice(0, 10);

      const items: ExhibitorParticipation[] = (events ?? []).map((e) => {
        const start = (e.date_debut as string | null) ?? null;
        const end = (e.date_fin as string | null) ?? start;
        let status: ExhibitorParticipationStatus = 'past';
        if (start) {
          if (end && start <= today && today <= end) status = 'ongoing';
          else if (start > today) status = 'upcoming';
          else status = 'past';
        } else if (end && end >= today) {
          status = 'upcoming';
        }
        return {
          id: e.id as string,
          slug: e.slug ?? null,
          nom_event: e.nom_event,
          ville: e.ville ?? null,
          nom_lieu: e.nom_lieu ?? null,
          date_debut: start,
          date_fin: e.date_fin ?? null,
          stand: standByEventId.get(e.id as string) ?? null,
          status,
          year: start ? Number(start.slice(0, 4)) : null,
        };
      });

      // 3. Order: upcoming/ongoing first (date ASC), then past (date DESC).
      const rank = (s: ExhibitorParticipationStatus) => (s === 'past' ? 1 : 0);
      items.sort((a, b) => {
        const ra = rank(a.status);
        const rb = rank(b.status);
        if (ra !== rb) return ra - rb;
        const da = a.date_debut || '';
        const db = b.date_debut || '';
        if (ra === 0) return da < db ? -1 : da > db ? 1 : 0; // upcoming ASC
        return da > db ? -1 : da < db ? 1 : 0; // past DESC
      });

      return items;
    },
    enabled: !!(exhibitorId || legacyExposantId),
    staleTime: 60_000,
  });
}

/**
 * Fetches the latest published novelties for an exhibitor (modern id only).
 * Returns the full published list sorted by updated_at DESC (page slices).
 */
export function useExhibitorNovelties(exhibitorId: string | null | undefined) {
  return useQuery({
    queryKey: ['exhibitor-novelties', exhibitorId],
    queryFn: async (): Promise<Novelty[]> => {
      if (!exhibitorId) return [];
      const { data, error } = await supabase
        .from('novelties')
        .select(`
          id,
          event_id,
          exhibitor_id,
          title,
          type,
          reason_1,
          reason_2,
          reason_3,
          audience_tags,
          media_urls,
          doc_url,
          availability,
          stand_info,
          status,
          is_premium,
          is_test,
          created_at,
          updated_at,
          exhibitors!novelties_exhibitor_id_fkey (
            id,
            name,
            slug,
            logo_url
          ),
          events!inner (
            id,
            nom_event,
            slug,
            ville
          )
        `)
        .eq('exhibitor_id', exhibitorId)
        .eq('status', 'published')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      return (data ?? [])
        .filter((n: any) => n.exhibitors !== null)
        .filter((n: any) => n.is_test !== true) as Novelty[];
    },
    enabled: !!exhibitorId,
    staleTime: 60_000,
  });
}