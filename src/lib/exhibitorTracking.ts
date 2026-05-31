import { supabase } from '@/integrations/supabase/client';

export type ExhibitorEventType =
  | 'profile_view'
  | 'website_click'
  | 'linkedin_click'
  | 'claim_click'
  | 'event_click'
  | 'novelty_click'
  | 'full_profile_click'
  | 'alert_activate'
  | 'alert_deactivate';

/**
 * Fire-and-forget analytics for public exhibitor profile pages.
 * Calls the SECURITY DEFINER RPC `track_exhibitor_event`.
 * A tracking failure must NEVER break the UI, so all errors are swallowed.
 * Metadata stays strictly non-personal (no email, IP, phone).
 */
export function trackExhibitorEvent(
  eventType: ExhibitorEventType,
  publicSlug: string,
  metadata: Record<string, unknown> = {}
): void {
  if (!publicSlug) return;

  const payload = {
    source_surface: 'profile_page',
    public_slug: publicSlug,
    ...metadata,
  };

  try {
    void supabase
      .rpc('track_exhibitor_event', {
        p_event_type: eventType,
        p_public_slug: publicSlug,
        p_metadata: payload,
      })
      .then(
        () => {},
        () => {}
      );
  } catch {
    /* never block the UI */
  }
}