import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building2, Camera, Loader2, QrCode } from 'lucide-react';
import { prepareCardImage } from '../card/image';
import { addCard, pauseCardQueue, processCardQueue, PROVISIONAL_COMPANY, removeCard, updateCard } from '../card/cardQueue';

export const CAMERA_PENDING_KEY = 'lotexpo-leads:camera-pending';
const clearCameraPending = () => {
  try {
    localStorage.removeItem(CAMERA_PENDING_KEY);
  } catch {
    /* ignoré */
  }
};
import { linkCardScanLater, useCardScanAvailable } from '../card/useCardScanAvailable';
import QrScanner from '../qr/QrScanner';
import { hasUsefulData, parseQr } from '../qr/parse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { headLabel, primaryLabel, secondaryLabel } from './display';
import { boothErrorMessage, scanCard, searchCompanies, searchContacts, type BoothCompanySearchItem } from '@/lib/booth/rpc';
import type { Interaction } from '@/lib/booth/types';
import type { BoothCache } from '../sync/cache';
import { enqueue, newId } from '../sync/engine';
import { clearDraft, emptyDraft, saveDraft, type FlowStep, type MeetingDraft } from './draft';
import {
  ACTION,
  HORIZON,
  POTENTIAL,
  RELATIONSHIP,
  TOPIC,
  VALUE_BAND,
  fmtDateTime,
  fullName,
  normPhone,
  splitName,
  teammateName,
  ymd,
} from './labels';

const ORDER: FlowStep[] = ['who', 'verify', 'coord', 'rel', 'pot', 'concrete', 'action', 'details', 'done'];

interface Suggestion {
  id: string;
  name: string;
  company: string | null;
  hint: string | null;
  relationship: Interaction['relationship'] | null;
}

