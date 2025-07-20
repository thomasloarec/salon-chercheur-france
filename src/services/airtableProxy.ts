
import { supabase } from '@/integrations/supabase/client';

export class AirtableProxyClient {
  private async callRead(table: string) {
    console.log(`[AirtableProxy] 🔄 Lecture ${table}`);
    
    const { data, error } = await supabase.functions.invoke('airtable-read', {
      body: { table }
    });

    if (error) {
      console.error('[AirtableProxy] ❌ Erreur Supabase function (read):', error);
      throw new Error(`Airtable read error: ${error.message}`);
    }

    if (!data.success) {
      console.error('[AirtableProxy] ❌ Erreur retournée (read):', data);
      
      if (data.error === 'airtable_error') {
        throw new Error(`Airtable ${data.status}: ${data.message}`);
      } else if (data.error === 'missing_env') {
        throw new Error(`Configuration manquante: ${data.missing?.join(', ') || 'variables requises'}`);
      } else {
        throw new Error(data.message || data.error || 'Unknown error from Airtable read');
      }
    }

    console.log(`[AirtableProxy] ✅ Succès lecture ${table}: ${data.records?.length || 0} records`);
    return data.records;
  }

  private async callWrite(table: string, records: any[]) {
    console.log(`[AirtableProxy] 🔄 Écriture ${table}: ${records.length} records`);
    
    const { data, error } = await supabase.functions.invoke('airtable-write', {
      body: { table, records }
    });

    if (error) {
      console.error('[AirtableProxy] ❌ Erreur Supabase function (write):', error);
      throw new Error(`Airtable write error: ${error.message}`);
    }

    if (!data.success) {
      console.error('[AirtableProxy] ❌ Erreur retournée (write):', data);
      
      if (data.error === 'airtable_error') {
        throw new Error(`Airtable ${data.status}: ${data.message}`);
      } else if (data.error === 'missing_env') {
        throw new Error(`Configuration manquante: ${data.missing?.join(', ') || 'variables requises'}`);
      } else if (data.schema === false) {
        throw new Error(`Erreur de schéma: ${data.message}`);
      } else {
        throw new Error(data.message || data.error || 'Unknown error from Airtable write');
      }
    }

    if (data.duplicate) {
      console.log(`[AirtableProxy] 🔄 Doublon détecté sur ${table}`);
      return { duplicate: true };
    }

    console.log(`[AirtableProxy] ✅ Succès écriture ${table}: ${data.records?.length || 0} records créés`);
    return data.records;
  }

  async listAllRecords(table: string) {
    return this.callRead(table);
  }

  async createRecords(table: string, records: any[]) {
    return this.callWrite(table, records);
  }

  async upsertRecords(table: string, records: any[], uniqueField: string) {
    // For now, treat upsert as create - the write function handles duplicates
    return this.callWrite(table, records);
  }

  async findRecordByUniqueField(table: string, fieldName: string, value: string) {
    const records = await this.callRead(table);
    return records.find((record: any) => record.fields?.[fieldName] === value);
  }

  async deleteRecords(table: string, recordIds: string[]) {
    // Delete functionality would need a separate airtable-delete function
    // For now, throwing an error as it's not implemented in the new architecture
    throw new Error('Delete functionality not implemented in new architecture');
  }
}

export const airtableProxy = new AirtableProxyClient();
