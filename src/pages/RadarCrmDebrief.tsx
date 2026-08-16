import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Calendar } from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import EventDebriefPanel, { type DebriefEvent, fmtDate } from '@/components/radar-crm/EventDebriefPanel';

/**
 * Enveloppe de la page débrief (lien d'email /radar-crm/debrief/:eventId).
 * Toute la logique vit désormais dans EventDebriefPanel, réutilisé par « Salons passés ».
 */
const RadarCrmDebrief: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [ev, setEv] = useState<DebriefEvent | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/radar-crm/debrief/${eventId ?? ''}`)}`);
    }
  }, [user, authLoading, navigate, eventId]);

  const checkAccess = useCallback(async () => {
    if (!user) return;
    const { data: view, error: viewErr } = await supabase.rpc('get_my_radar_view', { p_import_id: null });
    if (viewErr) {
      console.error('[RadarCRM] get_my_radar_view failed:', viewErr);
    } else {
      const v = view as unknown as { has_access?: boolean; status?: string } | null;
      const locked = v?.status === 'trial_expired' || v?.status === 'free' || v?.has_access === false;
      if (locked) {
        navigate('/radar-crm/results', { replace: true });
        return;
      }
    }
    setAccessChecked(true);
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    void trackRadarEvent('radar_debrief_viewed', { eventId });
    void checkAccess();
  }, [user, checkAccess, eventId]);

  const eventName = ev?.nom_event ?? 'Salon';
  const d1 = fmtDate(ev?.date_debut);
  const d2 = fmtDate(ev?.date_fin);
  const dateLabel = d1 && d2 && d1 !== d2 ? `${d1} – ${d2}` : (d1 ?? '');

  return (
    <div className="min-h-screen bg-muted/10 font-body">
      <Helmet>
        <title>Débrief — {eventName} | Lotexpo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Retour"
            onClick={() => navigate(eventId ? `/radar-crm/terrain/${eventId}` : '/radar-crm/results')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-foreground leading-tight truncate">
              {`Débrief · ${eventName}`}
            </p>
            {dateLabel && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Calendar className="h-3 w-3 shrink-0" /> {dateLabel}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <div className="mb-5">
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
            {eventName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {ev?.ville && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {ev.ville}</span>
            )}
            {dateLabel && (
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {dateLabel}</span>
            )}
          </p>
        </div>

        {accessChecked && eventId && (
          <EventDebriefPanel eventId={eventId} onLoadedEvent={setEv} />
        )}
      </main>
    </div>
  );
};

export default RadarCrmDebrief;
