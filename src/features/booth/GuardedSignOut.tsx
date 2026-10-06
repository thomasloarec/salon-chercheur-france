import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { getPendingCountForUser } from './sync/pendingGuard';
import { syncAllForUser } from './sync/engine';

/** Protège la déconnexion tant que des saisies Lotexpo Leads ne sont pas envoyées. */
export function useGuardedSignOut(userId: string | null | undefined, doSignOut: () => unknown) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const request = useCallback(async () => {
    if (!userId) return void doSignOut();
    const n = await getPendingCountForUser(userId);
    if (n > 0) {
      setCount(n);
      setOpen(true);
    } else {
      await doSignOut();
    }
  }, [userId, doSignOut]);

  const sendNow = async () => {
    if (!userId) return;
    setSending(true);
    try {
      await syncAllForUser(userId);
      const n = await getPendingCountForUser(userId);
      setCount(n);
      if (n === 0) setOpen(false);
    } finally {
      setSending(false);
    }
  };

  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Saisies non envoyées</AlertDialogTitle>
          <AlertDialogDescription>
            {count} saisie{count > 1 ? 's' : ''} Lotexpo Leads {count > 1 ? 'ne sont' : "n'est"} pas encore
            envoyée{count > 1 ? 's' : ''}. Si vous vous déconnectez maintenant, elle{count > 1 ? 's' : ''} sera
            {count > 1 ? 'ont' : ''} perdue{count > 1 ? 's' : ''}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button autoFocus onClick={() => setOpen(false)}>
            Rester connecté
          </Button>
          <Button variant="outline" onClick={sendNow} disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer maintenant
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setOpen(false);
              await doSignOut();
            }}
          >
            Me déconnecter quand même
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { request, dialog };
}
