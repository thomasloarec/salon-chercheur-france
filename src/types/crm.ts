
export type CrmProvider = 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho';

export interface CrmConnection {
  id: string;
  user_id: string;
  provider: CrmProvider;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CrmConnectionEncrypted {
  id: string;
  user_id: string;
  provider: CrmProvider;
  access_token_enc: Uint8Array;
  refresh_token_enc?: Uint8Array;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CrmCompany {
  id: string;
  user_id: string;
  company_id: string;
  provider: CrmProvider;
  external_id: string;
  last_synced_at: string;
  created_at: string;
}

export interface CrmIntegrationStatus {
  provider: CrmProvider;
  connected: boolean;
  lastSync?: string;
  accountsCount: number;
}

export interface CrmAccount {
  external_id: string;
  name: string;
  website?: string;
}
