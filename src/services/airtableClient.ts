
interface AirtableRecord {
  id?: string;
  fields: Record<string, any>;
  createdTime?: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface AirtableError {
  type: string;
  message: string;
}

export interface AirtableConfig {
  baseId: string;
  pat: string;
  eventsTableName: string;
  exhibitorsTableName: string;
  participationTableName: string;
}

export class AirtableClient {
  private config: AirtableConfig;
  private baseUrl: string;
  private rateLimitDelay = 200; // 5 requests per second = 200ms delay

  constructor(config: AirtableConfig) {
    this.config = config;
    this.baseUrl = `https://api.airtable.com/v0/${config.baseId}`;
  }

  private async throttle(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  private async makeRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    await this.throttle();
    
    const url = `${this.baseUrl}/${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.pat}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    console.log(`🔗 Airtable request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Airtable API error (${response.status}): ${error.message}`);
    }

    return response;
  }

  async listRecords(
    tableName: string, 
    options: {
      maxRecords?: number;
      offset?: string;
      filterByFormula?: string;
      sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    } = {}
  ): Promise<{ records: AirtableRecord[]; offset?: string }> {
    const params = new URLSearchParams();
    
    if (options.maxRecords) params.set('maxRecords', options.maxRecords.toString());
    if (options.offset) params.set('offset', options.offset);
    if (options.filterByFormula) params.set('filterByFormula', options.filterByFormula);
    if (options.sort) {
      options.sort.forEach((sort, index) => {
        params.set(`sort[${index}][field]`, sort.field);
        params.set(`sort[${index}][direction]`, sort.direction);
      });
    }

    const queryString = params.toString();
    const endpoint = `${tableName}${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.makeRequest(endpoint);
    const data: AirtableResponse = await response.json();
    
    console.log(`📋 Retrieved ${data.records.length} records from ${tableName}`);
    return {
      records: data.records,
      offset: data.offset
    };
  }

  async listAllRecords(
    tableName: string,
    options: {
      filterByFormula?: string;
      sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    } = {}
  ): Promise<AirtableRecord[]> {
    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const result = await this.listRecords(tableName, {
        ...options,
        maxRecords: 100,
        offset
      });
      
      allRecords.push(...result.records);
      offset = result.offset;
      
      console.log(`📊 Total records collected: ${allRecords.length}`);
    } while (offset);

    return allRecords;
  }

  async createRecords(
    tableName: string, 
    records: Array<Record<string, any>>,
    batchSize: number = 10
  ): Promise<AirtableRecord[]> {
    const createdRecords: AirtableRecord[] = [];
    
    // Process in batches to respect Airtable limits
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const payload = {
        records: batch.map(fields => ({ fields }))
      };

      console.log(`📤 Creating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} records)`);
      
      const response = await this.makeRequest(tableName, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data: AirtableResponse = await response.json();
      createdRecords.push(...data.records);
    }

    console.log(`✅ Created ${createdRecords.length} records in ${tableName}`);
    return createdRecords;
  }

  async updateRecords(
    tableName: string,
    records: Array<{ id: string; fields: Record<string, any> }>,
    batchSize: number = 10
  ): Promise<AirtableRecord[]> {
    const updatedRecords: AirtableRecord[] = [];
    
    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const payload = {
        records: batch.map(record => ({
          id: record.id,
          fields: record.fields
        }))
      };

      console.log(`🔄 Updating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} records)`);
      
      const response = await this.makeRequest(tableName, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      const data: AirtableResponse = await response.json();
      updatedRecords.push(...data.records);
    }

    console.log(`✅ Updated ${updatedRecords.length} records in ${tableName}`);
    return updatedRecords;
  }

  async deleteRecords(
    tableName: string,
    recordIds: string[],
    batchSize: number = 10
  ): Promise<{ deleted: boolean; id: string }[]> {
    const deletedRecords: { deleted: boolean; id: string }[] = [];
    
    // Process in batches
    for (let i = 0; i < recordIds.length; i += batchSize) {
      const batch = recordIds.slice(i, i + batchSize);
      const params = new URLSearchParams();
      batch.forEach(id => params.append('records[]', id));

      console.log(`🗑️ Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(recordIds.length / batchSize)} (${batch.length} records)`);
      
      const response = await this.makeRequest(`${tableName}?${params.toString()}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      deletedRecords.push(...data.records);
    }

    console.log(`✅ Deleted ${deletedRecords.length} records from ${tableName}`);
    return deletedRecords;
  }

  // Helper method to find record by unique field
  async findRecordByUniqueField(
    tableName: string,
    fieldName: string,
    value: string
  ): Promise<AirtableRecord | null> {
    const filterFormula = `{${fieldName}} = "${value}"`;
    const result = await this.listRecords(tableName, {
      filterByFormula: filterFormula,
      maxRecords: 1
    });

    return result.records.length > 0 ? result.records[0] : null;
  }

  // Upsert method - update if exists, create if not
  async upsertRecords(
    tableName: string,
    records: Array<Record<string, any>>,
    uniqueFieldName: string
  ): Promise<{ created: AirtableRecord[]; updated: AirtableRecord[] }> {
    const toCreate: Array<Record<string, any>> = [];
    const toUpdate: Array<{ id: string; fields: Record<string, any> }> = [];

    // Check each record to see if it exists
    for (const record of records) {
      const uniqueValue = record[uniqueFieldName];
      if (!uniqueValue) {
        console.warn(`⚠️ Record missing unique field ${uniqueFieldName}, skipping`);
        continue;
      }

      const existingRecord = await this.findRecordByUniqueField(
        tableName,
        uniqueFieldName,
        uniqueValue
      );

      if (existingRecord) {
        toUpdate.push({
          id: existingRecord.id!,
          fields: record
        });
      } else {
        toCreate.push(record);
      }
    }

    console.log(`📊 Upsert summary for ${tableName}: ${toCreate.length} to create, ${toUpdate.length} to update`);

    const [created, updated] = await Promise.all([
      toCreate.length > 0 ? this.createRecords(tableName, toCreate) : [],
      toUpdate.length > 0 ? this.updateRecords(tableName, toUpdate) : []
    ]);

    return { created, updated };
  }
}

// Factory function to create configured client
export function createAirtableClient(): AirtableClient {
  const config: AirtableConfig = {
    baseId: 'SLxgKrY3BSA1nX',
    pat: process.env.AIRTABLE_PAT || '',
    eventsTableName: 'All_Events',
    exhibitorsTableName: 'All_Exposants',
    participationTableName: 'Participation'
  };

  if (!config.pat) {
    throw new Error('AIRTABLE_PAT environment variable is required');
  }

  return new AirtableClient(config);
}
