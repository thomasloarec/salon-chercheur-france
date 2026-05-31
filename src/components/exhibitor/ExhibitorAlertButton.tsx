import { useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { useExhibitorAlert } from '@/hooks/useExhibitorAlert';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';

const LABEL_INACTIVE = 'Me prévenir de ses prochains salons';
const LABEL_ACTIVE = 'Alerte activée';
const LABEL_ACTIVE_HOVER = 'Désactiver l’alerte';
const LABEL_UPDATING = 'Mise à jour...';

/**
 * Hero CTA letting a signed-in user subscribe to / unsubscribe from upcoming
 * shows for a public exhibitor identity. Anonymous visitors see the button but
 * a click opens AuthRequiredModal (no status/mutation RPC is fired).
 * Pure UI + RPC: no email, cron, or notification engine here.
 */
export default function ExhibitorAlertButton({
  publicSlug,
}: {
  publicSlug: string;
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const { isAuthenticated, isAlertEnabled, isLoading, isUpdating, toggleAlert } =
    useExhibitorAlert(publicSlug);

  const handleClick = async () => {
    // Anonymous: never hit Supabase, just prompt for auth.
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    if (isUpdating) return;

    const nextEnabled = !isAlertEnabled;
    try {
      await toggleAlert(nextEnabled);
      if (nextEnabled) {
        trackExhibitorEvent('alert_activate', publicSlug);
        toast.success(
          'Alerte activée. Vous serez prévenu des prochains salons de cet exposant.'
        );
      } else {
        trackExhibitorEvent('alert_deactivate', publicSlug);
        toast.success('Alerte désactivée.');
      }
    } catch (err) {
      toast.error("Impossible de mettre à jour l'alerte. Veuillez réessayer.");
    }
  };

  // Authenticated + first fetch: render a stable, disabled "inactive" button so
  // we never flash "Alerte activée" before the status is confirmed.
  const showActive = isAuthenticated && isAlertEnabled && !isLoading;
  const disabled = isUpdating || (isAuthenticated && isLoading);

  return (
    <>
      <Button
        type="button"
        variant={showActive ? 'secondary' : 'outline'}
        className="group gap-2"
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={showActive}
        aria-label={
          showActive ? "Désactiver l'alerte" : 'Me prévenir des prochains salons'
        }
      >
        {isUpdating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {LABEL_UPDATING}
          </>
        ) : showActive ? (
          <>
            <BellRing className="h-4 w-4" />
            {/* Desktop hover swaps the label to make "click = disable" obvious */}
            <span className="sm:group-hover:hidden">{LABEL_ACTIVE}</span>
            <span className="hidden sm:group-hover:inline">
              {LABEL_ACTIVE_HOVER}
            </span>
          </>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            {LABEL_INACTIVE}
          </>
        )}
      </Button>

      <AuthRequiredModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        actionType="alert"
        redirectTo={
          typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : undefined
        }
      />
    </>
  );
}