
export const fetchAirtableTable = async (tableName: string) => {
  console.log(`[AirtableUtils] 🔄 Fetching table: ${tableName}`);
  
  try {
    const url = `/functions/v1/airtable-read?table=${encodeURIComponent(tableName)}`;
    const response = await fetch(url);
    
    // Vérifier le Content-Type avant de parser le JSON
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} non-JSON response.\n${text.slice(0, 200)}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur inconnue');
    }
    
    console.log(`[AirtableUtils] ✅ Success fetching ${tableName}: ${data.records?.length || 0} records`);
    return data;
    
  } catch (error) {
    console.error(`[AirtableUtils] ❌ Error fetching ${tableName}:`, error);
    throw error;
  }
};
