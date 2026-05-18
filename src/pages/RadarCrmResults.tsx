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
  CalendarCheck, Settings,
} from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import { toast } from '@/hooks/use-toast';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { ExhibitorDetailDialog } from '@/components/event/ExhibitorDetailDialog';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { cn } from '@/lib/utils';
import RadarCrmSettingsDialog from '@/components/radar-crm/RadarCrmSettingsDialog';

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

type Match = {
  id: string;
  crm_company_id: string;
  id_exposant: string;
  event_id: string;
  normalized_domain: string;
  needs_review?: boolean | null;
  name_similarity?: number | null;
  review_reason?: string | null;
};

type ParticipationViewRow = {
  id_exposant: string;
  nom_exposant: string | null;
  event_id: string;
  nom_event: string | null;
  type_event: string | null;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  nom_lieu: string | null;
  stand_exposants_list: string | null;
  is_future_event: boolean | null;
  days_until_event: number | null;
  url_image: string | null;
  slug: string | null;
};

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
  companies: Array<{
    company: Company;
    id_exposant: string;
    nom_exposant: string | null;
    stand: string | null;
    needs_review: boolean;
    name_similarity: number | null;
  }>;
}

const RadarCrmResults: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imports, setImports] = useState<Import[] | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(searchParams.get('importId'));
  const highlightedEventId = searchParams.get('eventId');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [viewRows, setViewRows] = useState<ParticipationViewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openExhibitor, setOpenExhibitor] = useState<{
    exhibitor: any;
    event: any;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const reloadAll = async () => {
    setActiveImportId(null);
    setCompanies([]); setMatches([]); setViewRows([]);
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

  // Load detail for active import
  useEffect(() => {
    if (!activeImportId || !user) return;
    setLoading(true);
    (async () => {
      const { data: comps } = await supabase
        .from('crm_companies')
        .select('id, company_name, website_raw, normalized_domain')
        .eq('import_id', activeImportId);
      const compList = (comps ?? []) as Company[];
      setCompanies(compList);

      if (compList.length === 0) {
        setMatches([]); setViewRows([]); setLoading(false);
        return;
      }
      const { data: mts } = await supabase
        .from('crm_company_event_matches')
        .select('id, crm_company_id, id_exposant, event_id, normalized_domain, needs_review, name_similarity, review_reason')
        .in('crm_company_id', compList.map((c) => c.id));
      const matchList = (mts ?? []) as Match[];
      setMatches(matchList);

      if (matchList.length > 0) {
        const eventIds = Array.from(new Set(matchList.map((m) => m.event_id)));
        const exposantIds = Array.from(new Set(matchList.map((m) => m.id_exposant)));
        const { data: vrows } = await supabase
          .from('crm_radar_participations_view')
          .select('id_exposant, nom_exposant, event_id, nom_event, type_event, date_debut, date_fin, ville, nom_lieu, stand_exposants_list, is_future_event, days_until_event, url_image, slug')
          .in('event_id', eventIds)
          .in('id_exposant', exposantIds);
        setViewRows((vrows ?? []) as ParticipationViewRow[]);
      } else {
        setViewRows([]);
      }
      setLoading(false);
    })();
  }, [activeImportId, user]);

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const viewMap = useMemo(
    () => new Map(viewRows.map((v) => [`${v.event_id}|${v.id_exposant}`, v])),
    [viewRows],
  );

  const eventGroups: EventGroup[] = useMemo(() => {
    const groups = new Map<string, EventGroup>();
    for (const m of matches) {
      const v = viewMap.get(`${m.event_id}|${m.id_exposant}`);
      const c = companyMap.get(m.crm_company_id);
      if (!c || !v) continue;
      let g = groups.get(m.event_id);
      if (!g) {
        g = {
          event_id: m.event_id,
          slug: v.slug,
          nom_event: v.nom_event ?? 'Événement',
          date_debut: v.date_debut,
          date_fin: v.date_fin,
          ville: v.ville,
          nom_lieu: v.nom_lieu,
          url_image: v.url_image,
          days_until: v.days_until_event,
          is_future: v.is_future_event ?? false,
          companies: [],
        };
        groups.set(m.event_id, g);
      }
      if (!g.companies.find((x) => x.company.id === c.id)) {
        g.companies.push({
          company: c,
          id_exposant: m.id_exposant,
          nom_exposant: v.nom_exposant ?? null,
          stand: v.stand_exposants_list ?? null,
          needs_review: m.needs_review === true,
          name_similarity: m.name_similarity ?? null,
        });
      }
    }
    return Array.from(groups.values());
  }, [matches, viewMap, companyMap]);

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
        return b.companies.length - a.companies.length;
      }),
    [eventGroups, highlightedEventId],
  );
  const pastGroups = useMemo(
    () => eventGroups.filter((g) => !g.is_future)
      .sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? '')),
    [eventGroups],
  );

  // Scroll to highlighted event once results are rendered.
  useEffect(() => {
    if (!highlightedEventId || loading) return;
    if (!eventGroups.find((g) => g.event_id === highlightedEventId)) return;
    const el = document.getElementById(`radar-event-${highlightedEventId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedEventId, loading, eventGroups]);

  const matchedCompanyIds = useMemo(() => new Set(matches.map((m) => m.crm_company_id)), [matches]);
  const matchedCompanies = useMemo(() => companies.filter((c) => matchedCompanyIds.has(c.id)), [companies, matchedCompanyIds]);
  const unmatchedCompanies = useMemo(() => companies.filter((c) => !matchedCompanyIds.has(c.id)), [companies, matchedCompanyIds]);

  const futureParticipations = useMemo(
    () => matches.filter((m) => viewMap.get(`${m.event_id}|${m.id_exposant}`)?.is_future_event).length,
    [matches, viewMap],
  );

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
  ) => {
    void trackRadarEvent('crm_exhibitor_dialog_opened', { eventId: g.event_id, id_exposant });
    setOpenExhibitor({
      exhibitor: {
        id_exposant,
        exhibitor_name: company.company_name,
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
      <div className="bg-muted/20 min-h-[calc(100vh-200px)]">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                  <Radar className="h-5 w-5" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Votre Radar CRM</h1>
              </div>
              <p className="text-foreground/70 text-sm md:text-base">
                {loading ? 'Analyse en cours…' :
                  <><strong className="text-foreground">{matchedCompanies.length}</strong> entreprise{matchedCompanies.length > 1 ? 's' : ''} détectée{matchedCompanies.length > 1 ? 's' : ''} sur <strong className="text-foreground">{eventGroups.length}</strong> salon{eventGroups.length > 1 ? 's' : ''} Lotexpo</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Paramètres Radar CRM
              </Button>
              {imports && imports.length > 1 && (
                <Select value={activeImportId ?? ''} onValueChange={setActiveImportId}>
                  <SelectTrigger className="w-[240px] bg-card">
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
              <Button asChild>
                <Link to="/radar-crm">
                  <Plus className="h-4 w-4 mr-2" /> Nouveau fichier CSV
                </Link>
              </Button>
            </div>
          </div>

          {/* Hero stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Entreprises analysées" value={companies.length} />
            <StatCard label="Entreprises détectées" value={matchedCompanies.length} accent="success" />
            <StatCard label="Salons à venir" value={futureGroups.length} accent="primary" icon={<Sparkles className="h-4 w-4" />} />
            <StatCard label="Participations futures" value={futureParticipations} />
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <Tabs defaultValue="future">
                <TabsList className="bg-card border">
                  <TabsTrigger value="future">À venir ({futureGroups.length})</TabsTrigger>
                  <TabsTrigger value="past">
                    <History className="h-3.5 w-3.5 mr-1" /> Historique passé ({pastGroups.length})
                  </TabsTrigger>
                  <TabsTrigger value="companies">Entreprises ({matchedCompanies.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="future" className="mt-5">
                  {futureGroups.length === 0 ? (
                    <NoFutureMatches companiesCount={companies.length} matchedCount={matchedCompanies.length} />
                  ) : (
                    <div className="space-y-3">
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
                            onView={() => onClickEvent(g)}
                            onCompanyClick={(c, id_exposant, stand) => onOpenExhibitor(c, id_exposant, stand, g)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="past" className="mt-5">
                  {pastGroups.length === 0 ? (
                    <EmptyText label="Aucun salon passé détecté." />
                  ) : (
                    <div className="space-y-3">
                      {pastGroups.map((g) => (
                        <PastEventCard
                          key={g.event_id}
                          group={g}
                          onView={() => onClickEvent(g)}
                          onCompanyClick={(c, id_exposant, stand) => onOpenExhibitor(c, id_exposant, stand, g)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="companies" className="mt-5">
                  <CompanyAccountsList
                    groups={eventGroups}
                    companies={matchedCompanies}
                    onClickEvent={onClickEvent}
                  />
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

              {/* Unmatched (collapsible secondary block) */}
              {unmatchedCompanies.length > 0 && (
                <Card className="bg-muted/40 border-dashed">
                  <CardContent className="pt-6">
                    <Accordion
                      type="single"
                      collapsible
                      onValueChange={(v) => {
                        if (!v) return;
                        void trackRadarEvent('crm_unmatched_list_opened', { count: unmatchedCompanies.length });
                        void trackRadarEvent('crm_unmatched_viewed', { count: unmatchedCompanies.length, source: 'radar_crm' });
                      }}
                    >
                      <AccordionItem value="unmatched" className="border-none">
                        <AccordionTrigger className="hover:no-underline py-2">
                          <div className="flex items-start gap-3 text-left">
                            <AlertCircle className="h-5 w-5 text-foreground/50 mt-0.5" />
                            <div>
                              <p className="font-semibold text-base text-foreground">
                                Entreprises non détectées dans Lotexpo
                              </p>
                              <p className="text-sm text-foreground/70 font-normal">
                                {unmatchedCompanies.length} entreprise{unmatchedCompanies.length > 1 ? 's' : ''} sans correspondance exposant.
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-xs text-foreground/70 bg-background rounded p-3 mb-3">
                            Le matching MVP est basé sur une correspondance exacte du domaine web.
                            Les groupes utilisant des sous-domaines ou des sites pays peuvent ne pas être détectés.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {unmatchedCompanies.slice(0, 60).map((c) => (
                              <div key={c.id} className="flex items-center gap-2 bg-background border rounded-full pl-1 pr-3 py-1">
                                <CompanyAvatar company={c} size="xs" />
                                <span className="text-sm font-medium text-foreground">{c.company_name}</span>
                                {c.normalized_domain && (
                                  <span className="text-xs text-foreground/50">{c.normalized_domain}</span>
                                )}
                              </div>
                            ))}
                            {unmatchedCompanies.length > 60 && (
                              <span className="text-xs text-foreground/60 self-center">
                                + {unmatchedCompanies.length - 60} autres
                              </span>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
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
      />
    </MainLayout>
  );
};

/* ────────────────────────── Sub-components ────────────────────────── */

const StatCard: React.FC<{
  label: string; value: number | string; sub?: string;
  accent?: 'primary' | 'success' | 'accent'; icon?: React.ReactNode;
}> = ({ label, value, sub, accent, icon }) => {
  const tone =
    accent === 'primary' ? 'border-primary/40 bg-primary/5' :
    accent === 'success' ? 'border-emerald-500/40 bg-emerald-500/5' :
    accent === 'accent'  ? 'border-accent/50 bg-accent/10' :
    'bg-card';
  const valueTone =
    accent === 'primary' ? 'text-primary' :
    accent === 'success' ? 'text-emerald-600' :
    accent === 'accent'  ? 'text-accent' : 'text-foreground';
  return (
    <Card className={tone}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-1.5 text-xs text-foreground/70 mb-1 font-medium">
          {icon}<span>{label}</span>
        </div>
        <p className={`text-2xl font-bold leading-tight ${valueTone}`}>{value}</p>
        {sub && <p className="text-xs text-foreground/60 mt-1 truncate" title={sub}>{sub}</p>}
      </CardContent>
    </Card>
  );
};

const priorityFor = (n: number): { label: string; tone: string; icon?: React.ReactNode } | null => {
  if (n >= 3) return { label: `Priorité forte · ${n} comptes`, tone: 'bg-accent text-accent-foreground', icon: <Flame className="h-3 w-3 mr-1" /> };
  if (n === 2) return { label: '2 comptes détectés', tone: 'bg-primary text-primary-foreground' };
  if (n === 1) return { label: 'Opportunité', tone: 'bg-emerald-600 text-white' };
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
  company: Company; stand?: string | null; onClick: () => void;
}> = ({ company, stand, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-center gap-2 bg-background border border-border hover:border-primary hover:bg-primary/5 rounded-full pl-1 pr-3 py-1 transition-all"
  >
    <CompanyAvatar company={company} size="xs" />
    <span className="text-sm font-semibold text-foreground group-hover:text-primary">
      {company.company_name}
    </span>
    {stand && (
      <span className="text-xs font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
        {stand}
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
          isFavorite && 'bg-green-500 text-white hover:bg-green-600 border-green-500',
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
  onView: () => void;
  onCompanyClick: (c: Company, id_exposant: string, stand: string | null) => void;
}> = ({ group, importId, onView, onCompanyClick }) => {
  useEffect(() => { void trackRadarEvent('crm_result_event_card_viewed', { eventId: group.event_id }); }, [group.event_id]);
  const prio = priorityFor(group.companies.length);

  return (
    <Card className="overflow-hidden hover:shadow-md hover:border-primary/30 transition-all bg-card">
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
            <Badge className="absolute top-2 left-2 bg-foreground text-background border-none">
              J-{Math.max(0, group.days_until)}
            </Badge>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-lg leading-tight text-foreground line-clamp-2">{group.nom_event}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-foreground/70 mt-1">
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
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
              {group.companies.length} entreprise{group.companies.length > 1 ? 's' : ''} de votre CRM
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.companies.map(({ company, id_exposant, stand }) => (
                <CompanyChip key={company.id} company={company} stand={stand} onClick={() => onCompanyClick(company, id_exposant, stand)} />
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
  onCompanyClick: (c: Company, id_exposant: string, stand: string | null) => void;
}> = ({ group, onView, onCompanyClick }) => {
  return (
    <Card className="overflow-hidden hover:shadow-sm transition-all bg-card">
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
        <div className="flex-1 p-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-bold text-base text-foreground leading-tight">{group.nom_event}</h3>
              <p className="text-xs text-foreground/60 mt-0.5">
                {formatDate(group.date_debut)}{group.ville ? ` · ${group.ville}` : ''}
              </p>
            </div>
            <Badge variant="secondary" className="font-semibold">
              {group.companies.length} compte{group.companies.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1.5">
            Entreprises détectées
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {group.companies.map(({ company, id_exposant, stand }) => (
              <CompanyChip key={company.id} company={company} stand={stand} onClick={() => onCompanyClick(company, id_exposant, stand)} />
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={onView} disabled={!group.slug} className="text-primary -ml-2">
            Voir l'événement <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

/** Company "account" cards — modern CRM look */
const CompanyAccountsList: React.FC<{
  groups: EventGroup[]; companies: Company[]; onClickEvent: (g: EventGroup) => void;
}> = ({ groups, companies, onClickEvent }) => {
  if (companies.length === 0) return <EmptyText label="Aucune entreprise détectée." />;

  const enriched = companies.map((c) => {
    const compGroups = groups.filter((g) => g.companies.some((x) => x.company.id === c.id));
    const future = compGroups.filter((g) => g.is_future).sort((a, b) => (a.days_until ?? 9999) - (b.days_until ?? 9999));
    const past = compGroups.filter((g) => !g.is_future).sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? ''));
    return { c, future, past };
  }).sort((a, b) => {
    if (a.future.length !== b.future.length) return b.future.length - a.future.length;
    return (a.future[0]?.days_until ?? 9999) - (b.future[0]?.days_until ?? 9999);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {enriched.map(({ c, future, past }) => (
        <CompanyAccountCard
          key={c.id}
          company={c}
          future={future}
          past={past}
          onClickEvent={onClickEvent}
        />
      ))}
    </div>
  );
};

/** Account card with collapsible event lists */
const CompanyAccountCard: React.FC<{
  company: Company;
  future: EventGroup[];
  past: EventGroup[];
  onClickEvent: (g: EventGroup) => void;
}> = ({ company, future, past, onClickEvent }) => {
  const INITIAL = 3;
  const [expF, setExpF] = useState(false);
  const [expP, setExpP] = useState(false);
  const futureShown = expF ? future : future.slice(0, INITIAL);
  const pastShown = expP ? past : past.slice(0, INITIAL);
  const futureMore = future.length - futureShown.length;
  const pastMore = past.length - pastShown.length;

  const renderRow = (g: EventGroup, tone: 'future' | 'past') => {
    const stand = g.companies.find((x) => x.company.id === company.id)?.stand;
    return (
      <button
        key={g.event_id}
        type="button"
        onClick={() => onClickEvent(g)}
        disabled={!g.slug}
        className={`w-full text-left rounded-md p-2 transition-colors disabled:opacity-60 ${
          tone === 'future'
            ? 'bg-primary/5 hover:bg-primary/10 border border-primary/10'
            : 'bg-muted/40 hover:bg-muted border'
        }`}
      >
        <p className={`text-sm font-medium truncate ${tone === 'future' ? 'text-foreground' : 'text-foreground/80'}`}>
          {g.nom_event}
        </p>
        <p className="text-[11px] text-foreground/60 mt-0.5 truncate">
          {formatDate(g.date_debut)}{g.ville ? ` · ${g.ville}` : ''}
          {stand && <span className="ml-2 text-accent font-medium">Stand {stand}</span>}
        </p>
      </button>
    );
  };

  return (
    <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start gap-3">
          <CompanyAvatar company={company} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground truncate">{company.company_name}</p>
            <p className="text-xs text-foreground/60 truncate flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {company.normalized_domain ?? company.website_raw ?? ''}
            </p>
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-xl font-bold text-primary leading-none">{future.length}</p>
            <p className="text-[11px] text-foreground/60 mt-0.5">à venir</p>
          </div>
          <div className="border-l pl-4">
            <p className="text-xl font-bold text-foreground/80 leading-none">{past.length}</p>
            <p className="text-[11px] text-foreground/60 mt-0.5">passés</p>
          </div>
        </div>

        {future.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
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
                className="text-xs font-medium text-foreground/60 hover:underline flex items-center gap-1"
              >
                <ChevronUp className="h-3 w-3" /> Réduire
              </button>
            )}
          </div>
        )}

        {past.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/60">
              Historique passé
            </p>
            {pastShown.map((g) => renderRow(g, 'past'))}
            {pastMore > 0 && (
              <button
                type="button"
                onClick={() => setExpP(true)}
                className="text-xs font-medium text-foreground/70 hover:underline flex items-center gap-1"
              >
                <ChevronDown className="h-3 w-3" /> Voir {pastMore} salon{pastMore > 1 ? 's' : ''} de plus
              </button>
            )}
            {expP && past.length > INITIAL && (
              <button
                type="button"
                onClick={() => setExpP(false)}
                className="text-xs font-medium text-foreground/60 hover:underline flex items-center gap-1"
              >
                <ChevronUp className="h-3 w-3" /> Réduire
              </button>
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

const NoFutureMatches: React.FC<{ companiesCount: number; matchedCount: number }> = ({ companiesCount, matchedCount }) => (
  <Card>
    <CardContent className="pt-8 pb-8 text-center">
      <Sparkles className="h-10 w-10 mx-auto text-primary mb-3" />
      <h3 className="text-lg font-semibold mb-1 text-foreground">
        {matchedCount === 0 ? 'Aucune entreprise détectée pour le moment' : 'Aucun salon à venir détecté'}
      </h3>
      <p className="text-sm text-foreground/70 max-w-md mx-auto mb-4">
        {matchedCount === 0
          ? `Nous n'avons pas trouvé de correspondance exacte entre les ${companiesCount} domaines de votre fichier et les exposants Lotexpo.`
          : "Vos comptes ne sont pas encore inscrits à un salon à venir. Importez un nouveau fichier ou consultez l'historique."}
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