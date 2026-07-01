import { supabase } from '@/integrations/supabase/client';

export type RadarEventType =
  | 'radar_page_viewed'
  | 'radar_landing_viewed'
  | 'radar_landing_cta_clicked'
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
  | 'crm_unmatched_viewed'
  | 'crm_result_event_card_viewed'
  | 'crm_favorite_clicked'
  | 'crm_calendar_clicked'
  | 'crm_event_detail_clicked'
  | 'crm_unmatched_list_opened'
  | 'crm_exhibitor_dialog_opened'
  | 'radar_settings_opened'
  | 'radar_notification_preferences_updated'
  | 'radar_data_delete_clicked'
  | 'radar_data_delete_confirmed'
  | 'radar_data_deleted'
  | 'radar_privacy_notice_acknowledged'
  | 'crm_event_widget_viewed_with_matches'
  | 'crm_event_widget_teaser_clicked'
  | 'crm_event_widget_results_clicked'
  | 'crm_access_requested'
  | 'radar_offer_profile_saved'
  | 'radar_company_relationship_updated';

export async function trackRadarEvent(event_type: RadarEventType, metadata: Record<string, unknown> = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('crm_usage_events').insert([{
      event_type,
      user_id: user?.id ?? null,
      metadata: metadata as never,
    }]);
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
  sourceType?: 'csv' | 'excel';
  sheetName?: string;
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
