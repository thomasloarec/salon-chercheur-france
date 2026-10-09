import { primaryLabel, secondaryLabel } from '@/features/booth/salon/display';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import NewMeetingFlow, { CAMERA_PENDING_KEY } from '@/features/booth/salon/NewMeetingFlow';
import { useVoiceItems, useVoiceQueueRunner } from '@/features/booth/voice/voiceQueue';
import { flushCardLinks } from '@/features/booth/card/useCardScanAvailable';
import MeetingsList from '@/features/booth/salon/MeetingsList';
import DashboardScreen, { type ListFilter } from '@/features/booth/dashboard/DashboardScreen';
import DebriefScreen from '@/features/booth/dashboard/DebriefScreen';
import OutcomeScreen from '@/features/booth/dashboard/OutcomeScreen';
import ActionsScreen, { openActions } from '@/features/booth/dashboard/ActionsScreen';
import MeetingDetail from '@/features/booth/salon/MeetingDetail';
import DuplicatesScreen from '@/features/booth/salon/DuplicatesScreen';
import { findDuplicates } from '@/lib/booth/rpc';
import { clearDraft, emptyDraft, loadDraft, type MeetingDraft } from '@/features/booth/salon/draft';
import { isCompleted, ownerOf } from '@/features/booth/salon/labels';
import { registerSalonSW, useOfflineReady } from '@/features/booth/offline/registerSalonSW';
import { LAST_WORKSPACE_KEY } from '@/pages/SalonStart';
import { useSalonAppMeta } from '@/features/booth/offline/useSalonAppMeta';
import InstallBanner from '@/features/booth/offline/InstallBanner';
import ScreenContainer, { SCREEN_WIDTH } from '@/features/booth/layout/ScreenContainer';
import { isMeeting, ownerId } from '@/features/booth/dashboard/metrics';
import { fullName } from '@/features/booth/salon/labels';
import { purgeOrphanCards, removeCard, useCardQueueRunner, useCards } from '@/features/booth/card/cardQueue';

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
function useMinWidth(px: number) {
  const q = `(min-width: ${px}px)`;
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setOk(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return ok;
}
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
  let cls = 'bg-booth-sync-bg text-mint-deep border-transparent';
  let dot = true;
  let label = 'Synchronisé';
  if (rejectedCount > 0) {
    cls = 'bg-destructive/10 text-destructive border-destructive/30';
    dot = false;
    label = `À reprendre (${rejectedCount})`;
  } else if (!online) {
    cls = 'bg-muted text-muted-foreground border-border';
    dot = false;
    label = `Hors connexion · ${pendingCount} en attente`;
  } else if (pendingCount > 0) {
    cls = 'bg-flame-surface text-foreground border-flame-soft';
    dot = false;
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
      ) : dot ? (
        <span className="h-2 w-2 rounded-full bg-mint-bright" aria-hidden="true" />
      ) : rejectedCount === 0 && online ? (
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      ) : !online ? (
        <CloudOff className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {false && (
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
  const [screen, setScreen] = useState<'home' | 'flow' | 'list' | 'detail' | 'duplicates' | 'dashboard' | 'debrief' | 'actions' | 'outcome'>('home');
  const [outcomeBack, setOutcomeBack] = useState<'home' | 'dashboard'>('home');
  const [actionsBack, setActionsBack] = useState<'home' | 'dashboard'>('home');
  const [listFilter, setListFilter] = useState<ListFilter | null>(null);
  const [listBack, setListBack] = useState<'home' | 'dashboard' | 'actions' | 'debrief'>('home');
  const [detailBack, setDetailBack] = useState<'list' | 'debrief' | 'actions' | 'home'>('list');
  const [dupCount, setDupCount] = useState(0);
  const [flowInitial, setFlowInitial] = useState<MeetingDraft>(emptyDraft());
  const [flowKey, setFlowKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const isLg = useMinWidth(1024);
  // lg : la fiche s'ouvre à droite de la liste ; en dessous, écran fiche plein écran (inchangé).
  const openDetail = (id: string, origin: 'home' | 'actions' | 'debrief') => {
    setDetailId(id);
    if (isLg) {
      setCardFilter(null);
      setListFilter(null);
      setListBack(origin);
      setScreen('list');
    } else {
      setDetailBack(origin);
      setScreen('detail');
    }
  };
  const [savedDraft, setSavedDraft] = useState<MeetingDraft | null>(null);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [toAbandon, setToAbandon] = useState<OutboxItem | null>(null);
  const [persistent, setPersistent] = useState(isPersistentStorage());
  const [cardFilter, setCardFilter] = useState<'pending' | 'review' | null>(null);
  useCardQueueRunner(user?.id, cache?.exhibitorId, workspaceId);
  const cards = useCards(user?.id, workspaceId);
  useVoiceQueueRunner(user?.id, cache?.exhibitorId, workspaceId);
  const voicePending = useVoiceItems(user?.id, workspaceId).filter((v) => v.state === 'pending').length;
  const cardsPending = cards.filter((c) => c.state === 'pending' && c.contactId).length;
  const cardsReview = cards.filter((c) => c.state !== 'pending' && c.contactId).length;

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
  const ecranRead = useRef(false);
  useEffect(() => {
    if (ecranRead.current || !cache) return;
    ecranRead.current = true;
    const url = new URL(window.location.href);
    const v = url.searchParams.get('ecran');
    if (!v) return;
    url.searchParams.delete('ecran');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    if (v === 'tableau') setScreen('dashboard');
    else if (v === 'actions') { setActionsBack('home'); setScreen('actions'); }
    else if (v === 'bilan' && cache.role === 'manager') { setOutcomeBack('home'); setScreen('outcome'); }
    else if (v === 'rencontres') { setListBack('home'); setScreen('list'); }
  }, [cache]);
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

  const userIdForLinks = user?.id;
  useEffect(() => {
    if (userIdForLinks && sync.online) void flushCardLinks(userIdForLinks);
  }, [userIdForLinks, sync.online]);

  // Au montage : cartes sans contact non reliées au brouillon supprimées
  const userIdForPurge = user?.id;
  useEffect(() => {
    if (!userIdForPurge || !workspaceId) return;
    void loadDraft(userIdForPurge, workspaceId)
      .then((dr) => purgeOrphanCards(userIdForPurge, workspaceId, dr?.cardScanId ?? null))
      .catch(() => undefined);
  }, [userIdForPurge, workspaceId]);

  // Application rechargée pendant la prise de photo : reprise sur l'écran « Qui ? »
  const [cameraRetry, setCameraRetry] = useState<'card' | 'badge' | null>(null);
  const cameraChecked = useRef(false);
  const cacheReady = !!cache;
  useEffect(() => {
    if (cameraChecked.current || !cacheReady || !userIdForPurge || !workspaceId) return;
    cameraChecked.current = true;
    try {
      const raw = localStorage.getItem(CAMERA_PENDING_KEY);
      if (!raw) return;
      const v = JSON.parse(raw) as { workspaceId?: string; kind?: string; at?: number };
      if (v.workspaceId !== workspaceId) return;
      localStorage.removeItem(CAMERA_PENDING_KEY);
      if (typeof v.at !== 'number' || Date.now() - v.at > 10 * 60 * 1000) return;
      setCameraRetry(v.kind === 'badge' ? 'badge' : 'card');
      setFlowInitial(emptyDraft());
      setFlowKey((k) => k + 1);
      setScreen('flow');
    } catch {
      /* ignoré */
    }
  }, [cacheReady, userIdForPurge, workspaceId]);

  const startFlow = (initial: MeetingDraft) => {
    setCameraRetry(null);
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
    <div className="flex min-h-[100dvh] flex-col bg-booth-canvas text-foreground">
      <Helmet>
        <title>Mode salon · Lotexpo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background px-3 pt-[env(safe-area-inset-top)]">
        <div className={`flex h-14 w-full items-center justify-between gap-2 ${SCREEN_WIDTH} md:px-3`}>
        <Link to="/leads" className="-ml-1 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-base font-medium">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Mes salons
        </Link>
        {cache && (
          <SyncPill
            pendingCount={sync.pendingCount + voicePending}
            rejectedCount={sync.rejectedCount}
            online={sync.online}
            syncing={sync.syncing}
            lastSyncAt={sync.lastSyncAt}
            onSync={sync.syncNow}
            onOpenRejected={() => setRejectedOpen(true)}
          />
        )}
        </div>
      </header>

      {!persistent && (
        <div className="border-b border-flame-soft bg-flame-surface px-4 py-3 text-sm text-foreground">
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
      ) : (
        <ScreenContainer>
      {screen === 'flow' && user ? (
        <NewMeetingFlow
          key={flowKey}
          cache={cache}
          me={user.id}
          online={sync.online}
          initial={flowInitial}
          cameraRetry={cameraRetry}
          onHome={() => setScreen('home')}
        />
      ) : screen === 'list' && user ? (
        <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex flex-1 flex-col lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto">
        <MeetingsList
          cache={cache}
          me={user.id}
          onBack={() => { setCardFilter(null); setListFilter(null); setScreen(listBack); }}
          cardFilter={cardFilter}
          idFilter={listFilter}
          onClearIdFilter={() => setListFilter(null)}
          onClearCardFilter={() => setCardFilter(null)}
          selectedId={isLg ? detailId : null}
          onOpen={(id) => {
            setDetailId(id);
            if (isLg) return;
            setDetailBack('list');
            setScreen('detail');
          }}
          onInbound={startInbound}
        />
        </div>
        {isLg && (
          <div className="hidden lg:block lg:min-w-0 lg:rounded-xl lg:border lg:border-border">
            {detailId && cache.interactions.some((x) => x.id === detailId) ? (
              <MeetingDetail key={detailId} cache={cache} me={user.id} interactionId={detailId} split onBack={() => setDetailId(null)} />
            ) : (
              <p className="p-8 text-center text-muted-foreground">Sélectionnez une rencontre pour voir sa fiche.</p>
            )}
          </div>
        )}
        </div>
      ) : screen === 'duplicates' && user ? (
        <DuplicatesScreen cache={cache} me={user.id} online={sync.online} onBack={() => setScreen('home')} />
      ) : screen === 'detail' && user && detailId ? (
        <MeetingDetail cache={cache} me={user.id} interactionId={detailId} onBack={() => setScreen(detailBack)} />
      ) : screen === 'dashboard' && user ? (
        <DashboardScreen
          cache={cache}
          me={user.id}
          pendingCount={sync.pendingCount + sync.rejectedCount}
          lastSyncAt={sync.lastSyncAt}
          onBack={() => setScreen('home')}
          onOpenList={(f) => { setCardFilter(null); setListFilter(f); setListBack('dashboard'); setScreen('list'); }}
          onDebrief={() => setScreen('debrief')}
          onActions={() => { setActionsBack('dashboard'); setScreen('actions'); }}
          onOutcome={() => { setOutcomeBack('dashboard'); setScreen('outcome'); }}
        />
      ) : screen === 'outcome' && user && cache.role === 'manager' ? (
        <OutcomeScreen cache={cache} me={user.id} online={sync.online} onBack={() => setScreen(outcomeBack)} />
      ) : screen === 'actions' && user ? (
        <ActionsScreen
          cache={cache}
          me={user.id}
          onBack={() => setScreen(actionsBack)}
          onOpen={(id) => openDetail(id, 'actions')}
        />
      ) : screen === 'debrief' && user ? (
        <DebriefScreen
          cache={cache}
          me={user.id}
          onBack={() => setScreen('dashboard')}
          onOpen={(id) => openDetail(id, 'debrief')}
        />
      ) : (
        <main className="flex flex-1 flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-0 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="contents lg:flex lg:flex-col lg:gap-5">
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
            <div className="rounded-xl border border-flame-soft bg-flame-surface px-4 py-3 text-sm font-medium text-foreground">
              Ce salon est archivé : consultation seule
            </div>
          )}

          <div>
            {homeSubtitle(ws, todayYmd) && <p className="text-[13px] font-medium text-muted-foreground">{homeSubtitle(ws, todayYmd)}</p>}
            <h1 className="mt-0.5 break-words text-[26px] font-semibold leading-tight tracking-[-0.01em]">{ws.nom_event}</h1>
            {offlineReady && <p className="mt-1 text-xs font-medium text-mint-deep">Disponible sans réseau</p>}
          </div>

          <InstallBanner pendingCount={sync.pendingCount + sync.rejectedCount} />

          <GoalCard
            input={{ team: counts.team, mine: counts.mine, hot: counts.hot, goal: ws.daily_goal ?? null, isManager, archived: ws.archived }}
            workspaceId={workspaceId}
            todayYmd={todayYmd}
            onEdit={() => setGoalOpen(true)}
          />

          {!ws.archived && savedDraft && (
            <DraftCard label={draftLabel(savedDraft)} onResume={() => startFlow(savedDraft)} onClear={clearSavedDraft} />
          )}

          {!ws.archived && (
            <AppButton onClick={() => requestStart(null)}>
              <Plus className="h-5 w-5" aria-hidden="true" /> Nouvelle rencontre
            </AppButton>
          )}

          <QuickTiles
            modes={quickTiles({ voice: !!cache.full_features && voiceSupported, card: cardAvailable, archived: ws.archived })}
            online={sync.online}
            onPick={(m) => requestStart(m)}
          />

          <HomeMenu rows={menuRows} />
          </div>
          <RecentMeetings cache={cache} me={user?.id ?? null} onOpen={(id) => openDetail(id, 'home')} onAll={() => { setDetailId(null); setCardFilter(null); setListFilter(null); setListBack('home'); setScreen('list'); }} />
        </main>
      )}
        </ScreenContainer>
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

function RecentMeetings({ cache, me, onOpen, onAll }: { cache: BoothCache; me: string | null; onOpen: (id: string) => void; onAll: () => void }) {
  const rows = useMemo(() => {
    if (!me) return [];
    const contacts = new Map(cache.contacts.map((c) => [c.id, c]));
    return cache.interactions
      .filter((i) => isMeeting(i, cache.workspaceId) && (cache.role === 'manager' || ownerId(i, me) === me))
      .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))
      .slice(0, 8)
      .map((i) => {
        const c = contacts.get(i.contact_id) ?? null;
        const label = [c?.company_name?.trim(), fullName(c)].filter(Boolean).join(' · ') || primaryLabel(c as unknown as Record<string, string | null> | null);
        return { id: i.id, label, at: i.occurred_at };
      });
  }, [cache, me]);

  return (
    <section className="hidden lg:block lg:rounded-xl lg:border lg:border-border lg:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold tracking-[-0.02em]">Dernières rencontres</h2>
        <Button variant="link" className="min-h-[44px] px-0" onClick={onAll}>Voir toutes les rencontres</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Vos rencontres du salon apparaîtront ici.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r.id)} className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2 text-left hover:bg-muted">
                <span className="truncate font-medium">{r.label}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{timeFmt(r.at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
