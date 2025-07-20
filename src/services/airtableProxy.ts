
import { supabase } from '@/integrations/supabase/client';

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

export interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface AirtableWriteResponse {
  success: boolean;
  duplicate?: boolean;
  records?: AirtableRecord[];
  message?: string;
  error?: string;
}

export class AirtableProxyClient {
  async callRead(table: string): Promise<AirtableResponse> {
    console.log(`[AirtableProxy] 🔄 Lecture ${table}`);
    
    try {
      // Essai GET d'abord
      const { data, error } = await supabase.functions.invoke('airtable-read', {
        method: 'GET',
        body: null
      });

      if (error) {
        console.error(`[AirtableProxy] ❌ Erreur Supabase function (read):`, error);
        throw error;
      }

      if (!data.success) {
        console.error(`[AirtableProxy] ❌ Erreur fonction read:`, data.error);
        throw new Error(data.error || 'Erreur inconnue');
      }

      console.log(`[AirtableProxy] ✅ Succès lecture ${table}:`, data.records?.length || 0, 'records');
      return { records: data.records || [] };
    } catch (error) {
      console.error(`[AirtableProxy] ❌ Exception lecture ${table}:`, error);
      throw error;
    }
  }

  async callWrite(table: string, records: any[]): Promise<AirtableWriteResponse> {
    console.log(`[AirtableProxy] 🔄 Écriture ${table}:`, records.length, 'records');
    
    try {
      const { data, error } = await supabase.functions.invoke('airtable-write', {
        method: 'POST',
        body: { table, records }
      });

      if (error) {
        console.error(`[AirtableProxy] ❌ Erreur Supabase function (write):`, error);
        throw error;
      }

      console.log(`[AirtableProxy] ✅ Succès écriture ${table}:`, data);
      return data;
    } catch (error) {
      console.error(`[AirtableProxy] ❌ Exception écriture ${table}:`, error);
      throw error;
    }
  }

  async listAllRecords(table: string): Promise<AirtableRecord[]> {
    const response = await this.callRead(table);
    return response.records;
  }

  async upsertRecords(table: string, records: any[], keyField: string): Promise<AirtableWriteResponse> {
    return await this.callWrite(table, records);
  }
}

export const airtableProxy = new AirtableProxyClient();
