import { supabase } from '@/integrations/supabase/client';

export type RadarEventType =
  | 'radar_page_viewed'
  | 'csv_upload_started'
  | 'csv_parsed'
  | 'auth_required_shown'
  | 'signup_started_from_radar'
  | 'login_started_from_radar'
  | 'crm_import_started'
  | 'crm_import_completed'
  | 'crm_import_failed'
  | 'crm_results_viewed'
  | 'crm_event_clicked'
  | 'crm_unmatched_viewed';

export async function trackRadarEvent(event_type: RadarEventType, metadata: Record<string, unknown> = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('crm_usage_events').insert({
      event_type,
      user_id: user?.id ?? null,
      metadata,
    });
  } catch (e) {
    // Tracking must never break the UI
    console.warn('[radar tracking] failed', event_type, e);
  }
}

const PENDING_KEY = 'radarCrmPendingImport';

export interface PendingImport {
  fileName: string;
  mapping: Record<string, string>;
  rows: Array<Record<string, unknown>>;
  savedAt: number;
}

export function savePendingImport(p: Omit<PendingImport, 'savedAt'>) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
  } catch {/* quota/security */}
}

export function loadPendingImport(): PendingImport | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingImport;
    // Expire after 1 hour
    if (Date.now() - parsed.savedAt > 60 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingImport() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {/* */}
}
