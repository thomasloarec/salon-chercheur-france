import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AdminEventByText() {
  const { id_event_text } = useParams<{ id_event_text: string }>();

  useEffect(() => {
    const resolveEventId = async () => {
      if (!id_event_text) {
        window.location.href = '/admin';
        return;
      }

      try {
        const { data, error } = await supabase
          .from('events')
          .select('id')
          .eq('id_event', id_event_text)
          .single();

        if (error || !data) {
          console.error('Événement non trouvé:', id_event_text);
          window.location.href = '/admin';
          return;
        }

        // Rediriger vers la page d'édition avec l'UUID
        window.location.href = `/admin/events/${data.id}`;
      } catch (error) {
        console.error('Erreur lors de la résolution de l\'événement:', error);
        window.location.href = '/admin';
      }
    };

    resolveEventId();
  }, [id_event_text]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-gray-600">Redirection en cours...</p>
      </div>
    </div>
  );
}