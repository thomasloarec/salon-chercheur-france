import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import {
  type RelationshipStatus, companyKeyFor, normalizeRelationship, DEFAULT_RELATIONSHIP,
} from '@/lib/radarCrm/relationship';
import { type RadarOnboardingProgress } from '@/components/radar-crm/RadarOnboardingPanel';
import { type MissionTarget } from '@/components/radar-crm/RadarMissionSheet';
import {
  type Import, type Company, type Pref, type RadarView, type RadarAccess,
  type EventGroup, mapEventToGroup,
} from '@/types/radar';

interface RadarWorkspaceValue {
  imports: Import[] | null;
  activeImportId: string | null;
  setActiveImportId: React.Dispatch<React.SetStateAction<string | null>>;
  radarView: RadarView | null;
  loading: boolean;
  error: string | null;
  onboarding: RadarOnboardingProgress | null;
  onboardingLoading: boolean;
  access: RadarAccess | null;
  accessLoading: boolean;
  orgName: string | null;
  isSpaceOwner: boolean;
  loadSpaceMeta: () => Promise<void>;
  prefByCompany: Record<string, Pref>;
  prefOverrides: Record<string, Pref>;
  getPref: (companyId: string) => Pref;
  setPref: (companyId: string, next: Pref) => Promise<void>;
  relByKey: Record<string, RelationshipStatus>;
  relOverrides: Record<string, RelationshipStatus>;
  getRel: (company: Company) => RelationshipStatus;
  setRel: (company: Company, next: RelationshipStatus) => Promise<void>;
  loadRelationships: () => Promise<void>;
  offerEmpty: boolean | null;
  checkOfferProfile: () => Promise<void>;
  similarCounts: Record<string, number> | null;
  setSimilarCounts: React.Dispatch<React.SetStateAction<Record<string, number> | null>>;
  highlightedEventId: string | null;
  eventGroups: EventGroup[];
  matchedCompanies: Company[];
  futureGroups: EventGroup[];
  pastGroups: EventGroup[];
  nextEvent: EventGroup | null;
  featured: { event: EventGroup; company: Company | null; isPriority: boolean } | null;
  starredCount: number;
  ongoingEvents: EventGroup[];
  seatBlockKind: 'none' | 'locked' | null;
  // Dialogues montés une seule fois par RadarDialogsHost.
  openExhibitor: { exhibitor: any; event: any } | null;
  setOpenExhibitor: React.Dispatch<React.SetStateAction<{ exhibitor: any; event: any } | null>>;
  mission: { target: MissionTarget; company: Company } | null;
  setMission: React.Dispatch<React.SetStateAction<{ target: MissionTarget; company: Company } | null>>;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accessOpen: boolean;
  setAccessOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenExhibitor: (
    company: Company, id_exposant: string, stand: string | null,
    g: EventGroup, nom_exposant: string | null, needs_review: boolean,
  ) => void;
  onOpenMission: (
    company: Company, stand: string | null, g: EventGroup, nom_exposant: string | null,
  ) => void;
  onClickEvent: (g: EventGroup) => void;
  reloadAll: () => Promise<void>;
  refreshCockpit: () => Promise<void>;
  enterTerrain: (id: string) => void;
}

const RadarWorkspaceContext = createContext<RadarWorkspaceValue | null>(null);

