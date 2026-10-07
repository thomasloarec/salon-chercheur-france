import { primaryLabel, secondaryLabel } from '@/features/booth/salon/display';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, CloudOff, Loader2, RefreshCw } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { boothErrorMessage } from '@/lib/booth/rpc';
import { useBoothWorkspace } from '@/features/booth/useBoothWorkspace';
import { useBoothSync } from '@/features/booth/sync/useBoothSync';
import { abandon, retryRejected, type OutboxItem } from '@/features/booth/sync/engine';
import { isPersistentStorage, onStorageAvailabilityChange } from '@/features/booth/storage/db';
import type { BoothCache } from '@/features/booth/sync/cache';
import type { BoothInboundLead } from '@/lib/booth/rpc';
import NewMeetingFlow from '@/features/booth/salon/NewMeetingFlow';
import MeetingsList from '@/features/booth/salon/MeetingsList';
import MeetingDetail from '@/features/booth/salon/MeetingDetail';
import DuplicatesScreen from '@/features/booth/salon/DuplicatesScreen';
import { findDuplicates } from '@/lib/booth/rpc';
import { clearDraft, emptyDraft, loadDraft, type MeetingDraft } from '@/features/booth/salon/draft';
import { isCompleted, ownerOf } from '@/features/booth/salon/labels';
import { registerSalonSW, useOfflineReady } from '@/features/booth/offline/registerSalonSW';
import { LAST_WORKSPACE_KEY } from '@/pages/SalonStart';
import { useSalonAppMeta } from '@/features/booth/offline/useSalonAppMeta';
import InstallBanner from '@/features/booth/offline/InstallBanner';

const dayInTz = (d: Date, tz: string) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(d);
  }
};
const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const timeFmt = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function dayLabel(ws: BoothCache['workspace']) {
  if (!ws.date_debut) return null;
  const tz = ws.timezone || 'Europe/Paris';
  const today = toUtc(dayInTz(new Date(), tz));
  const start = toUtc(ws.date_debut);
  const end = toUtc(ws.date_fin || ws.date_debut);
  const DAY = 86_400_000;
  if (today < start) return `J-${Math.round((start - today) / DAY)}`;
  if (today > end) return 'Après le salon';
  return `Jour ${Math.round((today - start) / DAY) + 1}`;
}

const KIND_LABEL = { contact: 'Contact', interaction: 'Rencontre', opportunity: 'Opportunité' } as const;