function Choice({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant={selected ? 'default' : 'outline'}
      className="min-h-[56px] w-full justify-start text-base"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Chip({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant={selected ? 'default' : 'outline'} className="min-h-[44px] rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export interface FlowPrefill {
  name?: string;
  company?: string;
  email?: string | null;
  inbound_lead_id?: string;
}

export default function NewMeetingFlow({
  cache,
  me,
  online,
  initial,
  onHome,
  cameraRetry = null,
}: {
  cache: BoothCache;
  me: string;
  online: boolean;
  initial: MeetingDraft;
  onHome: () => void;
  cameraRetry?: 'card' | 'badge' | null;
}) {
  const [d, setD] = useState<MeetingDraft>({ ...emptyDraft(), ...initial });
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; label: string; rel: Interaction['relationship'] | null } | null>(null);
  const [companyFocus, setCompanyFocus] = useState(false);
  const [onlineContacts, setOnlineContacts] = useState<Suggestion[]>([]);
  const [companies, setCompanies] = useState<BoothCompanySearchItem[]>([]);
  const [customDate, setCustomDate] = useState(false);
  const wsId = cache.workspaceId;
  const userId = me;
  const cardAvailable = useCardScanAvailable(userId, cache.exhibitorId, wsId, online);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cardKind, setCardKind] = useState<'card' | 'badge'>('card');
  const [kindPicker, setKindPicker] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFull, setPhotoFull] = useState(false);
  const [cardWait, setCardWait] = useState(false);
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const [qrPresent, setQrPresent] = useState(false);
  const scanToken = useRef(0);

  // Pas de lecture de cartes en parallèle tant que le parcours est ouvert
  useEffect(() => {
    const resume = pauseCardQueue();
    return () => {
      resume();
      void processCardQueue(userId, wsId);
    };
  }, [userId, wsId]);

  // Photo annulée : la prise de vue n'est plus en cours
  useEffect(() => {
    const el = fileRef.current;
    if (!el) return;
    el.addEventListener('cancel', clearCameraPending);
    return () => el.removeEventListener('cancel', clearCameraPending);
  }, []);

  useEffect(() => {
    if (!cameraRetry) return;
    setCardKind(cameraRetry);
    setKindPicker(true);
    setCardMsg('Le téléphone a interrompu la prise de photo. Reprenez la photo.');
  }, [cameraRetry]);

  const openCamera = (kind: 'card' | 'badge') => {
    setKindPicker(false);
    setCardKind(kind);
    setCardMsg(null);
    try {
      localStorage.setItem(CAMERA_PENDING_KEY, JSON.stringify({ workspaceId: wsId, kind, at: Date.now() }));
    } catch {
      /* ignoré */
    }
    fileRef.current?.click();
  };

  const cancelCardWait = () => {
    scanToken.current++;
    setCardWait(false);
  };

  const onPhoto = async (picked: File | undefined) => {
    clearCameraPending();
    if (fileRef.current) fileRef.current.value = '';
    let file: File | null = picked ?? null;
    if (!file) return;
    setScanMsg(null);
    setCardMsg(null);
    setPhotoUrl(null);
    const token = ++scanToken.current;
    setCardWait(true);
    let img: { base64: string; mediaType: 'image/jpeg'; dataUrl: string } | null = null;
    const scanId = newId();
    const queueOffline = async () => {
      if (!img) return false;
      await addCard({
        scanId,
        userId,
        exhibitorId: cache.exhibitorId,
        workspaceId: wsId,
        kind: cardKind,
        base64: img.base64,
        contactId: null,
        interactionId: null,
      });
      setCardWait(false);
      go('rel', {
        name: '',
        company: PROVISIONAL_COMPANY,
        companyDomain: null,
        companyRef: null,
        contactId: null,
        jobTitle: '',
        linkedinUrl: null,
        coordMode: null,
        coordValue: '',
        phoneExtra: '',
        captureSource: 'card',
        cardScanId: scanId,
        cardConfidence: null,
        cardQueued: true,
      });
      return true;
    };
    try {
      img = await prepareCardImage(file);
      file = null;
      picked = undefined;
      setPhotoUrl(img.dataUrl);
      if (token !== scanToken.current) return;
      if (!navigator.onLine) {
        await queueOffline();
        return;
      }
      const res = await Promise.race([
        scanCard({ workspaceId: wsId, scanId, kind: cardKind, imageBase64: img.base64, mediaType: img.mediaType }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('BOOTH_TIMEOUT')), 30_000)),
      ]);
      if (token !== scanToken.current) return;
      if (res.status !== 'ok' || !res.fields) {
        setCardWait(false);
        setCardMsg('Carte illisible. Reprenez la photo ou saisissez le contact à la main.');
        return;
      }
      const f = res.fields;
      let company = f.company_name ?? '';
      const companyDomain = res.company_domain ?? null;
      let companyRef: string | null = null;
      if (companyDomain) {
        try {
          const r = await searchCompanies(companyDomain, 1);
          const hit = r.items?.[0];
          if (hit && (hit.domain ?? '').toLowerCase() === companyDomain.toLowerCase()) {
            companyRef = hit.public_identity_id;
            company = hit.name;
          }
        } catch {
          // saisie libre
        }
      }
      if (token !== scanToken.current) return;
      const tel = f.mobile || f.phone || '';
      setQrPresent(!!res.qr_present);
      setCardWait(false);
      go('verify', {
        name: [f.first_name, f.last_name].filter(Boolean).join(' '),
        company,
        companyDomain,
        companyRef,
        contactId: null,
        jobTitle: f.job_title ?? '',
        linkedinUrl: f.linkedin_url ?? null,
        coordMode: f.email ? 'email' : tel ? 'phone' : null,
        coordValue: f.email ? f.email : tel,
        phoneExtra: f.email ? tel : '',
        captureSource: 'card',
        cardScanId: scanId,
        cardConfidence: (res.confidence ?? null) as MeetingDraft['cardConfidence'],
      });
    } catch (e) {
      if (token !== scanToken.current) return;
      setCardWait(false);
      const m = String((e as Error)?.message ?? '');
      if ((m.includes('BOOTH_NETWORK') || m.includes('BOOTH_TIMEOUT')) && (await queueOffline())) return;
      setCardMsg(
        m.includes('BOOTH_PLAN_REQUIRED')
          ? "La lecture des cartes est incluse dans la bêta, le Pass Salon et l'Annuel."
          : m.includes('BOOTH_NETWORK') || m.includes('BOOTH_TIMEOUT')
            ? "La lecture n'a pas abouti. Reprenez la photo ou saisissez le contact à la main."
            : boothErrorMessage(e),
      );
    }
  };

  const conf = (...keys: string[]) => {
    if (d.captureSource !== 'card' || !d.cardConfidence) return false;
    return keys.some((k) => d.cardConfidence?.[k] === 'medium' || d.cardConfidence?.[k] === 'low');
  };
  const warnCls = (w: boolean) => (w ? ' border-2 border-warning' : '');
  const Warn = ({ on }: { on: boolean }) => (on ? <p className="-mt-2 text-xs font-medium text-warning-foreground">À vérifier</p> : null);

  const patch = (p: Partial<MeetingDraft>) => setD((prev) => ({ ...prev, ...p }));
  const go = (step: FlowStep, p: Partial<MeetingDraft> = {}) =>
    setD((prev) => ({ ...prev, ...p, step, history: [...prev.history, prev.step] }));
  const dropQueuedCard = (cur: MeetingDraft) => {
    if (cur.cardQueued && cur.cardScanId && !cur.contactId) void removeCard(userId, wsId, cur.cardScanId);
  };
  const back = () => {
    if (d.history.length === 0) {
      dropQueuedCard(d);
      return onHome();
    }
    const prevStep = d.history[d.history.length - 1];
    if (prevStep === 'who' && d.cardQueued && d.cardScanId) {
      dropQueuedCard(d);
      setPhotoUrl(null);
      setDuplicate(null);
      setD((prev) => ({
        ...prev,
        step: 'who',
        history: prev.history.slice(0, -1),
        cardScanId: null,
        cardQueued: false,
        captureSource: 'manual',
        company: prev.company === PROVISIONAL_COMPANY ? '' : prev.company,
      }));
      return;
    }
    setDuplicate(null);
    setD((prev) => ({ ...prev, step: prev.history[prev.history.length - 1], history: prev.history.slice(0, -1) }));
  };

  // Brouillon local dès que la relation est choisie
  useEffect(() => {
    if (d.step !== 'done' && d.relationship) void saveDraft(userId, wsId, d);
  }, [d, userId, wsId]);

  const lastByContact = useMemo(() => {
    const m = new Map<string, Interaction>();
    for (const i of cache.interactions) {
      if (i.status === 'cancelled') continue;
      const prev = m.get(i.contact_id);
      if (!prev || prev.occurred_at < i.occurred_at) m.set(i.contact_id, i);
    }
    return m;
  }, [cache.interactions]);

  const hintFor = (contactId: string, count?: number) => {
    const last = lastByContact.get(contactId);
    if (last) {
      const { date, time } = fmtDateTime(last.occurred_at);
      return `Déjà rencontré par ${teammateName(cache, last.owner_user_id ?? last.created_by ?? me, me)} le ${date} à ${time}`;
    }
    return count ? `Rencontré ${count} fois` : null;
  };

  const q = d.name.trim().toLowerCase();
  const localSuggestions: Suggestion[] = useMemo(() => {
    if (d.step !== 'who' || q.length < 2) return [];
    return cache.contacts
      .filter((c) =>
        [fullName(c), c.company_name, c.email].some((v) => (v ?? '').toLowerCase().includes(q)),
      )
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: fullName(c) || c.email || 'Sans nom',
        company: c.company_name,
        hint: hintFor(c.id),
        relationship: lastByContact.get(c.id)?.relationship ?? null,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cache.contacts, d.step, lastByContact]);

  const debName = useDebounced(q);
  useEffect(() => {
    if (d.step !== 'who' || !online || debName.length < 2 || d.contactId) return setOnlineContacts([]);
    let cancelled = false;
    searchContacts(cache.exhibitorId, debName, 10)
      .then((r) => {
        if (cancelled) return;
        setOnlineContacts(
          (r.items ?? []).map((c) => ({
            id: c.id,
            name: fullName(c) || c.email || 'Sans nom',
            company: c.company_name,
            hint: hintFor(c.id, c.interactions_count),
            relationship: lastByContact.get(c.id)?.relationship ?? null,
          })),
        );
      })
      .catch(() => !cancelled && setOnlineContacts([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debName, online, d.step, d.contactId, cache.exhibitorId]);

  const debCompany = useDebounced(d.company.trim());
  useEffect(() => {
    if (!online || !companyFocus || debCompany.length < 2 || d.companyRef) return setCompanies([]);
    let cancelled = false;
    searchCompanies(debCompany, 6)
      .then((r) => !cancelled && setCompanies(r.items ?? []))
      .catch(() => !cancelled && setCompanies([]));
    return () => {
      cancelled = true;
    };
  }, [debCompany, online, companyFocus, d.companyRef]);

  const suggestions = useMemo(() => {
    const ids = new Set(localSuggestions.map((s) => s.id));
    return [...localSuggestions, ...onlineContacts.filter((s) => !ids.has(s.id))].slice(0, 8);
  }, [localSuggestions, onlineContacts]);

  const pickContact = (s: Suggestion) =>
    go('rel', { contactId: s.id, name: s.name, company: s.company ?? '', relationship: s.relationship ?? null });

  const findDup = (email: string, phone: string) => {
    const e = email.trim().toLowerCase();
    const n = normPhone(phone);
    const c =
      (e && cache.contacts.find((x) => (x.email ?? '').toLowerCase() === e)) ||
      (n && cache.contacts.find((x) => normPhone(x.phone) === n)) ||
      null;
    return c
      ? { id: c.id, label: [primaryLabel(c), secondaryLabel(c)].filter(Boolean).join(', '), rel: lastByContact.get(c.id)?.relationship ?? null }
      : null;
  };

  const checkDuplicateAndContinue = () => {
    const v = d.coordValue.trim();
    const dup = findDup(d.coordMode === 'email' ? v : '', d.coordMode === 'phone' ? v : '');
    if (dup) return setDuplicate(dup);
    go('rel');
  };

  const verifyContinue = () => {
    const email = d.coordMode === 'email' ? d.coordValue : '';
    const phone = d.coordMode === 'phone' ? d.coordValue : d.phoneExtra;
    const dup = findDup(email, phone);
    if (dup) return setDuplicate(dup);
    go(email.trim() || phone.trim() ? 'rel' : 'coord');
  };

  const handleScan = async (text: string) => {
    setScanning(false);
    const p = parseQr(text);
    if (!hasUsefulData(p)) {
      setScanMsg('Ce QR code ne contient pas de coordonnées lisibles. Saisissez le nom à la main ou utilisez plus tard la photo du badge.');
      return;
    }
    setScanMsg(null);
    let company = p.company ?? '';
    let companyDomain: string | null = p.domain ?? null;
    let companyRef: string | null = null;
    if (!company && p.domain) {
      company = p.domain;
      if (online) {
        try {
          const r = await searchCompanies(p.domain, 1);
          const hit = r.items?.[0];
          if (hit) {
            company = hit.name;
            companyDomain = hit.domain ?? p.domain;
            companyRef = hit.public_identity_id;
          }
        } catch {
          // saisie libre
        }
      }
    }
    go('verify', {
      name: p.name ?? '',
      company,
      companyDomain,
      companyRef,
      contactId: null,
      jobTitle: p.job_title ?? '',
      linkedinUrl: p.linkedin_url ?? null,
      coordMode: p.email ? 'email' : p.phone ? 'phone' : null,
      coordValue: p.email ?? p.phone ?? '',
      phoneExtra: p.email && p.phone ? p.phone : '',
      captureSource: 'qr',
    });
  };

  const dueOptions = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const week = new Date(today);
    week.setDate(today.getDate() + 7);
    let after: string | null = null;
    if (cache.workspace.date_fin || cache.workspace.date_debut) {
      const [y, m, dd] = (cache.workspace.date_fin || cache.workspace.date_debut)!.slice(0, 10).split('-').map(Number);
      after = ymd(new Date(y, m - 1, dd + 1));
    }
    return { tomorrow: ymd(tomorrow), after, week: ymd(week) };
  }, [cache.workspace.date_fin, cache.workspace.date_debut]);

  const pickAction = (a: Interaction['next_action']) => {
    if (a === 'none') return go('details', { next_action: a, due: null });
    patch({ next_action: a, due: d.due ?? dueOptions.after ?? dueOptions.tomorrow, owner: d.owner ?? me });
  };

  async function save(override: Partial<MeetingDraft> = {}) {
    const f = { ...d, ...override };
    setSaving(true);
    try {
      let contactId = f.contactId;
      if (!contactId) {
        contactId = newId();
        const { first_name, last_name } = splitName(f.name);
        const data: Record<string, unknown> = {
          first_name,
          last_name,
          company_name: f.company.trim() || null,
          company_domain: f.companyDomain,
          lotexpo_company_ref: f.companyRef,
          source: f.captureSource === 'card' ? 'card' : f.captureSource === 'qr' ? 'qr' : f.companyRef ? 'search' : 'manual',
        };
        if (f.jobTitle.trim()) data.job_title = f.jobTitle.trim();
        if (f.linkedinUrl) data.linkedin_url = f.linkedinUrl;
        if (f.phoneExtra.trim()) data.phone = f.phoneExtra.trim();
        if (f.coordMode === 'email' && f.coordValue.trim()) data.email = f.coordValue.trim();
        if (f.coordMode === 'phone' && f.coordValue.trim()) data.phone = f.coordValue.trim();
        await enqueue(userId, cache.exhibitorId, 'contact', contactId, data);
      }
      const interactionId = newId();
      if (f.cardScanId && f.cardQueued) {
        await updateCard(userId, wsId, f.cardScanId, { contactId, interactionId });
      } else if (f.cardScanId) linkCardScanLater(userId, f.cardScanId, contactId);
      const action = f.next_action ?? 'none';
      await enqueue(userId, cache.exhibitorId, 'interaction', interactionId, {
        workspace_id: wsId,
        contact_id: contactId,
        occurred_at: new Date().toISOString(),
        relationship: f.relationship,
        customer_topic: f.relationship === 'customer' ? f.customer_topic : null,
        potential: f.relationship === 'customer' ? null : f.potential,
        next_action: action,
        next_action_due: action === 'none' ? null : f.due,
        next_action_owner_id: action === 'none' ? null : f.owner ?? me,
        note: f.note.trim() || null,
        capture_source: f.captureSource,
        ...(f.inbound_lead_id ? { inbound_lead_id: f.inbound_lead_id } : {}),
      });
      if (f.concrete) {
        const amount = f.amount.trim() ? Number(f.amount.replace(/\s/g, '').replace(',', '.')) : null;
        await enqueue(userId, cache.exhibitorId, 'opportunity', newId(), {
          workspace_id: wsId,
          contact_id: contactId,
          origin_interaction_id: interactionId,
          title: `Projet ${f.company.trim() || f.name.trim()}`,
          value_band: f.value_band,
          amount: amount !== null && Number.isFinite(amount) ? amount : null,
          horizon: f.horizon,
        });
      }
      await clearDraft(userId, wsId);
      setD((prev) => ({ ...prev, ...override, step: 'done', history: [] }));
    } finally {
      setSaving(false);
    }
  }

  const phoneConfKey = d.cardConfidence?.mobile ? 'mobile' : 'phone';
  const progress = Math.max(0, ORDER.indexOf(d.step === 'topic' ? 'pot' : d.step)) / (ORDER.length - 1);
  const title = headLabel(d.company, d.name);

  if (d.step === 'done') {
    const parts = [
      `${title || 'Contact'} enregistré`,
      d.relationship === 'customer'
        ? d.customer_topic && TOPIC[d.customer_topic]
        : d.potential && POTENTIAL[d.potential],
      ACTION[d.next_action ?? 'none'],
    ].filter(Boolean);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-xl font-semibold text-foreground">{parts.join(' · ')}</p>
        <Button size="lg" className="min-h-[64px] w-full max-w-sm text-lg font-semibold" onClick={() => { setPhotoUrl(null); setQrPresent(false); setD(emptyDraft()); }}>
          Prochaine rencontre
        </Button>
        <Button variant="link" onClick={onHome}>
          Retour à l'accueil
        </Button>
      </div>
    );
  }

  const dupBlock = duplicate && (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="font-medium">Ce contact existe déjà : {duplicate.label}</p>
      <Choice
        selected
        onClick={() => {
          const dup = duplicate;
          setDuplicate(null);
          go('rel', { contactId: dup.id, relationship: dup.rel });
        }}
      >
        Utiliser cette fiche (recommandé)
      </Choice>
      <Choice
        onClick={() => {
          setDuplicate(null);
          go(d.step === 'verify' && !d.coordValue.trim() && !d.phoneExtra.trim() ? 'coord' : 'rel');
        }}
      >
        Créer quand même
      </Choice>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      {scanning && (
        <QrScanner
          onResult={(t) => void handleScan(t)}
          onClose={() => setScanning(false)}
          onDenied={() => {
            setScanning(false);
            setScanMsg("Autorisez l'accès à la caméra dans les réglages du navigateur pour scanner.");
          }}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onPhoto(e.target.files?.[0])}
      />
      {photoFull && photoUrl && (
        <button type="button" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4" onClick={() => setPhotoFull(false)}>
          <img src={photoUrl} alt="Photo de la carte" className="max-h-full max-w-full object-contain" />
        </button>
      )}
      {cardWait && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-background p-6">
          {photoUrl && <img src={photoUrl} alt="" className="max-h-48 rounded-lg border border-border object-contain" />}
          <p className="flex items-center text-lg font-medium"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Lecture de la carte…</p>
          <Button variant="outline" className="min-h-[56px] w-full max-w-sm text-base" onClick={cancelCardWait}>
            Saisir à la main
          </Button>
        </div>
      )}
      <div className="h-1 w-full bg-muted">
        <div className="h-1 bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="flex items-center gap-2 px-2 py-2">
        <Button variant="ghost" className="min-h-[44px] px-2" onClick={back}>
          <ArrowLeft className="mr-1 h-5 w-5" /> Retour
        </Button>
        {title && d.step !== 'who' && <span className="truncate text-sm text-muted-foreground">{title}</span>}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {d.step === 'who' && (
          <>
            <h2 className="text-2xl font-bold">Qui ?</h2>
            <Button
              type="button"
              variant="outline"
              className="min-h-[56px] w-full text-base"
              onClick={() => {
                setScanMsg(null);
                setScanning(true);
              }}
            >
              <QrCode className="mr-2 h-5 w-5" /> Scanner un QR code
            </Button>
            {cardAvailable && (
              <Button
                type="button"
                variant="outline"
                className="min-h-[56px] w-full text-base"
                onClick={() => { setCardMsg(null); setKindPicker((v) => !v); }}
              >
                <Camera className="mr-2 h-5 w-5" /> Photo de la carte ou du badge
              </Button>
            )}
            {kindPicker && (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" className="min-h-[56px] text-base" onClick={() => openCamera('card')}>Carte de visite</Button>
                <Button variant="secondary" className="min-h-[56px] text-base" onClick={() => openCamera('badge')}>Badge du salon</Button>
              </div>
            )}
            {cardMsg && (
              <div className="space-y-3 rounded-md bg-muted p-3">
                <p className="text-sm text-foreground">{cardMsg}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="min-h-[44px]" onClick={() => openCamera(cardKind)}>Reprendre la photo</Button>
                  <Button variant="ghost" className="min-h-[44px]" onClick={() => setCardMsg(null)}>Saisir à la main</Button>
                </div>
              </div>
            )}
            {scanMsg && <p className="rounded-md bg-muted p-3 text-sm text-foreground">{scanMsg}</p>}
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder="Nom (prénom et nom)"
                className="h-14 text-base"
                value={d.name}
                autoComplete="off"
                onChange={(e) => patch({ name: e.target.value, contactId: null })}
              />
              {suggestions.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="w-full p-3 text-left hover:bg-muted" onClick={() => pickContact(s)}>
                        <p className="font-semibold">{s.company || s.name}</p>
                        {s.company && <p className="text-sm text-muted-foreground">{s.name}</p>}
                        {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Entreprise"
                className="h-14 text-base"
                value={d.company}
                autoComplete="off"
                onFocus={() => setCompanyFocus(true)}
                onChange={(e) => patch({ company: e.target.value, companyRef: null, companyDomain: null })}
              />
              {companies.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {companies.map((c) => (
                    <li key={c.public_identity_id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted"
                        onClick={() => {
                          patch({ company: c.name, companyDomain: c.domain, companyRef: c.public_identity_id });
                          setCompanies([]);
                        }}
                      >
                        {c.logo_url ? (
                          <img onError={(e) => { e.currentTarget.style.display = 'none'; }} src={c.logo_url} alt="" className="h-8 w-8 rounded border border-border bg-background object-contain" />
                        ) : (
                          <Building2 className="h-8 w-8 p-1 text-muted-foreground" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name}</span>
                          {c.domain && <span className="block truncate text-xs text-muted-foreground">{c.domain}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              size="lg"
              className="mt-auto min-h-[56px] w-full text-base"
              disabled={!d.name.trim() && !d.company.trim()}
              onClick={() => go('coord')}
            >
              Continuer
            </Button>
          </>
        )}

        {d.step === 'verify' && (
          <>
            <h2 className="text-2xl font-bold">Vérifiez avant de continuer</h2>
            {duplicate ? (
              dupBlock
            ) : (
              <>
                {d.captureSource === 'card' && photoUrl && (
                  <button type="button" className="self-start" onClick={() => setPhotoFull(true)} aria-label="Agrandir la photo">
                    <img src={photoUrl} alt="Photo de la carte" className="h-20 rounded-md border border-border object-contain" />
                  </button>
                )}
                {d.captureSource === 'card' && qrPresent && (
                  <p className="text-sm text-muted-foreground">
                    Un QR code est visible sur la carte : le scanner peut être plus précis.{' '}
                    <button type="button" className="min-h-[44px] font-medium text-primary underline" onClick={() => { setScanMsg(null); setScanning(true); }}>
                      Scanner le QR code
                    </button>
                  </p>
                )}
                <Input placeholder="Nom (prénom et nom)" className={'h-12 text-base' + warnCls(conf('first_name', 'last_name'))} value={d.name} onChange={(e) => patch({ name: e.target.value })} />
                <Warn on={conf('first_name', 'last_name')} />
                <Input
                  placeholder="Entreprise"
                  className={'h-12 text-base' + warnCls(conf('company_name'))}
                  value={d.company}
                  onChange={(e) => patch({ company: e.target.value, companyRef: null, companyDomain: null })}
                />
                <Warn on={conf('company_name')} />
                <Input placeholder="Poste" className={'h-12 text-base' + warnCls(conf('job_title'))} value={d.jobTitle} onChange={(e) => patch({ jobTitle: e.target.value })} />
                <Warn on={conf('job_title')} />
                <Input
                  type="email"
                  inputMode="email"
                  placeholder="Email"
                  className={'h-12 text-base' + warnCls(conf('email'))}
                  value={d.coordMode === 'email' ? d.coordValue : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) patch({ coordMode: 'email', coordValue: v, phoneExtra: d.coordMode === 'phone' ? d.coordValue : d.phoneExtra });
                    else patch({ coordMode: d.phoneExtra ? 'phone' : null, coordValue: d.phoneExtra, phoneExtra: '' });
                  }}
                />
                <Warn on={conf('email')} />
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="Téléphone"
                  className={'h-12 text-base' + warnCls(conf(phoneConfKey))}
                  value={d.coordMode === 'phone' ? d.coordValue : d.phoneExtra}
                  onChange={(e) =>
                    d.coordMode === 'email' ? patch({ phoneExtra: e.target.value }) : patch({ coordMode: e.target.value ? 'phone' : null, coordValue: e.target.value })
                  }
                />
                <Warn on={conf(phoneConfKey)} />
                {d.linkedinUrl && <p className="truncate text-xs text-muted-foreground">LinkedIn : {d.linkedinUrl}</p>}
                <Button
                  size="lg"
                  className="mt-auto min-h-[56px] w-full text-base"
                  disabled={!d.name.trim() && !d.company.trim()}
                  onClick={verifyContinue}
                >
                  Continuer
                </Button>
              </>
            )}
          </>
        )}

        {d.step === 'coord' && (
          <>
            <h2 className="text-2xl font-bold">Coordonnée</h2>
            {duplicate ? (
              dupBlock
            ) : (
              <>
                <div className="grid gap-3">
                  <Choice selected={d.coordMode === 'email'} onClick={() => patch({ coordMode: 'email', coordValue: '' })}>
                    Email
                  </Choice>
                  <Choice selected={d.coordMode === 'phone'} onClick={() => patch({ coordMode: 'phone', coordValue: '' })}>
                    Téléphone
                  </Choice>
                  <Choice onClick={() => go('rel', { coordMode: 'none', coordValue: '' })}>Pas maintenant</Choice>
                </div>
                {(d.coordMode === 'email' || d.coordMode === 'phone') && (
                  <>
                    <Input
                      autoFocus
                      type={d.coordMode === 'email' ? 'email' : 'tel'}
                      inputMode={d.coordMode === 'email' ? 'email' : 'tel'}
                      placeholder={d.coordMode === 'email' ? 'adresse@entreprise.fr' : '06 12 34 56 78'}
                      className="h-14 text-base"
                      value={d.coordValue}
                      onChange={(e) => patch({ coordValue: e.target.value })}
                    />
                    <Button
                      size="lg"
                      className="mt-auto min-h-[56px] w-full text-base"
                      disabled={!d.coordValue.trim()}
                      onClick={checkDuplicateAndContinue}
                    >
                      Continuer
                    </Button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {d.step === 'rel' && (
          <>
            {d.cardQueued && (
              <p className="rounded-md bg-muted p-3 text-sm text-foreground">
                Carte enregistrée. Elle sera lue automatiquement dès le retour du réseau.
              </p>
            )}
            <h2 className="text-2xl font-bold">Relation</h2>
            <div className="grid gap-3">
              {(Object.keys(RELATIONSHIP) as Interaction['relationship'][]).map((r) => (
                <Choice
                  key={r}
                  selected={d.relationship === r}
                  onClick={() => go(r === 'customer' ? 'topic' : 'pot', { relationship: r })}
                >
                  {RELATIONSHIP[r]}
                </Choice>
              ))}
            </div>
          </>
        )}

        {d.step === 'pot' && (
          <>
            <h2 className="text-2xl font-bold">Potentiel</h2>
            <div className="grid gap-3">
              {(Object.keys(POTENTIAL) as NonNullable<Interaction['potential']>[]).map((p) => (
                <Choice
                  key={p}
                  selected={d.potential === p}
                  onClick={() => {
                    if (p === 'none') {
                      void save({ potential: p, next_action: 'none', due: null, concrete: false });
                    } else go('concrete', { potential: p });
                  }}
                >
                  {POTENTIAL[p]}
                </Choice>
              ))}
            </div>
            {saving && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
          </>
        )}

        {d.step === 'topic' && (
          <>
            <h2 className="text-2xl font-bold">Sujet</h2>
            <div className="grid gap-3">
              {(Object.keys(TOPIC) as NonNullable<Interaction['customer_topic']>[]).map((t) => (
                <Choice
                  key={t}
                  selected={d.customer_topic === t}
                  onClick={() =>
                    t === 'new_project'
                      ? go('concrete', { customer_topic: t })
                      : go('action', { customer_topic: t, concrete: false })
                  }
                >
                  {TOPIC[t]}
                </Choice>
              ))}
            </div>
          </>
        )}

        {d.step === 'concrete' && (
          <>
            <h2 className="text-2xl font-bold">Projet concret ?</h2>
            <div className="grid gap-3">
              <Choice selected={d.concrete === true} onClick={() => go('action', { concrete: true })}>
                Oui
              </Choice>
              <Choice selected={d.concrete === false} onClick={() => go('action', { concrete: false })}>
                Pas encore
              </Choice>
            </div>
          </>
        )}

        {d.step === 'action' && (
          <>
            <h2 className="text-2xl font-bold">Prochaine action</h2>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ACTION) as Interaction['next_action'][]).map((a) => (
                <Choice key={a} selected={d.next_action === a} onClick={() => pickAction(a)}>
                  {ACTION[a]}
                </Choice>
              ))}
            </div>
            {d.next_action && d.next_action !== 'none' && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Échéance</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={!customDate && d.due === dueOptions.tomorrow} onClick={() => { setCustomDate(false); patch({ due: dueOptions.tomorrow }); }}>
                      Demain
                    </Chip>
                    {dueOptions.after && (
                      <Chip selected={!customDate && d.due === dueOptions.after} onClick={() => { setCustomDate(false); patch({ due: dueOptions.after }); }}>
                        Après le salon
                      </Chip>
                    )}
                    <Chip selected={!customDate && d.due === dueOptions.week} onClick={() => { setCustomDate(false); patch({ due: dueOptions.week }); }}>
                      Dans 1 semaine
                    </Chip>
                    <Chip selected={customDate} onClick={() => setCustomDate(true)}>
                      Choisir une date
                    </Chip>
                  </div>
                  {customDate && (
                    <Input type="date" className="h-12" value={d.due ?? ''} onChange={(e) => patch({ due: e.target.value || null })} />
                  )}
                </div>
                {cache.role === 'manager' && cache.team.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Responsable</p>
                    <div className="flex flex-wrap gap-2">
                      {cache.team.map((m) => (
                        <Chip key={m.user_id} selected={(d.owner ?? me) === m.user_id} onClick={() => patch({ owner: m.user_id })}>
                          {m.user_id === me ? 'Moi' : m.name || m.email}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
                <Button size="lg" className="mt-auto min-h-[56px] w-full text-base" disabled={!d.due} onClick={() => go('details')}>
                  Continuer
                </Button>
              </>
            )}
          </>
        )}

        {d.step === 'details' && (
          <>
            <h2 className="text-2xl font-bold">Détails</h2>
            <p className="-mt-2 text-sm text-muted-foreground">Facultatif</p>
            {d.concrete && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Valeur estimée</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(VALUE_BAND) as NonNullable<MeetingDraft['value_band']>[]).map((v) => (
                      <Chip key={v} selected={d.value_band === v} onClick={() => patch({ value_band: d.value_band === v ? null : v })}>
                        {VALUE_BAND[v]}
                      </Chip>
                    ))}
                  </div>
                  <Input
                    inputMode="decimal"
                    placeholder="Montant précis en € (facultatif)"
                    className="h-12"
                    value={d.amount}
                    onChange={(e) => patch({ amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Horizon</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(HORIZON) as NonNullable<MeetingDraft['horizon']>[]).map((h) => (
                      <Chip key={h} selected={d.horizon === h} onClick={() => patch({ horizon: d.horizon === h ? null : h })}>
                        {HORIZON[h]}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Textarea
              placeholder="Note"
              maxLength={2000}
              rows={5}
              className="text-base"
              value={d.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
            <div className="sticky bottom-0 mt-auto bg-background pb-2 pt-2">
              <Button size="lg" className="min-h-[64px] w-full text-lg font-semibold" disabled={saving} onClick={() => void save()}>
                {saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
