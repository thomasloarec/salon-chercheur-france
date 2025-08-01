import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types/event';

interface EventExhibitorsDebugProps {
  event: Event;
}

export const EventExhibitorsDebug = ({ event }: EventExhibitorsDebugProps) => {
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const debug = async () => {
      console.log('🐛 EventExhibitorsDebug - event:', event);
      
      // Test requête avec l'UUID event.id
      const { data: participationByUUID, error: errorUUID } = await supabase
        .from('participation')
        .select('id_participation, id_event, stand_exposant')
        .eq('id_event', event.id)
        .limit(3);

      // Test requête avec l'id_event legacy si présent
      let participationByLegacy = null;
      let errorLegacy = null;
      if (event.id_event) {
        const { data, error } = await supabase
          .from('participation')
          .select('id_participation, id_event, stand_exposant')
          .eq('id_event', event.id_event)
          .limit(3);
        participationByLegacy = data;
        errorLegacy = error;
      }

      setDebugInfo({
        eventData: {
          id: event.id,
          id_event: event.id_event,
          nom_event: event.nom_event
        },
        participationByUUID: {
          data: participationByUUID,
          error: errorUUID,
          count: participationByUUID?.length || 0
        },
        participationByLegacy: {
          data: participationByLegacy,
          error: errorLegacy,
          count: participationByLegacy?.length || 0
        }
      });

      console.log('🐛 Debug results:', {
        participationByUUID,
        participationByLegacy,
        errorUUID,
        errorLegacy
      });
    };

    debug();
  }, [event.id, event.id_event]);

  if (!debugInfo) {
    return <div className="bg-yellow-100 p-4 rounded border">🐛 Debugging...</div>;
  }

  return (
    <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 text-sm">
      <h4 className="font-semibold text-yellow-800 mb-2">🐛 Debug Exposants</h4>
      
      <div className="space-y-2">
        <div>
          <strong>Event ID (UUID):</strong> {debugInfo.eventData.id}
        </div>
        <div>
          <strong>Event ID (Legacy):</strong> {debugInfo.eventData.id_event || 'N/A'}
        </div>
        <div>
          <strong>Participation par UUID:</strong> {debugInfo.participationByUUID.count} résultats
          {debugInfo.participationByUUID.error && (
            <span className="text-red-600 ml-2">Erreur: {debugInfo.participationByUUID.error.message}</span>
          )}
        </div>
        <div>
          <strong>Participation par Legacy:</strong> {debugInfo.participationByLegacy.count} résultats
          {debugInfo.participationByLegacy.error && (
            <span className="text-red-600 ml-2">Erreur: {debugInfo.participationByLegacy.error.message}</span>
          )}
        </div>
      </div>

      {debugInfo.participationByUUID.data && debugInfo.participationByUUID.data.length > 0 && (
        <div className="mt-3">
          <strong>Premier résultat UUID:</strong>
          <pre className="text-xs bg-white p-2 mt-1 rounded">
            {JSON.stringify(debugInfo.participationByUUID.data[0], null, 2)}
          </pre>
        </div>
      )}

      {debugInfo.participationByLegacy.data && debugInfo.participationByLegacy.data.length > 0 && (
        <div className="mt-3">
          <strong>Premier résultat Legacy:</strong>
          <pre className="text-xs bg-white p-2 mt-1 rounded">
            {JSON.stringify(debugInfo.participationByLegacy.data[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};