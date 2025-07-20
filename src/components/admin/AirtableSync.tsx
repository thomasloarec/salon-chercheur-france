
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Database } from 'lucide-react';
import { useSecretsCheck } from '@/hooks/useSecretsCheck';
import MissingSecretsAlert from '@/components/admin/MissingSecretsAlert';
import AirtableSyncButtons from '@/components/admin/AirtableSyncButtons';
import { fetchAirtableTable } from '@/utils/airtableUtils';

const AirtableSync = () => {
  const { toast } = useToast();
  const { checkSecrets, isChecking, result } = useSecretsCheck();
  const [isLoading, setIsLoading] = useState(false);
  const [eventsData, setEventsData] = useState<any[]>([]);
  const [exposantsData, setExposantsData] = useState<any[]>([]);
  const [participationData, setParticipationData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check secrets on component mount
  useEffect(() => {
    checkSecrets();
    loadAirtableData();
  }, [checkSecrets]);

  const loadAirtableData = async () => {
    if (dataLoading) return;
    
    setDataLoading(true);
    setError(null);
    
    try {
      console.log('[AirtableSync] 🔄 Chargement des données...');
      
      // Load Events
      try {
        const eventsResponse = await fetchAirtableTable('All_Events');
        if (eventsResponse?.success) {
          setEventsData(eventsResponse.records || []);
          console.log('[AirtableSync] ✅ Events chargés:', eventsResponse.records?.length || 0);
        } else {
          console.error('[AirtableSync] ❌ Events - pas de succès:', eventsResponse);
        }
      } catch (eventsError) {
        console.error('[AirtableSync] ❌ Erreur Events:', eventsError);
      }

      // Load Exposants
      try {
        const exposantsResponse = await fetchAirtableTable('All_Exposants');
        if (exposantsResponse?.success) {
          setExposantsData(exposantsResponse.records || []);
          console.log('[AirtableSync] ✅ Exposants chargés:', exposantsResponse.records?.length || 0);
        } else {
          console.error('[AirtableSync] ❌ Exposants - pas de succès:', exposantsResponse);
        }
      } catch (exposantsError) {
        console.error('[AirtableSync] ❌ Erreur Exposants:', exposantsError);
      }

      // Load Participation
      try {
        const participationResponse = await fetchAirtableTable('Participation');
        if (participationResponse?.success) {
          setParticipationData(participationResponse.records || []);
          console.log('[AirtableSync] ✅ Participation chargée:', participationResponse.records?.length || 0);
        } else {
          console.error('[AirtableSync] ❌ Participation - pas de succès:', participationResponse);
        }
      } catch (participationError) {
        console.error('[AirtableSync] ❌ Erreur Participation:', participationError);
      }

    } catch (error) {
      console.error('[AirtableSync] ❌ Erreur chargement données:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setError(errorMessage);
      toast({
        title: 'Erreur de chargement',
        description: `Impossible de charger les données Airtable: ${errorMessage}`,
        variant: 'destructive'
      });
    } finally {
      setDataLoading(false);
    }
  };

  const handleSecretsConfigured = async () => {
    await checkSecrets();
    await loadAirtableData();
  };

  const handleSync = async (type: 'events' | 'exposants' | 'participation') => {
    console.log(`[AirtableSync] Synchronisation ${type} terminée`);
    // Optionally reload data after sync
    await loadAirtableData();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Synchronisation Airtable
          </CardTitle>
          <CardDescription>
            Synchronisez les données entre votre base Supabase et Airtable. 
            Utilise les nouvelles fonctions airtable-read et airtable-write avec mapping automatique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Show missing secrets alert if needed */}
          {result && !result.ok && result.missing && (
            <div className="mb-6">
              <MissingSecretsAlert
                missing={result.missing}
                onMarkAsDone={handleSecretsConfigured}
                isRefreshing={isChecking}
              />
            </div>
          )}

          {/* Connection Status */}
          {result?.ok && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Base Airtable connectée</span>
                <Badge variant="outline">Nouvelle pile read/write</Badge>
              </div>
              <p className="text-xs text-gray-500">
                Tables: All_Events, All_Exposants, Participation avec mapping automatique
              </p>
            </div>
          )}

          {/* Data Loading Status */}
          {dataLoading && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">Chargement des données Airtable...</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">Erreur de connexion :</h4>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Data Summary */}
          {!dataLoading && !error && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h4 className="text-sm font-medium text-green-800 mb-2">Données chargées :</h4>
              <div className="space-y-1 text-sm text-green-600">
                <p>• Events: {eventsData.length} enregistrements</p>
                <p>• Exposants: {exposantsData.length} enregistrements</p>
                <p>• Participation: {participationData.length} enregistrements</p>
              </div>
            </div>
          )}

          {/* Sync Buttons */}
          {result?.ok && !dataLoading && (
            <AirtableSyncButtons
              eventsData={eventsData}
              exposantsData={exposantsData}
              participationData={participationData}
              isLoading={isLoading}
              onSync={handleSync}
            />
          )}

          <Separator className="my-6" />

          {/* Migration Status */}
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="text-sm font-medium text-green-800 mb-2">Migration terminée ✅</h4>
            <ul className="text-sm text-green-600 space-y-1">
              <li>• Utilisation des nouvelles fonctions airtable-read/write</li>
              <li>• Mapping automatique des champs</li>
              <li>• Gestion des doublons intégrée</li>
              <li>• Logs détaillés pour le debugging</li>
              <li>• Support GET/POST pour airtable-read</li>
              <li>• CORS corrigé pour schema-discovery</li>
              <li>• Réponses JSON garanties même en erreur</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AirtableSync;
