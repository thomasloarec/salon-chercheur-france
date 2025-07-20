
import { useState } from 'react';
import { airtableProxy } from '@/services/airtableProxy';

export interface AirtableEvent {
  id_event?: string;
  nom_event: string;
  type_event: string;
  date_debut: string;
  date_fin: string;
  secteur: string[];
  url_image?: string;
  url_site_officiel?: string;
  description_event?: string;
  affluence?: number;
  tarif?: string;
  nom_lieu?: string;
  rue?: string;
  code_postal?: string;
  ville: string;
  pays?: string;
}

export interface AirtableExposant {
  id_exposant?: string;
  nom_exposant: string;
  website_exposant?: string;
  exposant_description?: string;
}

export interface AirtableParticipation {
  id_participation?: string;
  id_event?: string;
  nom_exposant: string;
  stand_exposant?: string;
  website_exposant?: string;
  urlexpo_event?: string;
}

export interface AirtableWriteResponse {
  success: boolean;
  duplicate?: boolean;
  records?: any[];
  message?: string;
  error?: string;
  recordsCreated?: number;
  recordsUpdated?: number;
}

export const useAirtableWrite = () => {
  const [isLoading, setIsLoading] = useState(false);

  const writeEvents = async (events: AirtableEvent[]): Promise<AirtableWriteResponse> => {
    setIsLoading(true);
    try {
      const result = await airtableProxy.upsertRecords('All_Events', events, 'id_event');
      return {
        success: result.success,
        duplicate: result.duplicate,
        records: result.records,
        message: result.message,
        recordsCreated: result.records?.length || 0,
        recordsUpdated: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recordsCreated: 0,
        recordsUpdated: 0
      };
    } finally {
      setIsLoading(false);
    }
  };

  const writeExposants = async (exposants: AirtableExposant[]): Promise<AirtableWriteResponse> => {
    setIsLoading(true);
    try {
      const result = await airtableProxy.upsertRecords('All_Exposants', exposants, 'id_exposant');
      return {
        success: result.success,
        duplicate: result.duplicate,
        records: result.records,
        message: result.message,
        recordsCreated: result.records?.length || 0,
        recordsUpdated: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recordsCreated: 0,
        recordsUpdated: 0
      };
    } finally {
      setIsLoading(false);
    }
  };

  const writeParticipation = async (participation: AirtableParticipation[]): Promise<AirtableWriteResponse> => {
    setIsLoading(true);
    try {
      const result = await airtableProxy.upsertRecords('Participation', participation, 'id_participation');
      return {
        success: result.success,
        duplicate: result.duplicate,
        records: result.records,
        message: result.message,
        recordsCreated: result.records?.length || 0,
        recordsUpdated: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recordsCreated: 0,
        recordsUpdated: 0
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    writeEvents,
    writeExposants,
    writeParticipation,
    isLoading
  };
};

export const useAirtableRead = () => {
  const [isLoading, setIsLoading] = useState(false);

  const readTable = async (tableName: string) => {
    setIsLoading(true);
    try {
      const records = await airtableProxy.listAllRecords(tableName);
      return { success: true, records };
    } catch (error) {
      console.error(`Error reading ${tableName}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        records: []
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    readTable,
    isLoading
  };
};
