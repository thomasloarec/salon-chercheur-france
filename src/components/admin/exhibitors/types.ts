export type AdminSelection =
  | { kind: 'exhibitor'; exhibitor_id: string }
  | {
      kind: 'outreach';
      outreach_id: string;
      name: string;
      website: string | null;
      contact_email: string | null;
      event_id: string | null;
      campaign_status: string | null;
      current_step: string | null;
      exhibitor_id?: string | null;
    }
  | {
      kind: 'legacy';
      legacy_id: string;
      name: string;
      website: string | null;
    };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && UUID_RE.test(v);