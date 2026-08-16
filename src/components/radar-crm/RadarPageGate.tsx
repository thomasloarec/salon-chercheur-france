import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';
import { RadarEmptyState, RadarAccessBlocked, RadarErrorState, LockedView } from './RadarStates';

/**
 * États globaux communs aux quatre pages du Radar CRM.
 * Rend ses enfants uniquement quand tout va bien ; sinon l'écran approprié.
 * Conditions reprises à l'identique de l'ancien RadarCrmResults.
 */
const RadarPageGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const {
    imports, seatBlockKind, loading, error, radarView, futureGroups,
    setActiveImportId, setAccessOpen,
  } = useRadarWorkspace();

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent('/radar-crm/results')}`);
    }
  }, [user, authLoading, navigate]);

  const status = radarView?.status ?? 'none';
  const isLocked = status === 'trial_expired' || status === 'free';

  // Empty state
  if (!authLoading && imports !== null && imports.length === 0) {
    return <RadarEmptyState />;
  }

  // Blocage propre par siège — priorité sur les données CRM (jamais affichées ici).
  if (!authLoading && seatBlockKind) {
    return <RadarAccessBlocked kind={seatBlockKind} />;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return <RadarErrorState onRetry={() => setActiveImportId((id) => id)} />;
  }

  if (isLocked) {
    return (
      <LockedView
        teaserGroups={futureGroups}
        summary={radarView?.summary}
        onRequestAccess={() => setAccessOpen(true)}
      />
    );
  }

  return <>{children}</>;
};

export default RadarPageGate;
