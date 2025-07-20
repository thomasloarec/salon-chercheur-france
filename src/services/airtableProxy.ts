
import { supabase } from '@/integrations/supabase/client';

export class AirtableProxyClient {
  private async callProxy(action: string, table: string, payload?: any, uniqueField?: string) {
    const { data, error } = await supabase.functions.invoke('airtable-proxy', {
      body: { action, table, payload, uniqueField }
    });

    if (error) {
      console.error('Airtable proxy error:', error);
      throw new Error(`Airtable proxy error: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Unknown error from Airtable proxy');
    }

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
