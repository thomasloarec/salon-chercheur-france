
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { airtableProxy } from '@/services/airtableProxy';
import { useToast } from '@/hooks/use-toast';

interface AirtableEvent {
  id_event: string;
  nom_event: string;
  type_event: string;
  date_debut: string;
  date_fin: string;
  secteur: string;
  url_image?: string;
  url_site_officiel?: string;
  description_event?: string;
  affluence?: number;
  tarif?: string;
  nom_lieu?: string;
  rue?: string;
  code_postal?: string;
  ville?: string;
  pays?: string; // Ajout du champ pays
}

interface AirtableExposant {
  id_exposant?: string;
  nom_exposant: string; // Champ principal
  website_exposant: string;
  exposant_description?: string;
}

interface AirtableParticipation {
  id_participation?: string;
  id_event: string;
  nom_exposant?: string; // Ajout de ce champ
  stand_exposant?: string; // Ajout de ce champ
  website_exposant?: string; // Ajout de ce champ
  urlexpo_event: string;
}

export function useAirtableEvents() {
  return useQuery({
    queryKey: ['airtable', 'events'],
    queryFn: async () => {
      const records = await airtableProxy.listAllRecords('All_Events');
      return records.map((record: any) => ({
        airtableId: record.id,
        ...record.fields
      })) as Array<AirtableEvent & { airtableId: string }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAirtableExposants() {
  return useQuery({
    queryKey: ['airtable', 'exposants'],
    queryFn: async () => {
      const records = await airtableProxy.listAllRecords('All_Exposants');
      return records.map((record: any) => ({
        airtableId: record.id,
        ...record.fields
      })) as Array<AirtableExposant & { airtableId: string }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAirtableParticipation() {
  return useQuery({
    queryKey: ['airtable', 'participation'],
    queryFn: async () => {
      const records = await airtableProxy.listAllRecords('Participation');
      return records.map((record: any) => ({
        airtableId: record.id,
        ...record.fields
      })) as Array<AirtableParticipation & { airtableId: string }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAirtableSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const syncEvents = useMutation({
    mutationFn: async (events: AirtableEvent[]) => {
      return await airtableProxy.upsertRecords('All_Events', events, 'id_event');
    },
    onSuccess: (result) => {
      const total = result.created?.length || 0 + result.updated?.length || 0;
      toast({
        title: 'Synchronisation réussie',
        description: `${total} événements synchronisés avec Airtable`,
      });
      queryClient.invalidateQueries({ queryKey: ['airtable', 'events'] });
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  });

  const syncExposants = useMutation({
    mutationFn: async (exposants: AirtableExposant[]) => {
      return await airtableProxy.upsertRecords('All_Exposants', exposants, 'website_exposant');
    },
    onSuccess: (result) => {
      const total = result.created?.length || 0 + result.updated?.length || 0;
      toast({
        title: 'Synchronisation réussie',
        description: `${total} exposants synchronisés avec Airtable`,
      });
      queryClient.invalidateQueries({ queryKey: ['airtable', 'exposants'] });
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  });

  const syncParticipation = useMutation({
    mutationFn: async (participations: AirtableParticipation[]) => {
      return await airtableProxy.upsertRecords('Participation', participations, 'urlexpo_event');
    },
    onSuccess: (result) => {
      const total = result.created?.length || 0 + result.updated?.length || 0;
      toast({
        title: 'Synchronisation réussie',
        description: `${total} participations synchronisées avec Airtable`,
      });
      queryClient.invalidateQueries({ queryKey: ['airtable', 'participation'] });
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive'
      });
    }
  });

  return {
    syncEvents,
    syncExposants,
    syncParticipation,
    isLoading: syncEvents.isPending || syncExposants.isPending || syncParticipation.isPending
  };
}
