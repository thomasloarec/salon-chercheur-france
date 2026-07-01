import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowRight, Calendar, MapPin, Plus, Radar, Upload, Building2, Sparkles,
  CalendarPlus, Flame, AlertCircle, ExternalLink, History, ChevronDown, ChevronUp,
  CalendarCheck, Settings, Lock, Mail, Clock, Star, EyeOff, Eye,
} from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import { toast } from '@/hooks/use-toast';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { ExhibitorDetailDialog } from '@/components/event/ExhibitorDetailDialog';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { cn } from '@/lib/utils';
import RadarCrmSettingsDialog from '@/components/radar-crm/RadarCrmSettingsDialog';
import AccessRequestDialog from '@/components/radar-crm/AccessRequestDialog';
import {
  type RelationshipStatus, RELATIONSHIP_ORDER, RELATIONSHIP_META,
  companyKeyFor, normalizeRelationship, DEFAULT_RELATIONSHIP,
} from '@/lib/radarCrm/relationship';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

type Import = {
  id: string;
  file_name: string | null;
  status: string;
  total_rows: number | null;
  matched_companies_count: number | null;
  unmatched_companies_count: number | null;
  created_at: string;
};

type Company = {
  id: string;
  company_name: string;
  website_raw: string | null;
  normalized_domain: string | null;
};

/**
 * Shape returned by the server-side RPC `get_my_radar_view`.
 * Defined locally because the RPC is typed as `Json` in the generated Supabase types.
 */
type RadarStatus = 'paid' | 'beta' | 'trial_active' | 'trial_expired' | 'free' | 'none';

/** Per-account watch preference (P1-c triage). */
type Pref = 'starred' | 'ignored' | 'normal';

interface RadarViewCompany {
  crm_company_id: string;
  company_name: string | null;
  website_raw: string | null;
  normalized_domain: string | null;
  id_exposant: string | null;
  nom_exposant: string | null;
  stand_exposants_list: string | null;
  needs_review: boolean | null;
  name_similarity: number | null;
  pref_status: Pref | null;
}

interface RadarViewEvent {
  event_id: string;
  nom_event: string | null;
  slug: string | null;
  url_image: string | null;
  type_event: string | null;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  nom_lieu: string | null;
  days_until_event: number | null;
  is_future_event: boolean | null;
  company_count: number;
  companies: RadarViewCompany[];
}

