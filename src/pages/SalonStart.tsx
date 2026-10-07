import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { registerSalonSW } from '@/features/booth/offline/registerSalonSW';

export const LAST_WORKSPACE_KEY = 'lotexpo-leads:last-workspace';

export default function SalonStart() {
  const navigate = useNavigate();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    registerSalonSW();
    let id: string | null = null;
    try {
      id = localStorage.getItem(LAST_WORKSPACE_KEY);
    } catch {
      id = null;
    }
    if (id) navigate(`/salon/${id}`, { replace: true });
    else if (navigator.onLine) navigate('/leads', { replace: true });
    else setOffline(true);
  }, [navigate]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
      <Helmet>
        <title>Mode salon · Lotexpo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      {offline && (
        <>
          <p className="text-lg font-semibold">
            Ouvrez une première fois votre salon avec du réseau pour l'utiliser ensuite sans réseau.
          </p>
          <Button size="lg" className="min-h-[56px] w-full max-w-sm text-base" onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </>
      )}
    </div>
  );
}
