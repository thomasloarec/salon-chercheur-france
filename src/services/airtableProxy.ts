
import { supabase } from '@/integrations/supabase/client';

export class AirtableProxyClient {
  private async callProxy(action: string, table: string, payload?: any, uniqueField?: string) {
    console.log(`[AirtableProxy] 🔄 Appel ${action} sur table ${table}`);
    
    const { data, error } = await supabase.functions.invoke('airtable-proxy', {
      body: { action, table, payload, uniqueField }
    });

    if (error) {
      console.error('[AirtableProxy] ❌ Erreur Supabase function:', error);
      throw new Error(`Airtable proxy error: ${error.message}`);
    }

    // Nouveau format de réponse unifié
    if (!data.success) {
      console.error('[AirtableProxy] ❌ Erreur retournée:', data);
      
      // Gestion des différents types d'erreur
      if (data.error === 'airtable_error') {
        throw new Error(`Airtable ${data.status}: ${data.message}`);
      } else if (data.error === 'missing_env') {
        throw new Error(`Configuration manquante: ${data.missing?.join(', ') || 'variables requises'}`);
      } else {
        throw new Error(data.message || data.error || 'Unknown error from Airtable proxy');
      }
    }

    console.log(`[AirtableProxy] ✅ Succès ${action} sur ${table}`);
    return data.data;
  }

  async listAllRecords(table: string) {
    return this.callProxy('LIST', table);
  }

  async createRecords(table: string, records: any[]) {
    return this.callProxy('CREATE', table, records);
  }

  async upsertRecords(table: string, records: any[], uniqueField: string) {
    return this.callProxy('UPSERT', table, records, uniqueField);
  }

  async findRecordByUniqueField(table: string, fieldName: string, value: string) {
    return this.callProxy('FIND', table, { fieldName, value });
  }

  async deleteRecords(table: string, recordIds: string[]) {
    return this.callProxy('DELETE', table, recordIds);
  }
}

export const airtableProxy = new AirtableProxyClient();
