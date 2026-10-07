import { del, get, put } from '../storage/db';
import type { Interaction, Opportunity } from '@/lib/booth/types';

export type FlowStep = 'who' | 'verify' | 'coord' | 'rel' | 'pot' | 'topic' | 'concrete' | 'action' | 'details' | 'done';

export interface MeetingDraft {
  step: FlowStep;
  history: FlowStep[];
  name: string;
  company: string;
  companyDomain: string | null;
  companyRef: string | null;
  contactId: string | null;
  coordMode: 'email' | 'phone' | 'none' | null;
  coordValue: string;
  relationship: Interaction['relationship'] | null;
  customer_topic: Interaction['customer_topic'];
  potential: Interaction['potential'];
  concrete: boolean | null;
  next_action: Interaction['next_action'] | null;
  due: string | null;
  owner: string | null;
  value_band: Opportunity['value_band'];
  amount: string;
  horizon: Opportunity['horizon'];
  note: string;
  inbound_lead_id: string | null;
  jobTitle: string;
  linkedinUrl: string | null;
  phoneExtra: string;
  captureSource: 'manual' | 'qr' | 'card';
  cardScanId: string | null;
  cardConfidence: Record<string, 'high' | 'medium' | 'low'> | null;
}

export const emptyDraft = (): MeetingDraft => ({
  step: 'who',
  history: [],
  name: '',
  company: '',
  companyDomain: null,
  companyRef: null,
  contactId: null,
  coordMode: null,
  coordValue: '',
  relationship: null,
  customer_topic: null,
  potential: null,
  concrete: null,
  next_action: null,
  due: null,
  owner: null,
  value_band: null,
  amount: '',
  horizon: null,
  note: '',
  inbound_lead_id: null,
  jobTitle: '',
  linkedinUrl: null,
  phoneExtra: '',
  captureSource: 'manual',
  cardScanId: null,
  cardConfidence: null,
});

const key = (userId: string, workspaceId: string) => `${userId}|${workspaceId}|draft`;

export async function loadDraft(userId: string, workspaceId: string): Promise<MeetingDraft | null> {
  const r = await get<{ key: string; value: MeetingDraft }>('meta', key(userId, workspaceId));
  return r?.value ?? null;
}
export const saveDraft = (userId: string, workspaceId: string, value: MeetingDraft) =>
  put('meta', { key: key(userId, workspaceId), value });
export const clearDraft = (userId: string, workspaceId: string) => del('meta', key(userId, workspaceId));
