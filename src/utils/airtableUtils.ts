
import { supabase } from '@/integrations/supabase/client';

export const fetchAirtableTable = async (tableName: string) => {
  console.log(`[AirtableUtils] 🔄 Fetching table: ${tableName}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('airtable-read', {
      body: { table: tableName }
    });
    
    if (error) {
      console.error(`[AirtableUtils] ❌ Supabase function error:`, error);
      throw new Error(`Erreur lors de la lecture de la table ${tableName}: ${error.message}`);
    }
    
    if (!data?.success) {
      throw new Error(data?.message || 'Réponse invalide de la fonction');
    }
    
    console.log(`[AirtableUtils] ✅ Success fetching ${tableName}: ${data.records?.length || 0} records`);
    return data;
    
  } catch (error) {
    console.error(`[AirtableUtils] ❌ Error fetching ${tableName}:`, error);
    throw error;
  }
};

export const fetchAirtableSchemas = async () => {
  console.log(`[AirtableUtils] 🔄 Fetching schemas`);
  
  try {
    const { data, error } = await supabase.functions.invoke('airtable-schema-discovery', {
      headers: {
        'X-Lovable-Admin': 'true'
      }
    });
    
    if (error) {
      console.error(`[AirtableUtils] ❌ Schema discovery error:`, error);
      throw new Error(`Erreur lors du scan des schémas: ${error.message}`);
    }
    
    if (!data?.success) {
      throw new Error(data?.message || 'Échec du scan des schémas');
    }
    
    console.log(`[AirtableUtils] ✅ Success fetching schemas`);
    return data;
    
  } catch (error) {
    console.error(`[AirtableUtils] ❌ Error fetching schemas:`, error);
    throw error;
  }
};