function SyncPill({
  pendingCount,
  rejectedCount,
  online,
  syncing,
  lastSyncAt,
  onSync,
  onOpenRejected,
}: {
  pendingCount: number;
  rejectedCount: number;
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  onSync: () => void;
  onOpenRejected: () => void;
}) {
  const [showTime, setShowTime] = useState(false);
  let cls = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  let label = 'Synchronisé';
  if (rejectedCount > 0) {
    cls = 'bg-destructive/15 text-destructive border-destructive/30';
    label = `À reprendre (${rejectedCount})`;
  } else if (!online) {
    cls = 'bg-muted text-muted-foreground border-border';
    label = `Hors connexion · ${pendingCount} en attente`;
  } else if (pendingCount > 0) {
    cls = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    label = `${pendingCount} en attente`;
  }
  return (
    <button
      type="button"
      onClick={() => {
        onSync();
        if (rejectedCount > 0) onOpenRejected();
        else setShowTime((v) => !v);
      }}
      className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${cls}`}
      aria-live="polite"
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : !online ? (
        <CloudOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      )}
      <span>
        {label}
        {showTime && rejectedCount === 0 && pendingCount === 0 && lastSyncAt ? ` à ${timeFmt(lastSyncAt)}` : ''}
      </span>
    </button>
  );
}

export default function SalonMode() {
  const { workspaceId = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { cache, status, error } = useBoothWorkspace(workspaceId);
  const sync = useBoothSync(workspaceId, cache?.exhibitorId ?? null);
  const [screen, setScreen] = useState<'home' | 'flow' | 'list' | 'detail' | 'duplicates'>('home');
  const [dupCount, setDupCount] = useState(0);
  const [flowInitial, setFlowInitial] = useState<MeetingDraft>(emptyDraft());
  const [flowKey, setFlowKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<MeetingDraft | null>(null);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [toAbandon, setToAbandon] = useState<OutboxItem | null>(null);
  const [persistent, setPersistent] = useState(isPersistentStorage());

  useEffect(() => onStorageAvailabilityChange(() => setPersistent(isPersistentStorage())) as () => void, []);

  useSalonAppMeta();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    registerSalonSW();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const offlineReady = useOfflineReady(workspaceId, cache?.saved_at);

  useEffect(() => {
    if (!cache || !workspaceId) return;
    try {
      localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId);
    } catch {
      /* ignoré */
    }
  }, [cache, workspaceId]);

  useEffect(() => {
    if (!loading && !user && online) navigate(`/auth?redirect=${encodeURIComponent(`/salon/${workspaceId}`)}`, { replace: true });
  }, [loading, user, navigate, workspaceId, online]);

  useEffect(() => {
    if (!user || !workspaceId || screen !== 'home') return;
    void loadDraft(user.id, workspaceId).then(setSavedDraft);
  }, [user, workspaceId, screen]);

  const isManager = cache?.role === 'manager';
  const exhibitorIdForDup = cache?.exhibitorId;
  useEffect(() => {
    if (screen !== 'home' || !isManager || !exhibitorIdForDup || !sync.online) return;
    let cancelled = false;
    findDuplicates(exhibitorIdForDup)
      .then((r) => !cancelled && setDupCount(r.total ?? 0))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [screen, isManager, exhibitorIdForDup, sync.online]);

  const startFlow = (initial: MeetingDraft) => {
    setFlowInitial(initial);
    setFlowKey((k) => k + 1);
    setScreen('flow');
  };
  const startInbound = (l: BoothInboundLead) =>
    startFlow({
      ...emptyDraft(),
      name: l.name ?? '',
      company: l.company ?? '',
      coordMode: l.email ? 'email' : null,
      coordValue: l.email ?? '',
      inbound_lead_id: l.lead_id,
    });

  const hasPending = sync.pendingCount + sync.rejectedCount > 0;
  useEffect(() => {
    if (!hasPending) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [hasPending]);

  const counts = useMemo(() => {
    if (!cache || !user) return { mine: 0, team: 0 };
    const tz = cache.workspace.timezone || 'Europe/Paris';
    const today = dayInTz(new Date(), tz);
    const todays = cache.interactions.filter(
      (i) => isCompleted(i) && i.occurred_at && dayInTz(new Date(i.occurred_at), tz) === today,
    );
    return { mine: todays.filter((i) => ownerOf(i, user.id) === user.id).length, team: todays.length };
  }, [cache, user]);

  const contactName = (item: OutboxItem) => {
    const src =
      item.kind === 'contact'
        ? item.data
        : cache?.contacts.find((c) => c.id === item.data.contact_id) ?? null;
    if (!src) return null;
    const s = src as Record<string, string | null>;
    const second = secondaryLabel(s);
    return [primaryLabel(s), second].filter(Boolean).join(', ');
  };

  const ws = cache?.workspace;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <Helmet>
        <title>Mode salon · Lotexpo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button asChild variant="ghost" className="min-h-[44px] px-2">
          <Link to="/leads">
            <ArrowLeft className="mr-1 h-5 w-5" /> Mes salons
          </Link>
        </Button>
        {cache && (
          <SyncPill
            pendingCount={sync.pendingCount}
            rejectedCount={sync.rejectedCount}
            online={sync.online}
            syncing={sync.syncing}
            lastSyncAt={sync.lastSyncAt}
            onSync={sync.syncNow}
            onOpenRejected={() => setRejectedOpen(true)}
          />
        )}
      </header>

      {!persistent && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Votre navigateur ne permet pas de garder les saisies sur cet appareil. Gardez la page ouverte jusqu'à la
          synchronisation.
        </div>
      )}

      {!loading && !user && !online ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <p className="text-lg font-semibold">
            Reconnectez-vous dès que le réseau revient. Vos rencontres déjà enregistrées sur ce téléphone sont
            conservées.
          </p>
          <Button size="lg" className="min-h-[56px] w-full max-w-sm text-base" onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </div>
      ) : status === 'forbidden' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <p className="text-xl font-semibold">Vous n'avez pas accès à ce salon</p>
          <Button asChild size="lg" className="min-h-[56px] w-full max-w-sm text-base">
            <Link to="/leads">Retour à mes salons</Link>
          </Button>
        </div>
      ) : status === 'error' && !cache ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <p className="text-lg font-semibold">{boothErrorMessage(error)}</p>
          <Button size="lg" className="min-h-[56px] w-full max-w-sm text-base" onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </div>
      ) : !cache || !ws ? (
        <div className="space-y-4 p-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : screen === 'flow' && user ? (
        <NewMeetingFlow
          key={flowKey}
          cache={cache}
          me={user.id}
          online={sync.online}
          initial={flowInitial}
          onHome={() => setScreen('home')}
        />
      ) : screen === 'list' && user ? (
        <MeetingsList
          cache={cache}
          me={user.id}
          onBack={() => setScreen('home')}
          onOpen={(id) => {
            setDetailId(id);
            setScreen('detail');
          }}
          onInbound={startInbound}
        />
      ) : screen === 'duplicates' && user ? (
        <DuplicatesScreen cache={cache} me={user.id} online={sync.online} onBack={() => setScreen('home')} />
      ) : screen === 'detail' && user && detailId ? (
        <MeetingDetail cache={cache} me={user.id} interactionId={detailId} onBack={() => setScreen('list')} />
      ) : (
        <main className="flex flex-1 flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {status === 'stale' && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              Données du {timeFmt(cache.saved_at)}
            </p>
          )}
          {cache.contacts_truncated && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              Les {cache.contacts_total} contacts ne sont pas tous chargés sur cet appareil. La recherche reste
              complète en ligne.
            </p>
          )}
          {ws.archived && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Ce salon est archivé : consultation seule
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold leading-tight">
              {ws.nom_event}
              {dayLabel(ws) ? ` · ${dayLabel(ws)}` : ''}
            </h1>
            {offlineReady && (
              <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Disponible sans réseau</p>
            )}
            {ws.stand_label && <p className="mt-1 text-base text-muted-foreground">Stand {ws.stand_label}</p>}
          </div>

          <InstallBanner pendingCount={sync.pendingCount + sync.rejectedCount} />

          <div className={`grid gap-3 ${cache.role === 'manager' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-3xl font-bold">{counts.mine}</p>
              <p className="text-sm text-muted-foreground">Vos rencontres aujourd'hui</p>
            </div>
            {cache.role === 'manager' && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-3xl font-bold">{counts.team}</p>
                <p className="text-sm text-muted-foreground">Équipe aujourd'hui</p>
              </div>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            {!ws.archived && savedDraft && (
              <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
                <Button size="lg" variant="secondary" className="min-h-[56px] w-full text-base" onClick={() => startFlow(savedDraft)}>
                  Reprendre la rencontre en cours{savedDraft.name ? ` (${savedDraft.name})` : ''}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (user) void clearDraft(user.id, workspaceId);
                    setSavedDraft(null);
                  }}
                >
                  Effacer ce brouillon
                </Button>
              </div>
            )}
            {!ws.archived && (
              <Button size="lg" className="min-h-[64px] w-full text-lg font-semibold" onClick={() => startFlow(emptyDraft())}>
                Nouvelle rencontre
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="min-h-[56px] w-full text-base"
              onClick={() => setScreen('list')}
            >
              Rencontres du salon
            </Button>
            {cache.role === 'manager' && dupCount > 0 && (
              <Button variant="link" className="min-h-[44px]" onClick={() => setScreen('duplicates')}>
                Doublons ({dupCount})
              </Button>
            )}
          </div>
        </main>
      )}

      <Sheet open={rejectedOpen} onOpenChange={setRejectedOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>À reprendre</SheetTitle>
            <SheetDescription>Ces saisies ont été refusées par le serveur.</SheetDescription>
          </SheetHeader>
          <ul className="mt-4 space-y-3">
            {sync.rejectedItems.length === 0 && <li className="text-sm text-muted-foreground">Rien à reprendre.</li>}
            {sync.rejectedItems.map((item) => (
              <li key={item.key} className="space-y-2 rounded-lg border border-border p-3">
                <p className="font-medium">
                  {KIND_LABEL[item.kind]}
                  {contactName(item) ? ` · ${contactName(item)}` : ''}
                </p>
                <p className="text-sm text-destructive">{boothErrorMessage(item.error)}</p>
                <div className="flex gap-2">
                  <Button className="min-h-[48px] flex-1" onClick={() => void retryRejected(item)}>
                    Réessayer
                  </Button>
                  <Button variant="outline" className="min-h-[48px] flex-1" onClick={() => setToAbandon(item)}>
                    Abandonner
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toAbandon} onOpenChange={(o) => !o && setToAbandon(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cette saisie ne sera pas envoyée.</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toAbandon) void abandon(toAbandon);
                setToAbandon(null);
              }}
            >
              Abandonner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