interface RadarView {
  has_access: boolean;
  status: RadarStatus;
  days_left: number | null;
  import_id: string | null;
  summary: {
    companies_analyzed: number;
    companies_detected: number;
    future_companies: number;
    future_salons: number;
    future_participations: number;
    starred?: number;
    ignored?: number;
  };
  events: RadarViewEvent[];
}

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const eventInitials = (name: string | null | undefined) => {
  if (!name) return '??';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

const companyInitials = (name: string) =>
  name.split(/[\s\-_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Aggregated event with all CRM matches */
interface EventGroup {
  event_id: string;
  slug: string | null;
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  nom_lieu: string | null;
  url_image: string | null;
  days_until: number | null;
  is_future: boolean;
  company_count: number;
  companies: Array<{
    company: Company;
    id_exposant: string;
    nom_exposant: string | null;
    stand: string | null;
    needs_review: boolean;
    name_similarity: number | null;
    pref_status: Pref | null;
  }>;
}

/** Map a RPC event payload to the existing EventGroup shape used by all cards. */
const mapEventToGroup = (e: RadarViewEvent): EventGroup => ({
  event_id: e.event_id,
  slug: e.slug,
  nom_event: e.nom_event ?? 'Événement',
  date_debut: e.date_debut,
  date_fin: e.date_fin,
  ville: e.ville,
  nom_lieu: e.nom_lieu,
  url_image: e.url_image,
  days_until: e.days_until_event,
  is_future: e.is_future_event ?? false,
  company_count: e.company_count,
  companies: (e.companies ?? []).map((c) => ({
    company: {
      id: c.crm_company_id,
      company_name: c.company_name ?? '',
      website_raw: c.website_raw,
      normalized_domain: c.normalized_domain,
    },
    id_exposant: c.id_exposant ?? '',
    nom_exposant: c.nom_exposant,
    stand: c.stand_exposants_list,
    needs_review: c.needs_review === true,
    name_similarity: c.name_similarity ?? null,
    pref_status: c.pref_status ?? null,
  })),
});

const RadarCrmResults: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imports, setImports] = useState<Import[] | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(searchParams.get('importId'));
  const highlightedEventId = searchParams.get('eventId');
  const [radarView, setRadarView] = useState<RadarView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openExhibitor, setOpenExhibitor] = useState<{
    exhibitor: any;
    event: any;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  // Vue par compte = vue par défaut (cadrage « veille »).
  // Si un événement est mis en avant (deep-link), on ouvre la vue par salon pour préserver le scroll auto.
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('eventId') ? 'future' : 'companies');

  const reloadAll = async () => {
    setActiveImportId(null);
    setRadarView(null);
    const { data } = await supabase
      .from('crm_imports')
      .select('id, file_name, status, total_rows, matched_companies_count, unmatched_companies_count, created_at')
      .order('created_at', { ascending: false });
    setImports((data ?? []) as Import[]);
    if (data && data.length > 0) setActiveImportId(data[0].id);
  };

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent('/radar-crm/results')}`);
    }
  }, [user, authLoading, navigate]);

  // Load imports
  useEffect(() => {
    if (!user) return;
    void trackRadarEvent('crm_results_viewed');
    (async () => {
      const { data } = await supabase
        .from('crm_imports')
        .select('id, file_name, status, total_rows, matched_companies_count, unmatched_companies_count, created_at')
        .order('created_at', { ascending: false });
      setImports((data ?? []) as Import[]);
      if (!activeImportId && data && data.length > 0) {
        setActiveImportId(data[0].id);
      }
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the full radar view for the active import via the server-side RPC.
  // The RPC enforces entitlement/gating: in a locked state it returns
  // `companies: []` while keeping `company_count` and `summary` populated.
  useEffect(() => {
    if (!activeImportId || !user) return;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_my_radar_view', {
        p_import_id: activeImportId ?? null,
      });
      if (rpcError) {
        console.error('[RadarCRM] get_my_radar_view failed:', rpcError);
        setError(rpcError.message);
        setRadarView(null);
        toast({
          title: 'Erreur de chargement',
          description: "Impossible de charger votre Radar CRM. Réessayez dans un instant.",
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      setRadarView((data as unknown as RadarView) ?? null);
      setLoading(false);
    })();
  }, [activeImportId, user]);

  const status: RadarStatus = radarView?.status ?? 'none';
  const isLocked = status === 'trial_expired' || status === 'free';
  const isTrial = status === 'trial_active';
  const daysLeft = radarView?.days_left ?? null;
  const summary = radarView?.summary;

  const eventGroups: EventGroup[] = useMemo(
    () => (radarView?.events ?? []).map(mapEventToGroup),
    [radarView],
  );

  // ── Triage « étoile / ignorer » (P1-c) ──────────────────────────────
  // pref_status de base (lu depuis la RPC), indexé par crm_company_id.
  const prefByCompany = useMemo(() => {
    const m: Record<string, Pref> = {};
    for (const g of eventGroups) {
      for (const c of g.companies) {
        if (c.pref_status) m[c.company.id] = c.pref_status;
      }
    }
    return m;
  }, [eventGroups]);

  // Surcouche optimiste : appliquée immédiatement, réconciliée à chaque rechargement.
  const [prefOverrides, setPrefOverrides] = useState<Record<string, Pref>>({});
  // On efface les overrides quand une nouvelle vue arrive (les statuts viennent alors de la base).
  useEffect(() => { setPrefOverrides({}); }, [radarView]);

  const getPref = (companyId: string): Pref =>
    prefOverrides[companyId] ?? prefByCompany[companyId] ?? 'normal';

  const setPref = async (companyId: string, next: Pref) => {
    const prev = getPref(companyId);
    if (prev === next) return;
    setPrefOverrides((o) => ({ ...o, [companyId]: next }));
    const { error: rpcErr } = await supabase.rpc('set_radar_company_pref', {
      p_crm_company_id: companyId,
      p_status: next,
    });
    if (rpcErr) {
      console.error('[RadarCRM] set_radar_company_pref failed:', rpcErr);
      setPrefOverrides((o) => ({ ...o, [companyId]: prev }));
      toast({
        title: 'Action impossible',
        description: "Impossible de mettre à jour ce compte. Réessayez dans un instant.",
        variant: 'destructive',
      });
    }
  };

  // ── Statut relationnel par compte (RUN 3) ───────────────────────────
  // Base lue directement depuis radar_company_relationship (RLS = workspace courant),
  // indexée par company_key. Surcouche optimiste réconciliée à chaque rechargement.
  const [relByKey, setRelByKey] = useState<Record<string, RelationshipStatus>>({});
  const [relOverrides, setRelOverrides] = useState<Record<string, RelationshipStatus>>({});

  const loadRelationships = async () => {
    const { data, error: relErr } = await supabase
      .from('radar_company_relationship')
      .select('company_key, relationship_status');
    if (relErr) {
      console.error('[RadarCRM] lecture radar_company_relationship échouée:', relErr);
      return;
    }
    const seen = new Set<string>();
    const m: Record<string, RelationshipStatus> = {};
    for (const r of (data ?? []) as Array<{ company_key: string | null; relationship_status: string | null }>) {
      const key = (r.company_key ?? '').trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) {
        // Doublon de company_key = signal d'un utilisateur multi-workspace : on log sans deviner.
        console.warn('[RadarCRM] company_key en doublon (multi-workspace ?):', key);
      }
      seen.add(key);
      m[key] = normalizeRelationship(r.relationship_status);
    }
    setRelByKey(m);
    setRelOverrides({});
  };

  useEffect(() => {
    if (!user) return;
    void loadRelationships();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const getRel = (company: Company): RelationshipStatus => {
    const key = companyKeyFor(company.normalized_domain, company.company_name);
    return relOverrides[key] ?? relByKey[key] ?? DEFAULT_RELATIONSHIP;
  };

  const setRel = async (company: Company, next: RelationshipStatus) => {
    const key = companyKeyFor(company.normalized_domain, company.company_name);
    const prev = getRel(company);
    if (prev === next) return;
    setRelOverrides((o) => ({ ...o, [key]: next }));
    const { error: rpcErr } = await supabase.rpc('set_radar_company_relationship', {
      p_crm_company_id: company.id,
      p_status: next,
    });
    if (rpcErr) {
      console.error('[RadarCRM] set_radar_company_relationship failed:', rpcErr);
      setRelOverrides((o) => ({ ...o, [key]: prev }));
      toast({
        title: 'Action impossible',
        description: "Impossible de mettre à jour le statut de ce compte. Réessayez dans un instant.",
        variant: 'destructive',
      });
      return;
    }
    void trackRadarEvent('radar_company_relationship_updated', { status: next });
  };

  // ── Profil d'offre : détection « vide » pour le nudge cockpit ────────
  const [offerEmpty, setOfferEmpty] = useState<boolean | null>(null);
  const checkOfferProfile = async () => {
    const { data, error: offErr } = await supabase
      .from('radar_offer_profile')
      .select('sells, target, problem, qualifies')
      .maybeSingle();
    if (offErr) {
      // Multi-workspace / anomalie : ne pas deviner, on masque le nudge.
      console.error('[RadarCRM] lecture radar_offer_profile échouée:', offErr);
      setOfferEmpty(false);
      return;
    }
    const row = data as { sells?: string | null; target?: string | null; problem?: string | null; qualifies?: string | null } | null;
    const empty = !row || ![row.sells, row.target, row.problem, row.qualifies].some((v) => (v ?? '').trim().length > 0);
    setOfferEmpty(empty);
  };
  useEffect(() => {
    if (!user) return;
    void checkOfferProfile();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unique detected companies derived from the event groups (full-access only;
  // empty in a locked state since the RPC strips company identities).
  const matchedCompanies = useMemo(() => {
    const map = new Map<string, Company>();
    for (const g of eventGroups) {
      for (const c of g.companies) {
        if (!map.has(c.company.id)) map.set(c.company.id, c.company);
      }
    }
    return Array.from(map.values());
  }, [eventGroups]);

  const futureGroups = useMemo(
    () => eventGroups.filter((g) => g.is_future)
      .sort((a, b) => {
        // Highlighted event always first
        if (highlightedEventId) {
          if (a.event_id === highlightedEventId && b.event_id !== highlightedEventId) return -1;
          if (b.event_id === highlightedEventId && a.event_id !== highlightedEventId) return 1;
        }
        const da = a.days_until ?? 9999;
        const db = b.days_until ?? 9999;
        if (da !== db) return da - db;
        return b.company_count - a.company_count;
      }),
    [eventGroups, highlightedEventId],
  );
  const pastGroups = useMemo(
    () => eventGroups.filter((g) => !g.is_future)
      .sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? '')),
    [eventGroups],
  );

  // Salon le plus imminent (le plus petit days_until parmi les salons futurs),
  // indépendamment de la mise en avant deep-link — pour le bandeau « radar actif ».
  const nextEvent = useMemo(() => {
    const fut = eventGroups.filter((g) => g.is_future && g.days_until != null);
    if (fut.length === 0) return null;
    return fut.reduce((min, g) => ((g.days_until ?? 9999) < (min.days_until ?? 9999) ? g : min));
  }, [eventGroups]);

  // Encart héros « ancré sur la priorité » :
  //  - s'il existe un compte étoilé avec un salon à venir → le plus imminent d'entre eux ;
  //  - sinon → le salon le plus imminent (libellé explicite).
  const featured = useMemo(() => {
    let best: { event: EventGroup; company: Company; days: number } | null = null;
    for (const g of eventGroups) {
      if (!g.is_future || g.days_until == null) continue;
      for (const c of g.companies) {
        const eff = prefOverrides[c.company.id] ?? prefByCompany[c.company.id] ?? 'normal';
        if (eff !== 'starred') continue;
        if (!best || (g.days_until ?? 9999) < best.days) {
          best = { event: g, company: c.company, days: g.days_until ?? 9999 };
        }
      }
    }
    if (best) return { event: best.event, company: best.company, isPriority: true };
    if (nextEvent) return { event: nextEvent, company: null as Company | null, isPriority: false };
    return null;
  }, [eventGroups, nextEvent, prefOverrides, prefByCompany]);

  // Nombre de comptes étoilés (statut effectif) pour la ligne « Radar actif ».
  const starredCount = useMemo(
    () => matchedCompanies.filter(
      (c) => (prefOverrides[c.id] ?? prefByCompany[c.id] ?? 'normal') === 'starred',
    ).length,
    [matchedCompanies, prefOverrides, prefByCompany],
  );

  // Scroll to highlighted event once results are rendered.
  useEffect(() => {
    if (!highlightedEventId || loading) return;
    // N'active le scroll que si la vue par salon est affichée (sinon les cartes salon ne sont pas montées).
    if (activeTab !== 'future') return;
    if (!eventGroups.find((g) => g.event_id === highlightedEventId)) return;
    const el = document.getElementById(`radar-event-${highlightedEventId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedEventId, loading, eventGroups, activeTab]);

  // KPI values come straight from the server-aggregated summary.
  const kpiAnalyzed = summary?.companies_analyzed ?? 0;
  const kpiDetected = summary?.companies_detected ?? matchedCompanies.length;
  const kpiFutureSalons = summary?.future_salons ?? futureGroups.length;
  const kpiFutureParticipations = summary?.future_participations ?? 0;

  const onClickEvent = (g: EventGroup) => {
    void trackRadarEvent('crm_event_detail_clicked', { eventId: g.event_id });
    void trackRadarEvent('crm_event_clicked', { eventId: g.event_id, source: 'radar_crm' });
    if (g.slug) navigate(`/events/${g.slug}`);
    else toast({ title: 'Page événement indisponible', description: 'Le slug est manquant.' });
  };

  const onOpenExhibitor = (
    company: Company,
    id_exposant: string,
    stand: string | null,
    g: EventGroup,
    nom_exposant: string | null,
    needs_review: boolean,
  ) => {
    void trackRadarEvent('crm_exhibitor_dialog_opened', { eventId: g.event_id, id_exposant });
    setOpenExhibitor({
      exhibitor: {
        id_exposant,
        exhibitor_name: nom_exposant ?? company.company_name,
        crm_company_name: company.company_name,
        needs_review,
        stand_exposant: stand ?? undefined,
        website_exposant: company.website_raw ?? undefined,
      },
      event: {
        id: g.event_id,
        slug: g.slug,
        nom_event: g.nom_event,
        date_debut: g.date_debut,
        date_fin: g.date_fin,
        ville: g.ville,
        nom_lieu: g.nom_lieu,
        url_image: g.url_image,
      },
    });
  };

  // Empty state
  if (!authLoading && imports !== null && imports.length === 0) {
    return (
      <MainLayout title="Mon Radar CRM | Lotexpo">
        <RadarEmptyState />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Mon Radar CRM | Lotexpo">
      <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-10 md:space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                  <Radar className="h-5 w-5" />
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Votre Radar CRM</h1>
              </div>
              <p className="text-muted-foreground text-sm md:text-base max-w-xl">
                {loading ? 'Analyse en cours…' : isLocked ? (
                  <>Votre Radar CRM est prêt — débloquez l'accès pour découvrir vos détections</>
                ) : (
                  <>Pendant que vous travaillez, Radar surveille vos comptes CRM et vous alerte avant chaque salon.</>
                )}
              </p>
            </div>
            {!isLocked && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Settings className="h-4 w-4 mr-2" /> Paramètres Radar CRM
                </Button>
                {imports && imports.length > 1 && (
                  <Select value={activeImportId ?? ''} onValueChange={setActiveImportId}>
                    <SelectTrigger className="w-full sm:w-[240px] max-w-full bg-card">
                      <SelectValue placeholder="Choisir un import" />
                    </SelectTrigger>
                    <SelectContent>
                      {imports.map((imp) => (
                        <SelectItem key={imp.id} value={imp.id}>
                          {imp.file_name ?? 'Sans nom'} — {formatDate(imp.created_at)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/radar-crm">
                    <Plus className="h-4 w-4 mr-2" /> Nouveau fichier CSV
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Trial banner */}
          {isTrial && !loading && (
            <TrialBanner daysLeft={daysLeft} detected={kpiDetected} />
          )}

          {/* Hero stats — masquées en état verrouillé (remplacées par le bandeau agrégé du paywall) */}
          {!isLocked && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              <StatCard label="Entreprises analysées" value={kpiAnalyzed} />
              <StatCard label="Entreprises détectées" value={kpiDetected} accent="accent" />
              <StatCard label="Salons à venir" value={kpiFutureSalons} accent="primary" icon={<Sparkles className="h-4 w-4" />} />
              <StatCard label="Participations futures" value={kpiFutureParticipations} />
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <RadarErrorState onRetry={() => setActiveImportId((id) => id)} />
          ) : isLocked ? (
            <LockedView
              teaserGroups={futureGroups}
              summary={summary}
              onRequestAccess={() => setAccessOpen(true)}
            />
          ) : (
            <>
              {/* Bandeau « radar actif » — cadrage veille/surveillance */}
              <RadarActiveBanner
                analyzed={kpiAnalyzed}
                futureCompanies={summary?.future_companies ?? 0}
                futureSalons={kpiFutureSalons}
                featured={featured}
                starredCount={starredCount}
                onClickEvent={onClickEvent}
                onOpenSettings={() => setSettingsOpen(true)}
              />

              {/* Nudge profil d'offre — discret, disparaît une fois le profil rempli */}
              {offerEmpty === true && (
                <OfferProfileNudge onOpenSettings={() => setSettingsOpen(true)} />
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-card border w-full sm:w-auto justify-start flex-nowrap overflow-x-auto no-scrollbar">
                  <TabsTrigger value="companies" className="whitespace-nowrap">Comptes surveillés ({matchedCompanies.length})</TabsTrigger>
                  <TabsTrigger value="future" className="whitespace-nowrap">Par salon ({futureGroups.length})</TabsTrigger>
                  <TabsTrigger value="past" className="whitespace-nowrap">
                    <History className="h-3.5 w-3.5 mr-1" /> Historique ({pastGroups.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="companies" className="mt-8">
                  <CompanyAccountsList
                    groups={eventGroups}
                    companies={matchedCompanies}
                    onClickEvent={onClickEvent}
                    getPref={getPref}
                    onSetPref={setPref}
                    getRel={getRel}
                    onSetRel={setRel}
                  />
                </TabsContent>

                <TabsContent value="future" className="mt-8">
                  {futureGroups.length === 0 ? (
                    <NoFutureMatches companiesCount={kpiAnalyzed} matchedCount={kpiDetected} />
                  ) : (
                    <div className="space-y-6">
                      {futureGroups.map((g) => (
                        <div
                          key={g.event_id}
                          id={`radar-event-${g.event_id}`}
                          className={cn(
                            'transition-all rounded-lg',
                            highlightedEventId === g.event_id && 'ring-2 ring-primary ring-offset-2',
                          )}
                        >
                          <EventCard
                            group={g}
                            importId={activeImportId}
                            getPref={getPref}
                            getRel={getRel}
                            onView={() => onClickEvent(g)}
                            onCompanyClick={(c, id_exposant, stand, nom_exposant, needs_review) =>
                              onOpenExhibitor(c, id_exposant, stand, g, nom_exposant, needs_review)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="past" className="mt-8">
                  {pastGroups.length === 0 ? (
                    <EmptyText label="Aucun salon passé détecté pour vos comptes surveillés." />
                  ) : (
                    <div className="space-y-6">
                      {pastGroups.map((g) => (
                        <PastEventCard
                          key={g.event_id}
                          group={g}
                          onView={() => onClickEvent(g)}
                          onCompanyClick={(c, id_exposant, stand, nom_exposant, needs_review) =>
                            onOpenExhibitor(c, id_exposant, stand, g, nom_exposant, needs_review)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Detail table (secondary) */}
              {eventGroups.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="detail" className="border rounded-lg bg-card px-4">
                    <AccordionTrigger className="text-sm text-foreground/70 hover:text-foreground">
                      Voir le détail en tableau (avancé)
                    </AccordionTrigger>
                    <AccordionContent>
                      <DetailTable groups={eventGroups} onView={onClickEvent} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </>
          )}
        </div>
      </div>

      {openExhibitor && (
        <ExhibitorDetailDialog
          open={!!openExhibitor}
          onOpenChange={(o) => !o && setOpenExhibitor(null)}
          exhibitor={openExhibitor.exhibitor}
          event={openExhibitor.event}
        />
      )}
      <RadarCrmSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onDataDeleted={() => { void reloadAll(); }}
        onOfferProfileSaved={() => { void checkOfferProfile(); }}
      />
      <AccessRequestDialog open={accessOpen} onOpenChange={setAccessOpen} />
    </MainLayout>
  );
};

/* ────────────────────────── Sub-components ────────────────────────── */

/** Bandeau « radar actif » — cadrage veille : surveillance + imminence + réassurance email. */
const RadarActiveBanner: React.FC<{
  analyzed: number;
  futureCompanies: number;
  futureSalons: number;
  featured: { event: EventGroup; company: Company | null; isPriority: boolean } | null;
  starredCount: number;
  onClickEvent: (g: EventGroup) => void;
  onOpenSettings: () => void;
}> = ({ analyzed, futureCompanies, futureSalons, featured, starredCount, onClickEvent, onOpenSettings }) => {
  const ev = featured?.event ?? null;
  const isPriority = featured?.isPriority ?? false;
  const days = ev?.days_until != null ? Math.max(0, ev.days_until) : null;
  return (
    <Card className="bg-secondary/40 border-border/60 shadow-none">
      <CardContent className="py-6 md:py-7 px-5 md:px-6 space-y-5">
        <div className="flex items-start gap-3">
          <span className="relative flex h-3 w-3 mt-1.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent/50 opacity-75 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-foreground leading-tight">Radar actif</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              On surveille <strong className="text-foreground">{analyzed}</strong> compte{analyzed > 1 ? 's' : ''} de votre CRM.{' '}
              <strong className="text-foreground">{futureCompanies}</strong> exposeront sur{' '}
              <strong className="text-foreground">{futureSalons}</strong> salon{futureSalons > 1 ? 's' : ''} à venir.
              {starredCount > 0 && (
                <> Vous suivez <strong className="text-foreground">{starredCount}</strong> compte{starredCount > 1 ? 's' : ''} en priorité.</>
              )}
            </p>
          </div>
        </div>

        {ev && (
          <button
            type="button"
            onClick={() => onClickEvent(ev)}
            disabled={!ev.slug}
            className="w-full text-left rounded-xl border border-accent/30 bg-card p-4 md:p-5 transition-colors hover:bg-secondary/50 disabled:opacity-60"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-accent flex items-center gap-1.5">
              {isPriority ? <Star className="h-3 w-3 fill-current" /> : <Flame className="h-3 w-3" />}
              {isPriority ? 'Compte prioritaire' : 'Prochain salon'}
            </p>
            {isPriority && featured?.company ? (
              <p className="text-base font-semibold text-foreground mt-2 leading-snug">
                <span className="text-accent">{featured.company.company_name}</span> expose à {ev.nom_event}
                {days != null && <span className="ml-1">dans {days} jour{days > 1 ? 's' : ''}</span>}
                {ev.ville ? ` · ${ev.ville}` : ''}
              </p>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground mt-2 leading-snug">
                  Prochain salon où vos comptes exposent : {ev.nom_event}
                  {days != null && <span className="ml-2 text-accent">dans {days} jour{days > 1 ? 's' : ''}</span>}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {ev.company_count} de vos comptes y exposent
                  {ev.ville ? ` · ${ev.ville}` : ''}
                </p>
              </>
            )}
          </button>
        )}

        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
          Vous êtes alerté par email avant chaque salon concerné.
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-primary hover:underline font-medium"
          >
            Paramètres Radar CRM
          </button>
        </p>
      </CardContent>
    </Card>
  );
};

const StatCard: React.FC<{
  label: string; value: number | string; sub?: string;
  accent?: 'primary' | 'success' | 'accent'; icon?: React.ReactNode;
}> = ({ label, value, sub, accent, icon }) => {
  // Discipline « un seul accent » : seul le chiffre clé (accent) porte l'orange.
  // Les autres cartes restent neutres (blanc, bordure fine), chiffre en navy ou foreground.
  const tone =
    accent === 'accent' ? 'border-accent/30 bg-secondary/40' :
    'bg-card border-border/60';
  const valueTone =
    accent === 'accent'  ? 'text-accent' :
    accent === 'primary' ? 'text-primary' :
    'text-foreground';
  return (
    <Card className={cn('shadow-none', tone)}>
      <CardContent className="px-5 pt-6 pb-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 font-medium">
          {icon}<span>{label}</span>
        </div>
        <p className={`font-display text-3xl font-semibold leading-none tracking-tight ${valueTone}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5 truncate" title={sub}>{sub}</p>}
      </CardContent>
    </Card>
  );
};

const priorityFor = (n: number): { label: string; tone: string; icon?: React.ReactNode } | null => {
  // Échelle unique : l'orange est réservé à la vraie priorité forte ; le reste reste neutre/atténué.
  if (n >= 3) return { label: `Priorité forte · ${n} comptes`, tone: 'bg-accent text-accent-foreground', icon: <Flame className="h-3 w-3 mr-1" /> };
  if (n === 2) return { label: '2 comptes détectés', tone: 'bg-muted text-muted-foreground' };
  if (n === 1) return { label: '1 compte détecté', tone: 'bg-muted text-muted-foreground' };
  return null;
};

/** Small avatar with logo/favicon/initials fallback */
const CompanyAvatar: React.FC<{ company: Company; size?: 'xs' | 'sm' | 'md' }> = ({ company, size = 'sm' }) => {
  const url = getExhibitorLogoUrl(null, company.website_raw ?? company.normalized_domain ?? null);
  const cls = size === 'xs' ? 'h-6 w-6 text-[10px]' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-7 w-7 text-[11px]';
  return (
    <Avatar className={`${cls} border bg-background`}>
      {url && <AvatarImage src={url} alt={company.company_name} />}
      <AvatarFallback className="bg-primary/10 text-primary font-bold">
        {companyInitials(company.company_name)}
      </AvatarFallback>
    </Avatar>
  );
};

/** Company chip — clickable, shows logo + name */
const CompanyChip: React.FC<{
  company: Company;
  stand?: string | null;
  nomExposant?: string | null;
  needsReview?: boolean;
  starred?: boolean;
  onClick: () => void;
}> = ({ company, stand, nomExposant, needsReview, starred, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group flex items-center gap-2 bg-background border rounded-full pl-1 pr-3 py-1.5 transition-all hover:bg-primary/5',
      starred && 'border-accent/50 bg-secondary/50',
      needsReview ? 'border-border hover:border-primary' : 'border-border hover:border-primary',
    )}
    title={nomExposant && nomExposant !== company.company_name ? `CRM : ${company.company_name}` : undefined}
  >
    <CompanyAvatar company={company} size="xs" />
    {starred && <Star className="h-3 w-3 text-accent fill-accent shrink-0" aria-label="Compte prioritaire" />}
    <span className="flex flex-col items-start leading-tight">
      <span className="text-sm font-semibold text-foreground group-hover:text-primary">
        {nomExposant ?? company.company_name}
      </span>
      {nomExposant && nomExposant !== company.company_name && (
        <span className="text-[10px] text-foreground/60">CRM : {company.company_name}</span>
      )}
    </span>
    {stand && (
      <span className="text-xs font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">
        {stand}
      </span>
    )}
    {needsReview && (
      <span className="text-[10px] font-medium text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
        À vérifier
      </span>
    )}
  </button>
);

/** Compact horizontal event card — image left, info center, actions right */
const AgendaLotexpoButton: React.FC<{ eventId: string; importId?: string | null }> = ({ eventId, importId }) => {
  const { user } = useAuth();
  const { data: isFavorite = false } = useIsFavorite(eventId);
  const toggleFavorite = useToggleFavorite();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    try {
      void trackRadarEvent('crm_favorite_clicked', {
        source: 'radar_crm',
        favoriteType: 'event_agenda',
        eventId,
        importId: importId ?? null,
      });
      await toggleFavorite.mutateAsync(eventId);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={toggleFavorite.isPending}
        className={cn(
          'transition-all duration-200',
          isFavorite && 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary',
        )}
      >
        {isFavorite ? (
          <CalendarCheck className="h-3.5 w-3.5 mr-1" />
        ) : (
          <CalendarPlus className="h-3.5 w-3.5 mr-1" />
        )}
        {isFavorite ? 'Dans mon agenda' : 'Ajouter à mon agenda'}
      </Button>
      <AuthRequiredModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
};

const EventCard: React.FC<{
  group: EventGroup;
  importId?: string | null;
  getPref?: (companyId: string) => Pref;
  onView: () => void;
  onCompanyClick: (
    c: Company,
    id_exposant: string,
    stand: string | null,
    nom_exposant: string | null,
    needs_review: boolean,
  ) => void;
}> = ({ group, importId, getPref, onView, onCompanyClick }) => {
  useEffect(() => { void trackRadarEvent('crm_result_event_card_viewed', { eventId: group.event_id }); }, [group.event_id]);
  const prio = priorityFor(group.companies.length);

  return (
    <Card className="overflow-hidden border-border/60 shadow-none hover:shadow-sm hover:border-border transition-all bg-card">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <div className="relative w-full sm:w-[180px] sm:min-w-[180px] h-[140px] sm:h-auto bg-muted overflow-hidden">
          {group.url_image ? (
            <img
              src={group.url_image}
              alt={group.nom_event}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            >
              <span className="text-2xl font-bold text-primary-foreground tracking-wider opacity-90">
                {eventInitials(group.nom_event)}
              </span>
            </div>
          )}
          {group.days_until != null && (
            <Badge className={cn(
              'absolute top-2 left-2 border-none text-xs',
              group.days_until < 30
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground',
            )}>
              J-{Math.max(0, group.days_until)}
            </Badge>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 p-5 md:p-6 flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-lg leading-snug text-foreground line-clamp-2">{group.nom_event}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground mt-1.5">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(group.date_debut)}</span>
                {(group.ville || group.nom_lieu) && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[group.nom_lieu, group.ville].filter(Boolean).join(' · ')}</span>
                )}
              </div>
            </div>
            {prio && (
              <Badge className={`${prio.tone} border-none whitespace-nowrap shrink-0`}>
                {prio.icon}{prio.label}
              </Badge>
            )}
          </div>

          {/* CRM companies — the heart of the card */}
          <div className="bg-secondary/40 border border-border/60 rounded-lg p-4 md:p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {group.companies.length} entreprise{group.companies.length > 1 ? 's' : ''} de votre CRM
            </p>
            <div className="flex flex-wrap gap-2">
              {group.companies.map(({ company, id_exposant, stand, nom_exposant, needs_review }) => (
                <CompanyChip
                  key={company.id}
                  company={company}
                  stand={stand}
                  nomExposant={nom_exposant}
                  needsReview={needs_review}
                  starred={getPref?.(company.id) === 'starred'}
                  onClick={() => onCompanyClick(company, id_exposant, stand, nom_exposant, needs_review)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-auto">
            <Button size="sm" onClick={onView} disabled={!group.slug}>
              Voir l'événement <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <AgendaLotexpoButton eventId={group.event_id} importId={importId} />
          </div>
        </div>
      </div>
    </Card>
  );
};

/** Past event card — same horizontal pattern, muted but companies still visible */
const PastEventCard: React.FC<{
  group: EventGroup;
  onView: () => void;
  onCompanyClick: (
    c: Company,
    id_exposant: string,
    stand: string | null,
    nom_exposant: string | null,
    needs_review: boolean,
  ) => void;
}> = ({ group, onView, onCompanyClick }) => {
  return (
    <Card className="overflow-hidden border-border/60 shadow-none hover:shadow-sm transition-all bg-card">
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-[140px] sm:min-w-[140px] h-[110px] sm:h-auto bg-muted overflow-hidden">
          {group.url_image ? (
            <img src={group.url_image} alt={group.nom_event} className="w-full h-full object-cover opacity-90" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-foreground/40 font-bold">
              {eventInitials(group.nom_event)}
            </div>
          )}
        </div>
        <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-base text-foreground leading-tight">{group.nom_event}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(group.date_debut)}{group.ville ? ` · ${group.ville}` : ''}
              </p>
            </div>
            <Badge className="bg-muted text-muted-foreground border-none font-medium">
              {group.companies.length} compte{group.companies.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="bg-secondary/40 border border-border/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Entreprises détectées
            </p>
            <div className="flex flex-wrap gap-2">
              {group.companies.map(({ company, id_exposant, stand, nom_exposant, needs_review }) => (
                <CompanyChip
                  key={company.id}
                  company={company}
                  stand={stand}
                  nomExposant={nom_exposant}
                  needsReview={needs_review}
                  onClick={() => onCompanyClick(company, id_exposant, stand, nom_exposant, needs_review)}
                />
              ))}
            </div>
          </div>
          <div className="mt-auto">
            <Button size="sm" variant="ghost" onClick={onView} disabled={!group.slug} className="text-primary hover:text-primary hover:bg-primary/5 -ml-2">
              Voir l'événement <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

/** Company "account" cards — modern CRM look */
const CompanyAccountsList: React.FC<{
  groups: EventGroup[]; companies: Company[]; onClickEvent: (g: EventGroup) => void;
  getPref: (companyId: string) => Pref;
  onSetPref: (companyId: string, next: Pref) => void;
}> = ({ groups, companies, onClickEvent, getPref, onSetPref }) => {
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  if (companies.length === 0) {
    return (
      <EmptyText label="Aucun mouvement détecté pour l'instant — Radar continue de surveiller vos comptes. Dès qu'un de vos comptes s'inscrit à un salon, vous le verrez ici et serez alerté." />
    );
  }

  const enriched = companies.map((c) => {
    const compGroups = groups.filter((g) => g.companies.some((x) => x.company.id === c.id));
    const future = compGroups.filter((g) => g.is_future).sort((a, b) => (a.days_until ?? 9999) - (b.days_until ?? 9999));
    const past = compGroups.filter((g) => !g.is_future).sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? ''));
    return { c, future, past };
  }).sort((a, b) => {
    // Tri par imminence : le compte avec le salon futur le plus proche d'abord.
    // Les comptes sans salon futur passent en bas.
    const aHas = a.future.length > 0;
    const bHas = b.future.length > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return (a.future[0]?.days_until ?? 9999) - (b.future[0]?.days_until ?? 9999);
  });

  // Trois groupes dérivés du statut effectif (override ?? base).
  const starred = enriched.filter((e) => getPref(e.c.id) === 'starred');
  const ignored = enriched.filter((e) => getPref(e.c.id) === 'ignored');
  const following = enriched.filter((e) => getPref(e.c.id) === 'normal');

  const Grid: React.FC<{ items: typeof enriched; dimmed?: boolean }> = ({ items, dimmed }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map(({ c, future, past }) => (
        <CompanyAccountCard
          key={c.id}
          company={c}
          future={future}
          past={past}
          onClickEvent={onClickEvent}
          pref={getPref(c.id)}
          onSetPref={(next) => onSetPref(c.id, next)}
          dimmed={dimmed}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Prioritaires (étoilés) */}
      {starred.length > 0 && (
        <section className="space-y-5">
          <div className="space-y-2">
            <div className="h-[3px] w-10 rounded-full bg-accent" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-accent fill-accent" />
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Prioritaires <span className="text-muted-foreground font-normal">({starred.length})</span>
              </h2>
            </div>
          </div>
          <Grid items={starred} />
        </section>
      )}

      {/* À suivre */}
      {following.length > 0 ? (
        <section className="space-y-5">
          {starred.length > 0 && (
            <div className="space-y-2">
              <div className="h-[3px] w-10 rounded-full bg-border" aria-hidden="true" />
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                À suivre <span className="text-muted-foreground font-normal">({following.length})</span>
              </h2>
            </div>
          )}
          <Grid items={following} />
        </section>
      ) : (
        starred.length === 0 && (
          <EmptyText label="Tous vos comptes sont rangés." />
        )
      )}

      {/* Ignorés (repliés par défaut) */}
      {ignored.length > 0 && (
        <section className="space-y-4 pt-2">
          <button
            type="button"
            onClick={() => setIgnoredOpen((o) => !o)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {ignoredOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <EyeOff className="h-4 w-4" />
            {ignored.length} compte{ignored.length > 1 ? 's' : ''} ignoré{ignored.length > 1 ? 's' : ''}
          </button>
          {ignoredOpen && <Grid items={ignored} dimmed />}
        </section>
      )}
    </div>
  );
};

/** Account card with collapsible event lists */
const CompanyAccountCard: React.FC<{
  company: Company;
  future: EventGroup[];
  past: EventGroup[];
  onClickEvent: (g: EventGroup) => void;
  pref: Pref;
  onSetPref: (next: Pref) => void;
  dimmed?: boolean;
}> = ({ company, future, past, onClickEvent, pref, onSetPref, dimmed }) => {
  const INITIAL = 3;
  const [expF, setExpF] = useState(false);
  // Historique replié par défaut : on calme la carte (cf. polish v2).
  const [expP, setExpP] = useState(false);
  const futureShown = expF ? future : future.slice(0, INITIAL);
  const futureMore = future.length - futureShown.length;

  // Seuil d'imminence : l'orange sur le badge J-XX est réservé aux salons proches.
  const IMMINENT_DAYS = 30;
  const renderRow = (g: EventGroup, tone: 'future' | 'past') => {
    const stand = g.companies.find((x) => x.company.id === company.id)?.stand;
    const imminent = g.days_until != null && g.days_until < IMMINENT_DAYS;
    return (
      <button
        key={g.event_id}
        type="button"
        onClick={() => onClickEvent(g)}
        disabled={!g.slug}
        className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors disabled:opacity-60 ${
          tone === 'future'
            ? 'bg-secondary/40 hover:bg-secondary/70'
            : 'hover:bg-muted/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${tone === 'future' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {g.nom_event}
          </p>
          {tone === 'future' && g.days_until != null && (
            <Badge
              className={cn(
                'shrink-0 border-none',
                imminent
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              J-{Math.max(0, g.days_until)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {formatDate(g.date_debut)}{g.ville ? ` · ${g.ville}` : ''}
          {stand && <span className="ml-2 text-foreground font-medium">Stand {stand}</span>}
        </p>
      </button>
    );
  };

  return (
    <Card className={cn(
      'h-full transition-all border-border/60 shadow-none',
      dimmed
        ? 'opacity-70 grayscale hover:opacity-100 hover:grayscale-0'
        : 'hover:border-border hover:shadow-sm',
      pref === 'starred' && 'border-accent/50 bg-secondary/40',
    )}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <CompanyAvatar company={company} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-base text-foreground truncate">{company.company_name}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <ExternalLink className="h-3 w-3" />
              {company.normalized_domain ?? company.website_raw ?? ''}
            </p>
          </div>
          {/* Contrôles triage étoile / ignorer */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              aria-label={pref === 'starred' ? 'Retirer des prioritaires' : 'Marquer comme prioritaire'}
              title={pref === 'starred' ? 'Retirer des prioritaires' : 'Marquer comme prioritaire'}
              onClick={() => onSetPref(pref === 'starred' ? 'normal' : 'starred')}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <Star className={cn('h-4 w-4', pref === 'starred' ? 'text-accent fill-accent' : 'text-foreground/40')} />
            </button>
            <button
              type="button"
              aria-label={pref === 'ignored' ? 'Ne plus ignorer' : 'Ignorer ce compte'}
              title={pref === 'ignored' ? 'Ne plus ignorer' : 'Ignorer ce compte'}
              onClick={() => onSetPref(pref === 'ignored' ? 'normal' : 'ignored')}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              {pref === 'ignored'
                ? <Eye className="h-4 w-4 text-foreground/50" />
                : <EyeOff className="h-4 w-4 text-foreground/40" />}
            </button>
          </div>
        </div>

        {dimmed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onSetPref('normal')}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Ne plus ignorer
          </Button>
        )}

        <div className="flex gap-6 text-sm">
          <div>
            <p className="font-display text-2xl font-semibold text-primary leading-none tracking-tight">{future.length}</p>
            <p className="text-xs text-muted-foreground mt-1">à venir</p>
          </div>
          <div className="border-l border-border/60 pl-6">
            <p className="font-display text-2xl font-semibold text-foreground/70 leading-none tracking-tight">{past.length}</p>
            <p className="text-xs text-muted-foreground mt-1">passés</p>
          </div>
        </div>

        {future.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Salons à venir
            </p>
            {futureShown.map((g) => renderRow(g, 'future'))}
            {futureMore > 0 && (
              <button
                type="button"
                onClick={() => setExpF(true)}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <ChevronDown className="h-3 w-3" /> Voir {futureMore} salon{futureMore > 1 ? 's' : ''} de plus
              </button>
            )}
            {expF && future.length > INITIAL && (
              <button
                type="button"
                onClick={() => setExpF(false)}
                className="text-xs font-medium text-muted-foreground hover:underline flex items-center gap-1"
              >
                <ChevronUp className="h-3 w-3" /> Réduire
              </button>
            )}
          </div>
        )}

        {/* Historique passé : replié par défaut → une seule ligne discrète. */}
        {past.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <button
              type="button"
              onClick={() => setExpP((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={expP}
            >
              {expP ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <History className="h-3.5 w-3.5" />
              {past.length} salon{past.length > 1 ? 's' : ''} passé{past.length > 1 ? 's' : ''}
            </button>
            {expP && (
              <div className="space-y-2">
                {past.map((g) => renderRow(g, 'past'))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const DetailTable: React.FC<{ groups: EventGroup[]; onView: (g: EventGroup) => void }> = ({ groups, onView }) => {
  const rows = groups.flatMap((g) =>
    g.companies.map((c) => ({ g, c })),
  ).sort((a, b) => (a.g.date_debut ?? '').localeCompare(b.g.date_debut ?? ''));
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr><Th>Entreprise</Th><Th>Événement</Th><Th>Date</Th><Th>Ville</Th><Th>Stand</Th><Th></Th></tr>
        </thead>
        <tbody>
          {rows.map(({ g, c }, i) => (
            <tr key={`${g.event_id}-${c.company.id}-${i}`} className="border-t">
              <Td className="font-medium text-foreground">{c.company.company_name}</Td>
              <Td className="text-foreground/80">{g.nom_event}</Td>
              <Td className="text-foreground/80">{formatDate(g.date_debut)}</Td>
              <Td className="text-foreground/80">{g.ville ?? '—'}</Td>
              <Td className="max-w-[180px] truncate text-foreground/80">{c.stand ?? '—'}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => onView(g)} disabled={!g.slug}>Voir</Button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Th: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, ...p }) => (
  <th {...p} className="text-left px-3 py-2 font-semibold text-foreground/70 whitespace-nowrap">{children}</th>
);
const Td: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...p }) => (
  <td {...p} className={`px-3 py-2 ${className}`}>{children}</td>
);
const EmptyText: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center text-foreground/60 py-12">{label}</div>
);

/* ───────────────────────── Gating sub-components ───────────────────────── */

/** Trial banner shown to users on an active trial. Tone intensifies near expiry. */
const TrialBanner: React.FC<{ daysLeft: number | null; detected: number }> = ({ daysLeft, detected }) => {
  const urgent = daysLeft != null && daysLeft <= 2;
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 flex items-start gap-3',
        urgent
          ? 'border-accent/50 bg-accent/10 text-foreground'
          : 'border-primary/30 bg-primary/5 text-foreground',
      )}
    >
      <Clock className={cn('h-5 w-5 mt-0.5 shrink-0', urgent ? 'text-accent' : 'text-primary')} />
      <div className="text-sm">
        {urgent ? (
          <p>
            <span className="font-semibold">Votre essai se termine bientôt</span> — vous perdrez l'accès à
            vos <strong>{detected}</strong> détection{detected > 1 ? 's' : ''}
            {daysLeft != null && daysLeft > 0 ? ` dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : " aujourd'hui"}.
          </p>
        ) : (
          <p>
            <span className="font-semibold">Essai gratuit</span> — il vous reste{' '}
            <strong>{daysLeft ?? 0}</strong> jour{(daysLeft ?? 0) > 1 ? 's' : ''}.
          </p>
        )}
      </div>
    </div>
  );
};

/** Visible error state instead of a silent empty render. */
const RadarErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <Card className="border-destructive/30 bg-destructive/5">
    <CardContent className="pt-8 pb-8 text-center">
      <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
      <h3 className="text-lg font-semibold mb-1 text-foreground">Impossible de charger votre Radar CRM</h3>
      <p className="text-sm text-foreground/70 max-w-md mx-auto mb-4">
        Une erreur est survenue lors de la récupération de vos données. Réessayez dans un instant.
      </p>
      <Button onClick={onRetry}>Réessayer</Button>
    </CardContent>
  </Card>
);

/**
 * Locked teaser for a single event — strictly generic.
 * Aucun compteur, aucune identité d'entreprise : juste le salon + 2 pastilles
 * floutées génériques identiques pour tous (ne représentent pas un nombre réel).
 */
const LockedEventTeaser: React.FC<{ group: EventGroup }> = ({ group }) => {
  return (
    <Card className="overflow-hidden bg-card">
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-[180px] sm:min-w-[180px] h-[140px] sm:h-auto bg-muted overflow-hidden">
          {group.url_image ? (
            <img
              src={group.url_image}
              alt={group.nom_event}
              className="w-full h-full object-cover opacity-80"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            >
              <span className="text-2xl font-bold text-primary-foreground tracking-wider opacity-90">
                {eventInitials(group.nom_event)}
              </span>
            </div>
          )}
          {group.days_until != null && (
            <Badge className="absolute top-2 left-2 bg-foreground text-background border-none">
              J-{Math.max(0, group.days_until)}
            </Badge>
          )}
        </div>

        <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
          <div className="min-w-0">
            <h3 className="font-bold text-lg leading-tight text-foreground line-clamp-2">{group.nom_event}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-foreground/70 mt-1">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(group.date_debut)}</span>
              {(group.ville || group.nom_lieu) && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[group.nom_lieu, group.ville].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </div>

          <div className="bg-muted/50 border rounded-lg p-3">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Des entreprises de votre CRM exposent ici
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-7 w-24 rounded-full bg-muted-foreground/20 blur-[2px]"
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

/**
 * Paywall dur façon média : bandeau de stats agrégées + au plus 3 salons teaser
 * (renvoyés par le serveur), puis un blocage net. Aucun onglet passé/entreprises,
 * aucune liste complète, aucun compteur par salon : tout est verrouillé côté serveur.
 */
const LockedView: React.FC<{
  teaserGroups: EventGroup[];
  summary?: RadarView['summary'];
  onRequestAccess: () => void;
}> = ({ teaserGroups, summary, onRequestAccess }) => {
  const analyzed = summary?.companies_analyzed ?? 0;
  const futureCompanies = summary?.future_companies ?? 0;
  const futureSalons = summary?.future_salons ?? 0;
  // Serveur : 3 salons max en verrouillé. Sécurité front si la liste enflait.
  const teaser = teaserGroups.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Bandeau de stats agrégées (aucune fuite d'identité) */}
      <Card className="bg-card">
        <CardContent className="py-4">
          <p className="text-sm text-foreground/80">
            <strong className="text-foreground">{analyzed}</strong> compte{analyzed > 1 ? 's' : ''} analysé{analyzed > 1 ? 's' : ''}
            {' · '}
            <strong className="text-foreground">{futureCompanies}</strong> exposeront sur{' '}
            <strong className="text-foreground">{futureSalons}</strong> salon{futureSalons > 1 ? 's' : ''} à venir
          </p>
        </CardContent>
      </Card>

      {/* Teaser : aperçu de quelques salons puis fondu de masquage */}
      {teaser.length > 0 && (
        <div className="relative">
          <div className="space-y-3">
            {teaser.map((g) => (
              <LockedEventTeaser key={g.event_id} group={g} />
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-muted/20"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Blocage dur */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Lock className="h-6 w-6" />
          </div>
          <div className="max-w-lg space-y-1.5">
            <h3 className="text-lg font-bold text-foreground">La suite est réservée</h3>
            <p className="text-sm text-foreground/70">
              <strong className="text-foreground">{futureCompanies}</strong> entreprise{futureCompanies > 1 ? 's' : ''} de votre CRM
              {futureCompanies > 1 ? ' exposeront' : ' exposera'} sur{' '}
              <strong className="text-foreground">{futureSalons}</strong> salon{futureSalons > 1 ? 's' : ''} à venir.
              Débloquez Radar CRM pour découvrir lesquelles, où et quand.
            </p>
          </div>
          <Button onClick={onRequestAccess} size="lg" className="w-full sm:w-auto">
            Demander l'accès
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

/** Minimal "request access" modal with a direct contact fallback. */
const NoFutureMatches: React.FC<{ companiesCount: number; matchedCount: number }> = ({ companiesCount, matchedCount }) => (
  <Card>
    <CardContent className="pt-8 pb-8 text-center">
      <Radar className="h-10 w-10 mx-auto text-primary mb-3" />
      <h3 className="text-lg font-semibold mb-1 text-foreground">
        Aucun mouvement détecté pour l'instant
      </h3>
      <p className="text-sm text-foreground/70 max-w-md mx-auto mb-4">
        {matchedCount === 0
          ? `Radar continue de surveiller vos comptes. Aucune correspondance pour l'instant entre les ${companiesCount} domaines de votre fichier et les exposants Lotexpo.`
          : "Radar continue de surveiller vos comptes. Dès qu'un de vos comptes s'inscrit à un salon à venir, vous le verrez ici et serez alerté par email."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/radar-crm"><Upload className="h-4 w-4 mr-2" /> Importer un autre fichier</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Voir les événements Lotexpo</Link>
        </Button>
      </div>
    </CardContent>
  </Card>
);

const RadarEmptyState: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 py-12 text-center">
    <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground mx-auto flex items-center justify-center mb-4">
      <Radar className="h-7 w-7" />
    </div>
    <h1 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">Votre Radar CRM est vide</h1>
    <p className="text-foreground/70 mb-6 max-w-xl mx-auto">
      Importez votre liste de prospects et découvrez en quelques secondes ceux qui exposent
      sur des salons dans les 60 prochains jours.
    </p>
    <Button asChild size="lg">
      <Link to="/radar-crm"><Upload className="h-4 w-4 mr-2" /> Importer mon fichier CSV</Link>
    </Button>
  </div>
);

export default RadarCrmResults;