export const RadarWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imports, setImports] = useState<Import[] | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(searchParams.get('importId'));
  const highlightedEventId = searchParams.get('eventId');
  const [radarView, setRadarView] = useState<RadarView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isSpaceOwner, setIsSpaceOwner] = useState(false);
  const [similarCounts, setSimilarCounts] = useState<Record<string, number> | null>(null);
  const [onboarding, setOnboarding] = useState<RadarOnboardingProgress | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [access, setAccess] = useState<RadarAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  // L'import actif est résolu par le backend (`get_my_radar_view` avec p_import_id null).
  // Cette référence évite un second appel réseau juste après l'initialisation de
  // `activeImportId` avec l'identifiant renvoyé par la RPC.
  const resolvedImportId = useRef<string | null>(null);

  const reloadAll = async () => {
    setActiveImportId(null);
    setRadarView(null);
    resolvedImportId.current = null;
    const { data } = await supabase
      .from('crm_imports')
      .select('id, file_name, status, total_rows, matched_companies_count, unmatched_companies_count, created_at')
      .order('created_at', { ascending: false });
    setImports((data ?? []) as Import[]);
  };

  // Load imports — historique complet, sans filtre (imports vides compris).
  // Le choix de l'import courant revient au backend, pas au front.
  useEffect(() => {
    if (!user) return;
    void trackRadarEvent('crm_results_viewed');
    (async () => {
      const { data } = await supabase
        .from('crm_imports')
        .select('id, file_name, status, total_rows, matched_companies_count, unmatched_companies_count, created_at')
        .order('created_at', { ascending: false });
      setImports((data ?? []) as Import[]);
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Métadonnées d'espace : nom d'entreprise (org_name) + rôle courant.
  const loadSpaceMeta = React.useCallback(async () => {
    const { data } = await supabase.rpc('get_my_radar_team');
    const t = data as unknown as { org_name?: string | null; my_role?: string } | null;
    setOrgName((t?.org_name ?? '').trim() || null);
    setIsSpaceOwner(t?.my_role === 'owner');
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadSpaceMeta();
  }, [user, loadSpaceMeta]);

  // Accès par membre : appelé au chargement. Pilote bandeau d'essai + blocage.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setAccessLoading(true);
      const { data, error: rpcError } = await supabase.rpc('my_radar_access');
      if (cancelled) return;
      if (rpcError) {
        console.error('[RadarCRM] my_radar_access failed:', rpcError);
      } else {
        setAccess((data as unknown as RadarAccess) ?? null);
      }
      setAccessLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load the full radar view via the server-side RPC.
  // p_import_id null → la RPC résout elle-même l'import actif (exclut les imports vides).
  // The RPC enforces entitlement/gating: in a locked state it returns
  // `companies: []` while keeping `company_count` and `summary` populated.
  useEffect(() => {
    if (!user) return;
    if (activeImportId && resolvedImportId.current === activeImportId) {
      resolvedImportId.current = null;
      return;
    }
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
      const view = (data as unknown as RadarView) ?? null;
      setRadarView(view);
      setLoading(false);
      if (!activeImportId && view?.import_id) {
        resolvedImportId.current = view.import_id;
        setActiveImportId(view.import_id);
      }
    })();
  }, [activeImportId, user]);

  // Rafraîchissement léger du cockpit après un « Garder » (sans écran de chargement).
  const refreshCockpit = async () => {
    if (!activeImportId || !user) return;
    const { data, error: rpcError } = await supabase.rpc('get_my_radar_view', {
      p_import_id: activeImportId ?? null,
    });
    if (!rpcError) setRadarView((data as unknown as RadarView) ?? null);
    void loadRelationships();
  };

  // ── Gating par siège (modèle par-membre) ────────────────────────────
  const accessKind = access?.access_kind ?? null;
  // Blocage dur : accès refusé (essai expiré sans siège, ou accès suspendu),
  // OU la RPC de données signale explicitement no_access.
  const seatBlockKind: 'none' | 'locked' | null =
    access && access.has_access === false && (accessKind === 'none' || accessKind === 'locked')
      ? accessKind
      : radarView && radarView.has_access === false && radarView.status === 'none'
        ? 'none'
        : null;

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

  // Salons EN COURS aujourd'hui : date du jour (locale) comprise entre
  // date_debut et date_fin inclus (date_fin null → date_debut).
  // Le plus « prioritaire » = celui avec le plus d'entreprises détectées.
  const ongoingEvents = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return eventGroups
      .filter((g) => {
        if (!g.date_debut) return false;
        const start = g.date_debut.slice(0, 10);
        const end = (g.date_fin ?? g.date_debut).slice(0, 10);
        return start <= today && today <= end;
      })
      .sort((a, b) => b.company_count - a.company_count);
  }, [eventGroups]);

  const enterTerrain = (id: string) => {
    void trackRadarEvent('radar_salon_mode_opened', { eventId: id });
    navigate(`/radar-crm/terrain/${id}`);
  };

  // ── Dialogues partagés (montés une seule fois dans le layout) ───────
  const [openExhibitor, setOpenExhibitor] = useState<{ exhibitor: any; event: any } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  // Panneau mission (vue « Par salon ») — couple compte + salon.
  const [mission, setMission] = useState<{ target: MissionTarget; company: Company } | null>(null);

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

  // Ouverture du panneau mission depuis la vue « Par salon ».
  const onOpenMission = (
    company: Company,
    stand: string | null,
    g: EventGroup,
    nom_exposant: string | null,
  ) => {
    void trackRadarEvent('radar_mission_opened', { eventId: g.event_id });
    setMission({
      company,
      target: {
        companyId: company.id,
        companyName: company.company_name,
        nomExposant: nom_exposant,
        stand,
        eventId: g.event_id,
        eventName: g.nom_event,
      },
    });
  };

  // Onboarding gamifié : progression des 4 missions (qualifier, prioriser,
  // préparer, capturer). Chargé une fois au montage quand l'utilisateur est
  // connecté. Non bloquant : en cas d'erreur on masque silencieusement le panneau.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setOnboardingLoading(true);
    (async () => {
      const { data, error: obErr } = await supabase.rpc('get_radar_onboarding_progress');
      if (cancelled) return;
      if (obErr || !data || typeof data !== 'object') {
        if (obErr) console.error('[RadarCRM] get_radar_onboarding_progress failed:', obErr);
        setOnboarding(null);
        setOnboardingLoading(false);
        return;
      }
      setOnboarding(data as unknown as RadarOnboardingProgress);
      setOnboardingLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const value: RadarWorkspaceValue = {
    imports, activeImportId, setActiveImportId,
    radarView, loading, error,
    onboarding, onboardingLoading,
    access, accessLoading,
    orgName, isSpaceOwner, loadSpaceMeta,
    prefByCompany, prefOverrides, getPref, setPref,
    relByKey, relOverrides, getRel, setRel, loadRelationships,
    offerEmpty, checkOfferProfile,
    similarCounts, setSimilarCounts,
    highlightedEventId,
    eventGroups, matchedCompanies, futureGroups, pastGroups,
    nextEvent, featured, starredCount, ongoingEvents, seatBlockKind,
    openExhibitor, setOpenExhibitor, mission, setMission,
    settingsOpen, setSettingsOpen, accessOpen, setAccessOpen,
    onOpenExhibitor, onOpenMission, onClickEvent,
    reloadAll, refreshCockpit, enterTerrain,
  };

  return (
    <RadarWorkspaceContext.Provider value={value}>{children}</RadarWorkspaceContext.Provider>
  );
};

export function useRadarWorkspace() {
  const ctx = useContext(RadarWorkspaceContext);
  if (!ctx) throw new Error('useRadarWorkspace doit être utilisé dans RadarWorkspaceProvider');
  return ctx;
}
