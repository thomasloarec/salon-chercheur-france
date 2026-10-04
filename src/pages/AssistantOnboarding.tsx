import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAssistantFeed } from '@/components/assistant/useAssistantFeed';
import AssistantEventCard from '@/components/assistant/AssistantEventCard';
import RegionPicker from '@/components/assistant/RegionPicker';
import { claimParam, savePendingClaim } from '@/components/assistant/claim';
import { requestLoginLink } from '@/components/assistant/loginLink';

// ---------------------------------------------------------------------------------------------
// Types et utilitaires
// ---------------------------------------------------------------------------------------------
interface Answers {
  company_ref: string | null;
  company_name: string;
  company_description: string;
  sub_sector_ids: string[];
  role_codes: string[];
  role_other: string;
  interests: string[];
  goals: string[];
  region_codes: string[];
}

const EMPTY: Answers = {
  company_ref: null,
  company_name: '',
  company_description: '',
  sub_sector_ids: [],
  role_codes: [],
  role_other: '',
  interests: [],
  goals: [],
  region_codes: [],
};

interface Candidate {
  nom: string;
  domaine: string | null;
  description: string | null;
  id_exposant: string | null;
  has_upcoming?: boolean;
}

interface CompanyContext {
  company_ref: string;
  name: string;
  description: string | null;
  website: string | null;
  sub_sectors: { id: string; name: string }[];
  upcoming_events: { name: string; slug: string; date_debut: string }[];
}

interface Suggestion {
  label: string;
  generic: boolean;
  theme_code: string | null;
  precisions: string[];
}

const DRAFT_KEY = 'assistant_onboarding_draft';
const DRAFT_MAX_MS = 2 * 60 * 60 * 1000;
const MAX_INTERESTS = 12;
const MAX_ROLES = 4;
const MAX_MORE_REQUESTS = 4;

const GOALS: { value: string; label: string }[] = [
  { value: 'fournisseurs', label: 'Trouver des fournisseurs' },
  { value: 'clients', label: 'Rencontrer des clients ou des prospects' },
  { value: 'veille', label: 'Faire de la veille' },
  { value: 'formation', label: 'Me former' },
  { value: 'partenaires', label: 'Trouver des partenaires' },
];

const rpc = (fn: string, args: Record<string, unknown> = {}) => (supabase as any).rpc(fn, args);
const parse = (d: any) => (typeof d === 'string' ? JSON.parse(d) : d);

async function readFnError(error: any): Promise<{ code?: string; message?: string }> {
  try {
    const body = await error?.context?.json?.();
    return { code: body?.code, message: body?.error ?? body?.message };
  } catch {
    return {};
  }
}

function loadDraft(): { answers: Answers; step: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.at !== 'number' || Date.now() - v.at > DRAFT_MAX_MS) return null;
    const a = { ...EMPTY, ...v.answers };
    // Brouillon ancien : un seul rôle (role_code)
    if (typeof v.answers?.role_code === 'string' && !(Array.isArray(v.answers?.role_codes) && v.answers.role_codes.length)) {
      a.role_codes = [v.answers.role_code];
    }
    delete (a as any).role_code;
    if (!Array.isArray(a.role_codes)) a.role_codes = [];
    if (typeof a.role_other !== 'string') a.role_other = '';
    return { answers: a, step: Number(v.step) || 1 };
  } catch {
    return null;
  }
}

