import type { MeetingDraft } from '../salon/draft';
import type { BoothVoiceFields } from '@/lib/booth/rpc';

const REL = ['new_prospect', 'customer', 'partner', 'other'];
const POT = ['hot', 'good', 'explore', 'none'];
const TOP = ['new_project', 'existing_business', 'relationship'];
const ACT = ['call', 'send_doc', 'quote', 'meeting', 'email', 'other', 'none'];
const BAND = ['lt5k', '5_20k', '20_50k', '50_100k', 'gt100k'];
const HOR = ['lt3m', '3_6m', '6_12m', 'gt12m'];

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const pick = <T extends string>(v: unknown, allowed: string[]) => (allowed.includes(s(v)) ? (s(v) as T) : null);

/**
 * Remplit le brouillon avec les champs dictés, sans jamais écraser une valeur déjà saisie.
 * Fonction pure : renvoie un nouveau brouillon.
 */
export function applyVoiceFields(draft: MeetingDraft, fields: BoothVoiceFields | null | undefined, transcript?: string | null): MeetingDraft {
  const d: MeetingDraft = { ...draft };
  const f = fields ?? ({} as Partial<BoothVoiceFields>);
  const c = f.contact ?? null;

  if (c) {
    const name = [s(c.first_name), s(c.last_name)].filter(Boolean).join(' ');
    if (!d.name.trim() && name) d.name = name;
    if (!d.company.trim() && s(c.company_name)) d.company = s(c.company_name);
    if (!d.jobTitle.trim() && s(c.job_title)) d.jobTitle = s(c.job_title);
    const email = s(c.email);
    const phone = s(c.phone);
    if (!d.coordValue.trim()) {
      if (email) {
        d.coordMode = 'email';
        d.coordValue = email;
        if (phone && !d.phoneExtra.trim()) d.phoneExtra = phone;
      } else if (phone) {
        d.coordMode = 'phone';
        d.coordValue = phone;
      }
    } else if (d.coordMode === 'email' && phone && !d.phoneExtra.trim()) {
      d.phoneExtra = phone;
    }
  }

  if (!d.relationship) d.relationship = pick<MeetingDraft['relationship'] & string>(f.relationship, REL);
  if (d.relationship === 'customer') {
    if (!d.customer_topic) d.customer_topic = pick<NonNullable<MeetingDraft['customer_topic']>>(f.customer_topic, TOP);
  } else if (!d.potential) {
    d.potential = pick<NonNullable<MeetingDraft['potential']>>(f.potential, POT);
  }

  const p = f.project ?? null;
  if (p) {
    if (d.concrete === null) d.concrete = true;
    if (!d.value_band) d.value_band = pick<NonNullable<MeetingDraft['value_band']>>(p.value_band, BAND);
    if (!d.amount.trim() && typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount > 0) d.amount = String(p.amount);
    if (!d.horizon) d.horizon = pick<NonNullable<MeetingDraft['horizon']>>(p.horizon, HOR);
  }

  if (!d.next_action) d.next_action = pick<MeetingDraft['next_action'] & string>(f.next_action, ACT);
  if (!d.due && d.next_action && d.next_action !== 'none') {
    const due = s(f.next_action_due).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(due)) d.due = due;
  }

  const summary = s(f.note);
  const raw = s(transcript);
  const add = summary || (raw ? `Dictée : ${raw}` : '');
  if (add) d.note = (d.note.trim() ? `${d.note.trim()}\n${add}` : add).slice(0, 2000);

  return d;
}
