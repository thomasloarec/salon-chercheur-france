import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Heart, CalendarPlus, ChevronRight, Flame, AlertCircle,
} from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import { toast } from '@/hooks/use-toast';
import { useToggleFavorite } from '@/hooks/useFavorites';
import { downloadIcs } from '@/lib/radarCrm/icsExport';

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
};

type ParticipationViewRow = {
  id_exposant: string;
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
    stand: string | null;
  }>;
}

const RadarCrmResults: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imports, setImports] = useState<Import[] | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(searchParams.get('importId'));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [viewRows, setViewRows] = useState<ParticipationViewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const toggleFav = useToggleFavorite();

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
        .select('id, crm_company_id, id_exposant, event_id, normalized_domain')
        .in('crm_company_id', compList.map((c) => c.id));
      const matchList = (mts ?? []) as Match[];
      setMatches(matchList);

      if (matchList.length > 0) {
        const eventIds = Array.from(new Set(matchList.map((m) => m.event_id)));
        const exposantIds = Array.from(new Set(matchList.map((m) => m.id_exposant)));
        const { data: vrows } = await supabase
          .from('crm_radar_participations_view')
          .select('id_exposant, event_id, nom_event, type_event, date_debut, date_fin, ville, nom_lieu, stand_exposants_list, is_future_event, days_until_event, url_image, slug')
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
      // dedupe by company id
      if (!g.companies.find((x) => x.company.id === c.id)) {
        g.companies.push({ company: c, stand: v.stand_exposants_list ?? null });
      }
    }
    return Array.from(groups.values());
  }, [matches, viewMap, companyMap]);

  const futureGroups = useMemo(
    () => eventGroups.filter((g) => g.is_future)
      .sort((a, b) => {
        const da = a.days_until ?? 9999;
        const db = b.days_until ?? 9999;
        if (da !== db) return da - db;
        return b.companies.length - a.companies.length;
      }),
    [eventGroups],
  );
  const pastGroups = useMemo(
    () => eventGroups.filter((g) => !g.is_future)
      .sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? '')),
    [eventGroups],
  );

  const matchedCompanyIds = useMemo(() => new Set(matches.map((m) => m.crm_company_id)), [matches]);
  const matchedCompanies = useMemo(() => companies.filter((c) => matchedCompanyIds.has(c.id)), [companies, matchedCompanyIds]);
  const unmatchedCompanies = useMemo(() => companies.filter((c) => !matchedCompanyIds.has(c.id)), [companies, matchedCompanyIds]);

  const nextEvent = futureGroups[0];

  const onClickEvent = (g: EventGroup) => {
    void trackRadarEvent('crm_event_detail_clicked', { eventId: g.event_id });
    void trackRadarEvent('crm_event_clicked', { eventId: g.event_id });
    if (g.slug) navigate(`/events/${g.slug}`);
    else toast({ title: 'Page événement indisponible', description: 'Le slug est manquant.' });
  };

  const onFavorite = async (g: EventGroup) => {
    try {
      void trackRadarEvent('crm_favorite_clicked', { eventId: g.event_id });
      await toggleFav.mutateAsync(g.event_id);
      toast({ title: 'Favori mis à jour' });
    } catch (e) {
      toast({ title: 'Action impossible', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const onCalendar = (g: EventGroup) => {
    if (!g.date_debut) return;
    void trackRadarEvent('crm_calendar_clicked', { eventId: g.event_id });
    const stands = g.companies.map((c) => c.stand).filter(Boolean).join(', ');
    const desc = `Entreprises de votre CRM détectées : ${g.companies.map((c) => c.company.company_name).join(', ')}.${stands ? ` Stands : ${stands}.` : ''}`;
    downloadIcs({
      uid: g.event_id,
      title: g.nom_event,
      start: g.date_debut,
      end: g.date_fin ?? g.date_debut,
      location: [g.nom_lieu, g.ville].filter(Boolean).join(', '),
      description: desc,
    });
  };

  // Empty state (no imports at all)
  if (!authLoading && imports !== null && imports.length === 0) {
    return (
      <MainLayout title="Mon Radar CRM | Lotexpo">
        <RadarEmptyState />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Mon Radar CRM | Lotexpo">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Radar className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Votre Radar CRM</h1>
            </div>
            <p className="text-muted-foreground text-sm md:text-base">
              {loading ? 'Analyse en cours…' :
                <>Nous avons détecté <strong className="text-foreground">{matchedCompanies.length}</strong> entreprise{matchedCompanies.length > 1 ? 's' : ''} de votre fichier sur <strong className="text-foreground">{eventGroups.length}</strong> salon{eventGroups.length > 1 ? 's' : ''} Lotexpo.</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {imports && imports.length > 1 && (
              <Select value={activeImportId ?? ''} onValueChange={setActiveImportId}>
                <SelectTrigger className="w-[240px]">
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Entreprises analysées" value={companies.length} />
          <StatCard label="Entreprises détectées" value={matchedCompanies.length} accent="success" />
          <StatCard label="Salons à venir" value={futureGroups.length} accent="primary" icon={<Sparkles className="h-4 w-4" />} />
          <StatCard label="Participations futures" value={matches.filter((m) => {
            const v = viewMap.get(`${m.event_id}|${m.id_exposant}`);
            return v?.is_future_event;
          }).length} />
          <StatCard
            label="Prochain événement"
            value={nextEvent?.days_until != null ? `J-${Math.max(0, nextEvent.days_until)}` : '—'}
            sub={nextEvent?.nom_event ?? undefined}
            accent="accent"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <Tabs defaultValue="future">
              <TabsList>
                <TabsTrigger value="future">À venir ({futureGroups.length})</TabsTrigger>
                <TabsTrigger value="past">Historique passé ({pastGroups.length})</TabsTrigger>
                <TabsTrigger value="companies">Entreprises détectées ({matchedCompanies.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="future" className="mt-5">
                {futureGroups.length === 0 ? (
                  <NoFutureMatches companiesCount={companies.length} matchedCount={matchedCompanies.length} />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {futureGroups.map((g) => (
                      <EventCard
                        key={g.event_id}
                        group={g}
                        onView={() => onClickEvent(g)}
                        onFavorite={() => onFavorite(g)}
                        onCalendar={() => onCalendar(g)}
                      />
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
                      <PastEventRow key={g.event_id} group={g} onView={() => onClickEvent(g)} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="companies" className="mt-5">
                <CompanyAccountsList groups={eventGroups} companies={matchedCompanies} onView={onClickEvent} />
              </TabsContent>
            </Tabs>

            {/* Detail table (secondary) */}
            {eventGroups.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="detail">
                  <AccordionTrigger className="text-sm text-muted-foreground">
                    Voir le détail en tableau
                  </AccordionTrigger>
                  <AccordionContent>
                    <DetailTable groups={eventGroups} onView={onClickEvent} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Unmatched (collapsible secondary block) */}
            {unmatchedCompanies.length > 0 && (
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <Accordion
                    type="single"
                    collapsible
                    onValueChange={(v) => v && trackRadarEvent('crm_unmatched_list_opened', { count: unmatchedCompanies.length })}
                  >
                    <AccordionItem value="unmatched" className="border-none">
                      <AccordionTrigger className="hover:no-underline py-2">
                        <div className="flex items-start gap-3 text-left">
                          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="font-semibold text-base">
                              Entreprises non détectées dans Lotexpo
                            </p>
                            <p className="text-sm text-muted-foreground font-normal">
                              {unmatchedCompanies.length} entreprise{unmatchedCompanies.length > 1 ? 's' : ''} de votre fichier n'ont pas été retrouvées dans les exposants Lotexpo.
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-xs text-muted-foreground bg-background rounded p-3 mb-3">
                          Le matching MVP est basé sur une correspondance exacte du domaine web.
                          Certains groupes utilisant des sous-domaines ou des sites pays peuvent ne pas être détectés automatiquement.
                        </p>
                        <div className="border rounded-lg overflow-x-auto bg-background">
                          <table className="min-w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr><Th>Entreprise</Th><Th>Site importé</Th><Th>Domaine</Th></tr>
                            </thead>
                            <tbody>
                              {unmatchedCompanies.slice(0, 100).map((c) => (
                                <tr key={c.id} className="border-t">
                                  <Td className="font-medium">{c.company_name}</Td>
                                  <Td className="text-muted-foreground max-w-xs truncate">{c.website_raw ?? '—'}</Td>
                                  <Td className="text-muted-foreground">{c.normalized_domain ?? '—'}</Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {unmatchedCompanies.length > 100 && (
                            <p className="text-xs text-muted-foreground p-3">
                              + {unmatchedCompanies.length - 100} autres entreprises non affichées.
                            </p>
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
    </MainLayout>
  );
};

/* ────────────────────────── Sub-components ────────────────────────── */

const StatCard: React.FC<{
  label: string; value: number | string; sub?: string;
  accent?: 'primary' | 'success' | 'accent'; icon?: React.ReactNode;
}> = ({ label, value, sub, accent, icon }) => {
  const tone =
    accent === 'primary' ? 'border-primary/30 bg-primary/5' :
    accent === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' :
    accent === 'accent'  ? 'border-orange-500/30 bg-orange-500/5' :
    'bg-card';
  const valueTone =
    accent === 'primary' ? 'text-primary' :
    accent === 'success' ? 'text-emerald-600' :
    accent === 'accent'  ? 'text-orange-600' : '';
  return (
    <Card className={tone}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}<span>{label}</span>
        </div>
        <p className={`text-2xl font-bold leading-tight ${valueTone}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1 truncate" title={sub}>{sub}</p>}
      </CardContent>
    </Card>
  );
};

const priorityFor = (n: number): { label: string; tone: string } | null => {
  if (n >= 3) return { label: `Priorité forte · ${n} comptes`, tone: 'bg-orange-500 text-white' };
  if (n === 2) return { label: '2 comptes détectés', tone: 'bg-primary text-primary-foreground' };
  if (n === 1) return { label: 'Opportunité', tone: 'bg-secondary text-secondary-foreground' };
  return null;
};

const EventCard: React.FC<{
  group: EventGroup;
  onView: () => void;
  onFavorite: () => void;
  onCalendar: () => void;
}> = ({ group, onView, onFavorite, onCalendar }) => {
  useEffect(() => { void trackRadarEvent('crm_result_event_card_viewed', { eventId: group.event_id }); }, [group.event_id]);
  const prio = priorityFor(group.companies.length);
  const visibleCompanies = group.companies.slice(0, 5);
  const more = group.companies.length - visibleCompanies.length;
  const stands = Array.from(new Set(group.companies.map((c) => c.stand).filter(Boolean))) as string[];

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
      {/* Image header */}
      <div className="relative h-36 w-full overflow-hidden">
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
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent, var(--primary))))' }}
          >
            <span className="text-3xl font-bold text-primary-foreground tracking-wider opacity-80">
              {eventInitials(group.nom_event)}
            </span>
          </div>
        )}
        {prio && (
          <Badge className={`absolute top-3 left-3 ${prio.tone} border-none`}>
            <Flame className="h-3 w-3 mr-1" /> {prio.label}
          </Badge>
        )}
        {group.days_until != null && (
          <Badge variant="secondary" className="absolute top-3 right-3 backdrop-blur bg-background/80">
            J-{Math.max(0, group.days_until)}
          </Badge>
        )}
      </div>

      <CardContent className="pt-5 flex-1 flex flex-col">
        <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">{group.nom_event}</h3>
        <div className="text-sm text-muted-foreground space-y-1 mb-3">
          <p className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(group.date_debut)}
            {group.date_fin && group.date_fin !== group.date_debut ? ` → ${formatDate(group.date_fin)}` : ''}
          </p>
          {(group.ville || group.nom_lieu) && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {[group.nom_lieu, group.ville].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {group.companies.length} entreprise{group.companies.length > 1 ? 's' : ''} de votre CRM détectée{group.companies.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleCompanies.map(({ company }) => (
              <Badge key={company.id} variant="outline" className="font-normal">
                {company.company_name}
              </Badge>
            ))}
            {more > 0 && (
              <Badge variant="secondary" className="font-normal">+ {more} autres</Badge>
            )}
          </div>
        </div>

        {stands.length > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            <strong>Stand{stands.length > 1 ? 's' : ''} :</strong> {stands.join(' · ')}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          <Button size="sm" onClick={onView} disabled={!group.slug}>
            Voir l'événement <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button size="sm" variant="outline" onClick={onFavorite}>
            <Heart className="h-3.5 w-3.5 mr-1" /> Favoris
          </Button>
          <Button size="sm" variant="outline" onClick={onCalendar}>
            <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agenda
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const PastEventRow: React.FC<{ group: EventGroup; onView: () => void }> = ({ group, onView }) => (
  <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
    <div className="h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
      {group.url_image ? (
        <img src={group.url_image} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
          {eventInitials(group.nom_event)}
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate">{group.nom_event}</p>
      <p className="text-xs text-muted-foreground">
        {formatDate(group.date_debut)} · {group.ville ?? '—'} · {group.companies.length} compte{group.companies.length > 1 ? 's' : ''}
      </p>
    </div>
    <Button size="sm" variant="ghost" onClick={onView} disabled={!group.slug}>
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

const CompanyAccountsList: React.FC<{
  groups: EventGroup[]; companies: Company[]; onView: (g: EventGroup) => void;
}> = ({ groups, companies, onView }) => {
  if (companies.length === 0) return <EmptyText label="Aucune entreprise détectée." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {companies.map((c) => {
        const compGroups = groups.filter((g) => g.companies.some((x) => x.company.id === c.id));
        const future = compGroups.filter((g) => g.is_future).sort((a, b) => (a.days_until ?? 9999) - (b.days_until ?? 9999));
        const past = compGroups.filter((g) => !g.is_future);
        const next = future[0];
        return (
          <Card key={c.id}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.company_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.normalized_domain ?? c.website_raw ?? ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Salons à venir</p>
                  <p className="font-bold text-primary">{future.length}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">Salons passés</p>
                  <p className="font-bold">{past.length}</p>
                </div>
              </div>
              {next && (
                <p className="text-xs text-muted-foreground mb-2">
                  <strong>Prochain :</strong> {next.nom_event} · {formatDate(next.date_debut)}
                </p>
              )}
              {next && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => onView(next)}>
                  Voir les événements <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
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
              <Td className="font-medium">{c.company.company_name}</Td>
              <Td>{g.nom_event}</Td>
              <Td>{formatDate(g.date_debut)}</Td>
              <Td>{g.ville ?? '—'}</Td>
              <Td className="max-w-[180px] truncate">{c.stand ?? '—'}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => onView(g)} disabled={!g.slug}>Voir</Button></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Th: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, ...p }) => (
  <th {...p} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{children}</th>
);
const Td: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...p }) => (
  <td {...p} className={`px-3 py-2 ${className}`}>{children}</td>
);
const EmptyText: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center text-muted-foreground py-12">{label}</div>
);

const NoFutureMatches: React.FC<{ companiesCount: number; matchedCount: number }> = ({ companiesCount, matchedCount }) => (
  <Card>
    <CardContent className="pt-8 pb-8 text-center">
      <Sparkles className="h-10 w-10 mx-auto text-primary mb-3" />
      <h3 className="text-lg font-semibold mb-1">
        {matchedCount === 0 ? 'Aucune entreprise détectée pour le moment' : 'Aucun salon à venir détecté'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
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
    <div className="h-14 w-14 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center mb-4">
      <Radar className="h-7 w-7 text-primary" />
    </div>
    <h1 className="text-2xl md:text-3xl font-bold mb-2">Votre Radar CRM est vide</h1>
    <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
      Imaginez importer votre liste de 300 prospects et découvrir en quelques secondes que 12 d'entre eux
      exposent sur des salons dans les 60 prochains jours.
    </p>

    <Card className="text-left mb-6 overflow-hidden">
      <div className="grid grid-cols-3 gap-0 border-b">
        <Demo n="42" l="entreprises analysées" />
        <Demo n="8" l="salons à venir" accent />
        <Demo n="13" l="participations passées" />
      </div>
      <CardContent className="pt-5">
        <div className="border rounded-md p-3 bg-muted/30">
          <p className="font-medium">ACME Industries <span className="text-muted-foreground text-xs">— Prospect</span></p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3" /> Global Industrie · 25 mars 2026 · Paris · Stand B32
          </p>
        </div>
      </CardContent>
    </Card>

    <Button asChild size="lg">
      <Link to="/radar-crm"><Upload className="h-4 w-4 mr-2" /> Importer mon fichier CSV</Link>
    </Button>
  </div>
);

const Demo: React.FC<{ n: string; l: string; accent?: boolean }> = ({ n, l, accent }) => (
  <div className="p-4 text-center">
    <p className={`text-2xl font-bold ${accent ? 'text-primary' : ''}`}>{n}</p>
    <p className="text-xs text-muted-foreground">{l}</p>
  </div>
);

export default RadarCrmResults;