function saveDraft(answers: Answers, step: number) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, step, at: Date.now() }));
  } catch {
    /* stockage indisponible */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* stockage indisponible */
  }
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled && !selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40',
        selected ? 'bg-primary text-primary-foreground' : 'bg-background text-primary hover:bg-violet-soft',
      )}
    >
      {selected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="break-words">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------
export default function AssistantOnboarding() {
  const { session, loading, isRealUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editMode = params.get('modifier') === '1';
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: feed, refetch: refetchFeed } = useAssistantFeed();

  const draft = useMemo(() => loadDraft(), []);
  const [answers, setAnswers] = useState<Answers>(draft?.answers ?? EMPTY);
  const [step, setStep] = useState<number>(draft?.step ?? 1);
  const prefilled = useRef(!!draft);
  const total = isRealUser ? 6 : 7;
  const update = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }));

  // Session : anonyme si personne n'est connecté
  const [startError, setStartError] = useState(false);
  const [starting, setStarting] = useState(false);
  const startSession = useCallback(async () => {
    setStarting(true);
    setStartError(false);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) setStartError(true);
    setStarting(false);
  }, []);
  useEffect(() => {
    if (!loading && !session && !starting && !startError) void startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  // Brouillon
  useEffect(() => {
    saveDraft(answers, step);
  }, [answers, step]);

  useEffect(() => {
    if (step > total) setStep(total);
  }, [step, total]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Rôles
  const { data: roles } = useQuery({
    queryKey: ['assistant-roles'],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('assistant_roles')
        .select('code, label, position')
        .order('position');
      if (error) throw error;
      return (data ?? []) as { code: string; label: string; position: number }[];
    },
  });
  const [otherOn, setOtherOn] = useState<boolean>(() => !!draft?.answers.role_other);
  const otherText = answers.role_other.trim();
  const roleLabel = [
    ...answers.role_codes.map((c) => roles?.find((r) => r.code === c)?.label).filter((l): l is string => !!l),
    ...(otherOn && otherText ? [otherText] : []),
  ].join(', ');

  // Mode « Modifier » : réponses pré-remplies depuis l'assistant existant
  useEffect(() => {
    if (!editMode || prefilled.current || !feed?.has_profile || !feed.profile) return;
    prefilled.current = true;
    const p = feed.profile as any;
    const codes: string[] = Array.isArray(p.role_codes) && p.role_codes.length ? p.role_codes : p.role_code ? [p.role_code] : [];
    setAnswers({
      company_ref: p.company_ref ?? null,
      company_name: p.company_name ?? '',
      company_description: p.company_description ?? '',
      sub_sector_ids: p.sub_sector_ids ?? [],
      role_codes: codes,
      role_other: p.role_other ?? '',
      interests: p.interests ?? [],
      goals: p.goals ?? [],
      region_codes: p.region_codes ?? [],
    });
    setOtherOn(!!p.role_other);
    setStep(3);
  }, [editMode, feed]);

  // ---------------------------------------------------------------------------------------------
  // Enregistrement du profil
  // ---------------------------------------------------------------------------------------------
  const upsertProfile = useCallback(
    async (onboarded: boolean) => {
      const label = [roleLabel, answers.company_name.trim()].filter(Boolean).join(' · ') || null;
      const { data, error } = await rpc('assistant_upsert_my_profile', {
        p_label: label,
        p_company_name: answers.company_name.trim() || null,
        p_company_description: answers.company_description.trim() || null,
        p_company_ref: answers.company_ref,
        p_sub_sector_ids: answers.sub_sector_ids,
        p_role_code: answers.role_codes[0] ?? null,
        p_interests: answers.interests,
        p_goals: answers.goals,
        p_city: null,
        p_radius_km: null,
        p_onboarded: onboarded,
      });
      if (error) throw error;
      const rolesRes = await rpc('assistant_set_my_roles', {
        p_role_codes: answers.role_codes,
        p_role_other: otherOn && otherText ? otherText : null,
      });
      if (rolesRes.error) throw rolesRes.error;
      return parse(data) as { profile_id: string; claim_token: string; is_new: boolean };
    },
    [answers, roleLabel, otherOn, otherText],
  );

  // ---------------------------------------------------------------------------------------------
  // Écran 1 : entreprise
  // ---------------------------------------------------------------------------------------------
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirm, setConfirm] = useState<CompanyContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  useEffect(() => {
    if (step !== 1 || manual || confirm) return;
    const q = query.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await rpc('leadmagnet_resolve_candidates', { p_query: q, p_limit: 6 });
        setCandidates((parse(data)?.candidates ?? []) as Candidate[]);
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, step, manual, confirm]);

  const pickCandidate = async (c: Candidate) => {
    if (!c.id_exposant) {
      setManual(true);
      setManualName(c.nom);
      setManualDesc(c.description ?? '');
      return;
    }
    setLoadingContext(true);
    try {
      const { data } = await rpc('assistant_company_context', { p_company_ref: c.id_exposant });
      const ctx = parse(data) as CompanyContext | null;
      setConfirm(
        ctx ?? {
          company_ref: c.id_exposant,
          name: c.nom,
          description: c.description,
          website: c.domaine,
          sub_sectors: [],
          upcoming_events: [],
        },
      );
    } finally {
      setLoadingContext(false);
    }
  };

  const acceptCompany = () => {
    if (!confirm) return;
    update({
      company_ref: confirm.company_ref,
      company_name: confirm.name,
      company_description: confirm.description ?? '',
      sub_sector_ids: (confirm.sub_sectors ?? []).map((s) => s.id),
    });
    setConfirm(null);
    setStep(2);
  };

  const manualValid = manualName.trim().length > 0 && manualDesc.trim().length >= 10;
  const acceptManual = () => {
    update({
      company_ref: null,
      company_name: manualName.trim(),
      company_description: manualDesc.trim(),
      sub_sector_ids: [],
    });
    setStep(2);
  };

  const skipCompany = () => {
    update({ company_ref: null, company_name: '', company_description: '', sub_sector_ids: [] });
    setStep(2);
  };

  // ---------------------------------------------------------------------------------------------
  // Écran 3 : sujets
  // ---------------------------------------------------------------------------------------------
  const suggestKey = `${answers.company_name}|${answers.role_code}|${answers.sub_sector_ids.join(',')}`;
  const [sugg, setSugg] = useState<{ key: string; list: Suggestion[]; failed: boolean } | null>(null);
  const [suggLoading, setSuggLoading] = useState(false);
  const [openGeneric, setOpenGeneric] = useState<string | null>(null);
  const [freeTopic, setFreeTopic] = useState('');

  useEffect(() => {
    if (step !== 3 || !session || suggLoading || sugg?.key === suggestKey) return;
    let cancelled = false;
    setSuggLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('assistant-onboarding', {
          body: {
            action: 'interests',
            company_name: answers.company_name || null,
            company_description: answers.company_description || null,
            sub_sector_ids: answers.sub_sector_ids,
            role_code: answers.role_code,
          },
        });
        if (error) throw error;
        if (!cancelled) setSugg({ key: suggestKey, list: (data?.suggestions ?? []) as Suggestion[], failed: false });
      } catch {
        if (!cancelled) setSugg({ key: suggestKey, list: [], failed: true });
      } finally {
        if (!cancelled) setSuggLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setSuggLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, session, suggestKey]);

  const full = answers.interests.length >= MAX_INTERESTS;
  const toggleInterest = (label: string) => {
    setAnswers((a) =>
      a.interests.includes(label)
        ? { ...a, interests: a.interests.filter((x) => x !== label) }
        : a.interests.length >= MAX_INTERESTS
          ? a
          : { ...a, interests: [...a.interests, label] },
    );
  };
  const addFreeTopic = () => {
    const t = freeTopic.trim();
    if (!t) return;
    if (!answers.interests.includes(t) && !full) update({ interests: [...answers.interests, t] });
    setFreeTopic('');
  };
  const suggLabels = new Set((sugg?.list ?? []).flatMap((s) => [s.label, ...(s.precisions ?? [])]));
  const customInterests = answers.interests.filter((i) => !suggLabels.has(i));

  // ---------------------------------------------------------------------------------------------
  // Écran 5 : régions + enregistrement
  // ---------------------------------------------------------------------------------------------
  const [saving5, setSaving5] = useState(false);
  const [error5, setError5] = useState<string | null>(null);
  const submitRegions = async () => {
    setSaving5(true);
    setError5(null);
    try {
      const res = await upsertProfile(isRealUser);
      const { error } = await rpc('assistant_set_my_regions', { p_region_codes: answers.region_codes });
      if (error) throw error;
      if (!isRealUser && res?.profile_id && res?.claim_token) savePendingClaim(res.profile_id, res.claim_token);
      setStep(6);
    } catch {
      setError5('Enregistrement impossible pour le moment. Réessayez.');
    } finally {
      setSaving5(false);
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Écran 6 : sujets de recherche et premiers résultats
  // ---------------------------------------------------------------------------------------------
  const [phaseA, setPhaseA] = useState<'idle' | 'running' | 'done'>('idle');
  const [phaseB, setPhaseB] = useState<'idle' | 'running' | 'done'>('idle');
  const [bError, setBError] = useState<{ kind: 'quota' | 'other'; message?: string } | null>(null);
  const [pistesChanged, setPistesChanged] = useState(false);
  const [editingPiste, setEditingPiste] = useState<string | null>(null);
  const [pisteDraft, setPisteDraft] = useState('');
  const [pisteBusy, setPisteBusy] = useState(false);

  const runB = useCallback(async () => {
    setPhaseB('running');
    setBError(null);
    setPistesChanged(false);
    try {
      const { error } = await supabase.functions.invoke('assistant-pepites', { body: { step: 'match', preview: true } });
      if (error) {
        const e = await readFnError(error);
        setBError(e.code === 'quota' ? { kind: 'quota', message: e.message } : { kind: 'other' });
      }
    } catch {
      setBError({ kind: 'other' });
    }
    await refetchFeed();
    setPhaseB('done');
  }, [refetchFeed]);

  const runA = useCallback(async () => {
    setPhaseA('running');
    setBError(null);
    try {
      const { error } = await supabase.functions.invoke('assistant-pepites', { body: { step: 'pistes' } });
      if (error) {
        const e = await readFnError(error);
        if (e.code === 'quota') setBError({ kind: 'quota', message: e.message });
      }
    } catch {
      /* l'assistant refera la recherche plus tard */
    }
    await refetchFeed();
    setPhaseA('done');
    void runB();
  }, [refetchFeed, runB]);

  useEffect(() => {
    if (step === 6 && session && phaseA === 'idle') void runA();
  }, [step, session, phaseA, runA]);

  const pistes = feed?.pistes ?? [];
  const markChanged = () => {
    if (phaseB !== 'idle') setPistesChanged(true);
  };
  const savePiste = async (id: string) => {
    const label = pisteDraft.trim();
    if (!label) return;
    setPisteBusy(true);
    try {
      const { error } = await rpc('assistant_update_my_piste', { p_piste_id: id, p_label: label });
      if (error) throw error;
      await refetchFeed();
      setEditingPiste(null);
      markChanged();
    } catch {
      toast({ title: 'Action impossible pour le moment. Réessayez.', variant: 'destructive' });
    } finally {
      setPisteBusy(false);
    }
  };
  const removePiste = async (id: string) => {
    setPisteBusy(true);
    try {
      const { error } = await rpc('assistant_delete_my_piste', { p_piste_id: id });
      if (error) throw error;
      await refetchFeed();
      markChanged();
    } catch {
      toast({ title: 'Action impossible pour le moment. Réessayez.', variant: 'destructive' });
    } finally {
      setPisteBusy(false);
    }
  };

  const finish = () => {
    clearDraft();
    qc.invalidateQueries({ queryKey: ['assistant-feed'] });
    toast({ title: 'Votre assistant veille', description: 'Je vous écris dès que quelque chose vaut le déplacement.' });
    navigate('/agenda');
  };

  // ---------------------------------------------------------------------------------------------
  // Écran 7 : compte
  // ---------------------------------------------------------------------------------------------
  const [optIn, setOptIn] = useState(false);
  const [email, setEmail] = useState('');
  const [busy7, setBusy7] = useState<'google' | 'email' | null>(null);
  const [error7, setError7] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const prepareClaim = async (): Promise<string> => {
    const res = await upsertProfile(true);
    await rpc('assistant_set_email_alerts', { p_opt_in: optIn });
    savePendingClaim(res.profile_id, res.claim_token);
    return `${window.location.origin}/agenda?assistant=bienvenue&claim=${claimParam(res.profile_id, res.claim_token)}`;
  };

  const withGoogle = async () => {
    setBusy7('google');
    setError7(null);
    try {
      const redirectTo = await prepareClaim();
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
    } catch {
      setError7('Connexion impossible pour le moment. Réessayez.');
      setBusy7(null);
    }
  };

  const sendLink = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError7('Saisissez une adresse email valide.');
      return;
    }
    setBusy7('email');
    setError7(null);
    try {
      const full = await prepareClaim();
      const next = full.startsWith(window.location.origin) ? full.slice(window.location.origin.length) : '/agenda';
      const err = await requestLoginLink(e, next);
      if (err) {
        setError7(err);
      } else {
        setSentTo(e);
        setResendIn(60);
      }
    } catch {
      setError7('Envoi impossible pour le moment. Réessayez dans un instant.');
    } finally {
      setBusy7(null);
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------------------------
  const back = () => {
    if (step === 1 && (confirm || manual)) {
      setConfirm(null);
      setManual(false);
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  let continueLabel = 'Continuer';
  let continueDisabled = false;
  let onContinue: (() => void) | null = () => setStep((s) => s + 1);
  if (step === 1) {
    if (confirm) {
      onContinue = null;
    } else if (manual) {
      continueDisabled = !manualValid;
      onContinue = acceptManual;
    } else {
      continueDisabled = !answers.company_name;
      onContinue = () => setStep(2);
    }
  } else if (step === 2) {
    continueDisabled = !answers.role_code;
  } else if (step === 3) {
    continueDisabled = answers.interests.length === 0;
  } else if (step === 5) {
    continueLabel = saving5 ? 'Enregistrement…' : 'Continuer';
    continueDisabled = saving5;
    onContinue = submitRegions;
  } else if (step === 6) {
    continueDisabled = phaseA !== 'done';
    if (isRealUser) {
      continueLabel = 'Terminer';
      onContinue = finish;
    }
  } else if (step === 7) {
    onContinue = null;
  }

  const companyLabel = answers.company_name.trim() || 'vous';

  // ---------------------------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------------------------
  const Heading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="mb-6">
      <h1 className="heading-display text-[28px] leading-tight text-foreground sm:text-[34px]">{title}</h1>
      {subtitle && <p className="mt-2 text-[17px] text-muted-foreground">{subtitle}</p>}
    </div>
  );

  let body: React.ReactNode = null;

  if (loading || (!session && !startError)) {
    body = (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Un instant…
      </div>
    );
  } else if (!session && startError) {
    body = (
      <div className="space-y-4 py-12">
        <p className="text-[17px] text-foreground">Impossible de démarrer pour le moment. Réessayez dans un instant.</p>
        <Button className="min-h-12" onClick={startSession} disabled={starting}>
          Réessayer
        </Button>
      </div>
    );
  } else if (step === 1) {
    body = (
      <>
        <Heading title="Dans quelle entreprise travaillez-vous ?" subtitle="Je m'en sers pour comprendre votre métier." />
        {confirm ? (
          <div className="space-y-4 rounded-xl border-2 border-primary bg-card p-5">
            <p className="break-words text-lg font-bold text-foreground">{confirm.name}</p>
            {confirm.description && <p className="line-clamp-2 text-[15px] text-muted-foreground">{confirm.description}</p>}
            {confirm.upcoming_events?.length > 0 && (
              <p className="text-sm font-medium text-primary">
                Expose à {confirm.upcoming_events.length} salon{confirm.upcoming_events.length > 1 ? 's' : ''} à venir
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="min-h-12" onClick={acceptCompany}>
                Oui, c'est mon entreprise
              </Button>
              <Button variant="outline" className="min-h-12" onClick={() => setConfirm(null)}>
                Non, une autre
              </Button>
            </div>
          </div>
        ) : manual ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ob-name" className="text-sm font-semibold text-foreground">
                Nom de l'entreprise
              </label>
              <Input id="ob-name" className="h-12 text-base" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ob-desc" className="text-sm font-semibold text-foreground">
                Que fait-elle, en une phrase ?
              </label>
              <Textarea id="ob-desc" rows={3} className="text-base" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                autoFocus
                aria-label="Nom de votre entreprise"
                placeholder="Nom de votre entreprise"
                className="h-[52px] pl-12 text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {(searching || loadingContext) && (
                <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
              )}
            </div>
            {answers.company_name && query.trim().length < 2 && (
              <p className="text-sm text-muted-foreground">
                Choix actuel : <span className="font-semibold text-foreground">{answers.company_name}</span>
              </p>
            )}
            {candidates.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {candidates.map((c, i) => (
                  <li key={`${c.id_exposant ?? c.nom}-${i}`}>
                    <button
                      type="button"
                      onClick={() => pickCandidate(c)}
                      disabled={loadingContext}
                      className="flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left hover:bg-violet-soft focus-visible:bg-violet-soft focus-visible:outline-none"
                    >
                      <span className="break-words font-bold text-foreground">{c.nom}</span>
                      {c.domaine && <span className="break-all text-sm text-muted-foreground">{c.domaine}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col items-start gap-1 pt-1">
              <Button
                variant="link"
                className="min-h-11 px-0"
                onClick={() => {
                  setManual(true);
                  setManualName(query.trim());
                }}
              >
                Mon entreprise n'est pas dans la liste
              </Button>
              <Button variant="link" className="min-h-11 px-0 text-muted-foreground" onClick={skipCompany}>
                Passer cette question
              </Button>
            </div>
          </div>
        )}
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <Heading title="Quel est votre rôle ?" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(roles ?? []).map((r) => {
            const on = answers.role_code === r.code;
            return (
              <button
                key={r.code}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  update({ role_code: r.code });
                  setStep(3);
                }}
                className={cn(
                  'flex min-h-14 items-center justify-between gap-2 rounded-xl border-2 px-4 text-left text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-primary bg-violet-soft text-foreground' : 'border-border bg-card text-foreground hover:border-primary',
                )}
              >
                <span className="break-words">{r.label}</span>
                {on && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
              </button>
            );
          })}
          {!roles && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </>
    );
  } else if (step === 3) {
    const showFailed = sugg?.key === suggestKey && sugg.failed;
    body = (
      <>
        <Heading
          title="Qu'est-ce qui vous intéresse en ce moment ?"
          subtitle={`Choisissez autant de sujets que vous voulez (${MAX_INTERESTS} au plus).`}
        />
        {suggLoading || (sugg?.key !== suggestKey && !showFailed) ? (
          <div className="space-y-3">
            <p className="text-[15px] text-muted-foreground">Je prépare des propositions…</p>
            <div className="flex flex-wrap gap-2">
              {[140, 180, 120, 200, 150, 170].map((w, i) => (
                <div key={i} className="h-[42px] animate-pulse rounded-full bg-muted" style={{ width: w }} />
              ))}
            </div>
          </div>
        ) : showFailed ? (
          <p className="text-[15px] text-muted-foreground">Saisissez vos sujets librement.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {sugg!.list.map((s) => {
                const isGeneric = s.generic && (s.precisions?.length ?? 0) > 0;
                const precisionPicked = (s.precisions ?? []).some((p) => answers.interests.includes(p));
                const selected = answers.interests.includes(s.label) || precisionPicked;
                return (
                  <Chip
                    key={s.label}
                    selected={selected}
                    disabled={full}
                    onClick={() => {
                      if (isGeneric) setOpenGeneric((o) => (o === s.label ? null : s.label));
                      else toggleInterest(s.label);
                    }}
                  >
                    {s.label}
                  </Chip>
                );
              })}
            </div>
            {openGeneric &&
              (() => {
                const s = sugg!.list.find((x) => x.label === openGeneric);
                if (!s) return null;
                return (
                  <div className="space-y-2 rounded-xl bg-violet-soft p-4">
                    <p className="text-[15px] font-semibold text-foreground">{s.label}, plutôt pour :</p>
                    <div className="flex flex-wrap gap-2">
                      {s.precisions.map((p) => (
                        <Chip key={p} selected={answers.interests.includes(p)} disabled={full} onClick={() => toggleInterest(p)}>
                          {p}
                        </Chip>
                      ))}
                    </div>
                    <Button
                      variant="link"
                      className="min-h-11 px-0"
                      disabled={full && !answers.interests.includes(s.label)}
                      onClick={() => toggleInterest(s.label)}
                    >
                      {answers.interests.includes(s.label) ? `Retirer « ${s.label} »` : `Garder « ${s.label} » tel quel`}
                    </Button>
                  </div>
                );
              })()}
          </div>
        )}
        {customInterests.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {customInterests.map((i) => (
              <Chip key={i} selected onClick={() => toggleInterest(i)}>
                {i}
              </Chip>
            ))}
          </div>
        )}
        <form
          className="mt-6 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            addFreeTopic();
          }}
        >
          <Input
            aria-label="Un autre sujet ?"
            placeholder="Un autre sujet ?"
            className="h-12 text-base"
            value={freeTopic}
            onChange={(e) => setFreeTopic(e.target.value)}
            disabled={full}
          />
          <Button type="submit" variant="outline" className="min-h-12" disabled={full || !freeTopic.trim()}>
            Ajouter
          </Button>
        </form>
      </>
    );
  } else if (step === 4) {
    body = (
      <>
        <Heading title="Qu'allez-vous chercher sur un salon ?" subtitle="Plusieurs réponses possibles." />
        <div className="space-y-2">
          {GOALS.map((g) => {
            const on = answers.goals.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() =>
                  update({ goals: on ? answers.goals.filter((x) => x !== g.value) : [...answers.goals, g.value] })
                }
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-primary bg-violet-soft' : 'border-border bg-card hover:border-primary',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground',
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                </span>
                <span className="text-foreground">{g.label}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (step === 5) {
    body = (
      <>
        <Heading
          title="Où êtes-vous prêt à aller ?"
          subtitle="Je ne vous proposerai que les salons de ces régions. Vous pourrez changer d'avis."
        />
        <RegionPicker value={answers.region_codes} onChange={(codes) => update({ region_codes: codes })} />
        {error5 && (
          <p role="alert" className="mt-4 text-[15px] text-destructive">
            {error5}
          </p>
        )}
      </>
    );
  } else if (step === 6) {
    const shownSuggestions = (feed?.suggestions ?? []).slice(0, 3);
    body = (
      <>
        <Heading
          title="Voici ce que je vais chercher pour vous"
          subtitle={`Pour ${companyLabel}, d'après vos réponses. Modifiez ou retirez un sujet si besoin.`}
        />
        {phaseA !== 'done' ? (
          <div className="flex items-center gap-3 rounded-xl bg-card p-5">
            <span className="h-3 w-3 animate-pulse rounded-full bg-primary" aria-hidden />
            <span className="text-[15px] text-foreground">Je prépare vos sujets de recherche…</span>
          </div>
        ) : (
          <div className="rounded-xl bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Vos {pistes.length} sujets de recherche
            </p>
            <ol className="space-y-2">
              {pistes.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {editingPiste === p.id ? (
                    <form
                      className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void savePiste(p.id);
                      }}
                    >
                      <Input
                        autoFocus
                        aria-label="Sujet de recherche"
                        className="h-11 text-base"
                        value={pisteDraft}
                        onChange={(e) => setPisteDraft(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" className="min-h-11" disabled={pisteBusy || !pisteDraft.trim()}>
                          Enregistrer
                        </Button>
                        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setEditingPiste(null)}>
                          Annuler
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 break-words text-[17px] font-semibold text-foreground">{p.label}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        aria-label={`Modifier « ${p.label} »`}
                        onClick={() => {
                          setEditingPiste(p.id);
                          setPisteDraft(p.label);
                        }}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        aria-label={`Retirer « ${p.label} »`}
                        disabled={pistes.length <= 1 || pisteBusy}
                        onClick={() => removePiste(p.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {phaseA === 'done' && (
          <section className="mt-8 space-y-4">
            <h2 className="heading-display text-[26px] leading-tight text-foreground">Déjà trouvé pour vous</h2>
            {phaseB === 'running' && (
              <div className="flex items-center gap-3 rounded-xl bg-violet-soft p-4">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                <span className="text-[15px] text-foreground">Je lis les programmes et les Nouveautés des deux prochains mois…</span>
              </div>
            )}
            {bError?.kind === 'quota' && (
              <div className="rounded-xl border border-warning bg-warning/10 p-4 text-[15px] text-foreground">
                {bError.message}
              </div>
            )}
            {bError?.kind === 'other' && (
              <div className="rounded-xl border border-warning bg-warning/10 p-4 text-[15px] text-foreground">
                La recherche n'a pas abouti. Votre assistant la refera dans quelques minutes.
              </div>
            )}
            {pistesChanged && phaseB !== 'running' && (
              <Button variant="link" className="min-h-11 px-0" onClick={() => void runB()}>
                Relancer la recherche avec ces sujets
              </Button>
            )}
            {phaseB === 'done' && !bError &&
              (shownSuggestions.length > 0 ? (
                <div className="space-y-5">
                  {shownSuggestions.map((s) => (
                    <AssistantEventCard key={s.event.id} suggestion={s} readOnly />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-card p-5 text-[15px] text-foreground">
                  Rien ne vaut encore le déplacement sur vos prochains salons. Je vous préviendrai dès que ça change.
                </div>
              ))}
          </section>
        )}
      </>
    );
  } else if (step === 7) {
    body = (
      <>
        <Heading
          title="Pour que je puisse vous prévenir"
          subtitle="Créez votre compte en un clic. Votre assistant y sera rattaché, avec tout ce qu'il a trouvé."
        />
        {sentTo ? (
          <div className="space-y-4 rounded-xl bg-card p-5">
            <p className="text-[17px] text-foreground">
              Vérifiez votre boîte mail. Un lien de connexion vous attend à <span className="break-all font-semibold">{sentTo}</span>. Il est
              valable une heure. Pensez à regarder dans les courriers indésirables.
            </p>
            <Button variant="outline" className="min-h-11" disabled={resendIn > 0 || busy7 !== null} onClick={sendLink}>
              {resendIn > 0 ? `Renvoyer le lien (${resendIn} s)` : 'Renvoyer le lien'}
            </Button>
            {error7 && (
              <p role="alert" className="text-[15px] text-destructive">
                {error7}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-card p-4">
              <Checkbox checked={optIn} onCheckedChange={(v) => setOptIn(v === true)} className="mt-0.5 h-5 w-5" />
              <span className="text-[15px] text-foreground">
                Recevoir par email les alertes de mon assistant. Désinscription en un clic.
              </span>
            </label>

            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full gap-2 bg-background"
              disabled={busy7 !== null}
              onClick={withGoogle}
            >
              {busy7 === 'google' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GoogleIcon />}
              Continuer avec Google
            </Button>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void sendLink();
              }}
            >
              <label htmlFor="ob-email" className="text-sm font-semibold text-foreground">
                Votre email professionnel
              </label>
              <Input
                id="ob-email"
                type="email"
                autoComplete="email"
                className="h-12 text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" className="min-h-12 w-full" disabled={busy7 !== null || !email.trim()}>
                {busy7 === 'email' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Recevoir mon lien de connexion
              </Button>
            </form>
            {error7 && (
              <p role="alert" className="text-[15px] text-destructive">
                {error7}
              </p>
            )}
            <Link
              to={`/auth?redirect=${encodeURIComponent('/agenda?assistant=bienvenue')}`}
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-2"
            >
              J'ai déjà un compte avec mot de passe
            </Link>
          </div>
        )}
      </>
    );
  }

  const ready = !!session && !loading;
  const showBack = ready && step > 1 || (step === 1 && (confirm || manual));
  const showNav = ready && (showBack || onContinue);

  return (
    <MainLayout title="Créer mon assistant salons">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="-mx-6 min-h-[70vh] bg-muted/40">
        <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-8 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-bold text-primary">
                Étape {Math.min(step, total)} sur {total}
              </span>
              <Link
                to="/agenda"
                className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
                Quitter
              </Link>
            </div>
            <div
              role="progressbar"
              aria-label="Progression"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={Math.min(step, total)}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(Math.min(step, total) / total) * 100}%` }}
              />
            </div>
          </div>

          {body}

          {showNav && (
            <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center gap-3 bg-background p-3 shadow-[0_-2px_8px_hsl(var(--foreground)/0.08)] sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              {showBack ? (
                <Button variant="ghost" className="min-h-12 shrink-0" onClick={back}>
                  Retour
                </Button>
              ) : (
                <span />
              )}
              {onContinue && (
                <Button
                  className="min-h-12 flex-1 sm:ml-auto sm:flex-none sm:px-8"
                  disabled={continueDisabled}
                  onClick={() => void onContinue?.()}
                >
                  {step === 5 && saving5 && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {continueLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
