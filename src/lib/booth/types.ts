export type ContactSource = 'manual' | 'card' | 'search' | 'qr';

export interface Contact {
  id: string;
  exhibitor_id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_domain: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  phone_norm: string | null;
  linkedin_url: string | null;
  lotexpo_company_ref: string | null;
  source: ContactSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  merged_into_id: string | null;
  client_updated_at: string | null;
}

export interface Interaction {
  id: string;
  workspace_id: string;
  exhibitor_id: string;
  contact_id: string;
  owner_user_id: string | null;
  created_by: string | null;
  occurred_at: string;
  relationship: 'new_prospect' | 'customer' | 'partner' | 'other';
  customer_topic: 'new_project' | 'existing_business' | 'relationship' | null;
  potential: 'hot' | 'good' | 'explore' | 'none' | null;
  is_field_lead: boolean;
  next_action: 'call' | 'send_doc' | 'quote' | 'meeting' | 'email' | 'other' | 'none';
  next_action_due: string | null;
  next_action_done_at: string | null;
  next_action_owner_id: string | null;
  note: string | null;
  capture_source: 'manual' | 'card' | 'qr' | 'search' | 'voice';
  inbound_lead_id: string | null;
  status: 'completed' | 'cancelled';
  client_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  workspace_id: string;
  exhibitor_id: string;
  contact_id: string;
  origin_interaction_id: string | null;
  title: string | null;
  value_band: 'lt5k' | '5_20k' | '20_50k' | '50_100k' | 'gt100k' | null;
  amount: number | null;
  currency: string | null;
  horizon: 'lt3m' | '3_6m' | '6_12m' | 'gt12m' | null;
  probability: 10 | 25 | 50 | 75 | 90 | null;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  won_amount: number | null;
  won_at: string | null;
  lost_at: string | null;
  owner_user_id: string | null;
  created_by: string | null;
  client_updated_at: string | null;
}
