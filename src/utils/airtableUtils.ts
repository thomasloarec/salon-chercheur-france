
export const fetchAirtableTable = async (tableName: string) => {
  console.log(`[AirtableUtils] 🔄 Fetching table: ${tableName}`);
  
  try {
    // Essai GET d'abord
    const response = await fetch(`/functions/v1/airtable-read?table=${encodeURIComponent(tableName)}`);
    
    if (response.status === 400) {
      console.log(`[AirtableUtils] 🔄 GET failed, trying POST fallback for ${tableName}`);
      
      // Fallback POST si GET échoue
      const fallbackResponse = await fetch('/functions/v1/airtable-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName })
      });
      
      return await fallbackResponse.json();
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[AirtableUtils] ❌ Error fetching ${tableName}:`, error);
    throw error;
  }
};
