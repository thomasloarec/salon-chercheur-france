import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Calendar, Inbox, Plus, Radar, Upload } from 'lucide-react';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';

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
  crm_status: string | null;
  owner_name: string | null;
  owner_email: string | null;
  notes: string | null;
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
  visible: boolean | null;
};

type EnrichedMatch = Match & {
  company: Company | undefined;
  view: ParticipationViewRow | undefined;
  eventSlug?: string | null;
};

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const RadarCrmResults: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [imports, setImports] = useState<Import[] | null>(null);
  const [activeImportId, setActiveImportId] = useState<string | null>(searchParams.get('importId'));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [viewRows, setViewRows] = useState<ParticipationViewRow[]>([]);
  const [eventSlugs, setEventSlugs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
        .select('id, company_name, website_raw, normalized_domain, crm_status, owner_name, owner_email, notes')
        .eq('import_id', activeImportId);
      const compList = (comps ?? []) as Company[];
      setCompanies(compList);

      if (compList.length === 0) {
        setMatches([]); setViewRows([]); setEventSlugs({});
        setLoading(false);
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

        const [{ data: vrows }, { data: ev }] = await Promise.all([
          supabase
            .from('crm_radar_participations_view')
            .select('id_exposant, nom_exposant, event_id, nom_event, type_event, date_debut, date_fin, ville, nom_lieu, stand_exposants_list, is_future_event, days_until_event, visible')
            .in('event_id', eventIds)
            .in('id_exposant', exposantIds),
          supabase
            .from('events')
            .select('id, slug')
            .in('id', eventIds),
        ]);
        setViewRows((vrows ?? []) as ParticipationViewRow[]);
        const slugMap: Record<string, string> = {};
        (ev ?? []).forEach((e: any) => { if (e?.id && e?.slug) slugMap[e.id] = e.slug; });
        setEventSlugs(slugMap);
      } else {
        setViewRows([]); setEventSlugs({});
      }
      setLoading(false);
    })();
  }, [activeImportId, user]);

  const enriched: EnrichedMatch[] = useMemo(() => {
    const cMap = new Map(companies.map((c) => [c.id, c]));
    const vMap = new Map(viewRows.map((v) => [`${v.event_id}|${v.id_exposant}`, v]));
    return matches.map((m) => ({
      ...m,
      company: cMap.get(m.crm_company_id),
      view: vMap.get(`${m.event_id}|${m.id_exposant}`),
      eventSlug: eventSlugs[m.event_id] ?? null,
    }));
  }, [matches, companies, viewRows, eventSlugs]);

  const futureMatches = useMemo(
    () => enriched
      .filter((e) => e.view?.date_debut && new Date(e.view.date_debut) >= new Date(new Date().toDateString()))
      .sort((a, b) => (a.view?.days_until_event ?? 9999) - (b.view?.days_until_event ?? 9999)),
    [enriched],
  );
  const pastMatches = useMemo(
    () => enriched
      .filter((e) => e.view?.date_debut && new Date(e.view.date_debut) < new Date(new Date().toDateString()))
      .sort((a, b) => (b.view?.date_debut ?? '').localeCompare(a.view?.date_debut ?? '')),
    [enriched],
  );

  const matchedCompanyIds = useMemo(() => new Set(matches.map((m) => m.crm_company_id)), [matches]);
  const matchedCompanies = useMemo(() => companies.filter((c) => matchedCompanyIds.has(c.id)), [companies, matchedCompanyIds]);
  const unmatchedCompanies = useMemo(() => companies.filter((c) => !matchedCompanyIds.has(c.id)), [companies, matchedCompanyIds]);

  const onClickEvent = (eventId: string, slug: string | null) => {
    void trackRadarEvent('crm_event_clicked', { eventId });
    if (slug) navigate(`/events/${slug}`);
  };

  // Empty state
  if (!authLoading && imports !== null && imports.length === 0) {
    return <RadarEmptyState />;
  }

  return (
    <>
      <Helmet>
        <title>Mes résultats Radar CRM | Lotexpo</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Radar className="h-7 w-7 text-primary" /> Radar CRM
              </h1>
              <p className="text-muted-foreground text-sm">
                Vos comptes CRM détectés sur les salons Lotexpo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {imports && imports.length > 0 && (
                <Select
                  value={activeImportId ?? ''}
                  onValueChange={(v) => setActiveImportId(v)}
                >
                  <SelectTrigger className="w-[260px]">
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
              <Button asChild variant="default">
                <Link to="/radar-crm">
                  <Plus className="h-4 w-4 mr-2" /> Nouvel import
                </Link>
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Entreprises importées" value={companies.length} />
            <SummaryCard label="Matchées" value={matchedCompanies.length} accent="success" />
            <SummaryCard label="Non matchées" value={unmatchedCompanies.length} />
            <SummaryCard label="Salons à venir" value={futureMatches.length} accent="primary" />
            <SummaryCard label="Salons passés" value={pastMatches.length} />
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="future">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="future">Opportunités à venir ({futureMatches.length})</TabsTrigger>
                <TabsTrigger value="past">Événements passés ({pastMatches.length})</TabsTrigger>
                <TabsTrigger value="matched">Matchées ({matchedCompanies.length})</TabsTrigger>
                <TabsTrigger value="unmatched" onClick={() => trackRadarEvent('crm_unmatched_viewed')}>
                  Non matchées ({unmatchedCompanies.length})
                </TabsTrigger>
                <TabsTrigger value="history">Historique ({imports?.length ?? 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="future" className="mt-4">
                <MatchesTable rows={futureMatches} onClickEvent={onClickEvent} showDaysLeft />
              </TabsContent>

              <TabsContent value="past" className="mt-4">
                <MatchesTable rows={pastMatches} onClickEvent={onClickEvent} />
              </TabsContent>

              <TabsContent value="matched" className="mt-4">
                <MatchedCompaniesTable companies={matchedCompanies} matches={enriched} />
              </TabsContent>

              <TabsContent value="unmatched" className="mt-4">
                <UnmatchedTable companies={unmatchedCompanies} />
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <ImportsHistory imports={imports ?? []} onSelect={setActiveImportId} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; accent?: 'primary' | 'success' }> = ({ label, value, accent }) => (
  <Card>
    <CardContent className="pt-6">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent === 'primary' ? 'text-primary' : ''}`}>{value}</p>
    </CardContent>
  </Card>
);

const MatchesTable: React.FC<{
  rows: EnrichedMatch[];
  onClickEvent: (id: string, slug: string | null) => void;
  showDaysLeft?: boolean;
}> = ({ rows, onClickEvent, showDaysLeft }) => {
  if (rows.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <Inbox className="h-8 w-8 mx-auto mb-2" />
        Aucun résultat dans cette catégorie.
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <Th>Entreprise CRM</Th>
            <Th>Statut</Th>
            <Th>Owner</Th>
            <Th>Événement</Th>
            <Th>Date</Th>
            <Th>Ville</Th>
            <Th>Stand(s)</Th>
            {showDaysLeft && <Th>J-</Th>}
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <Td className="font-medium">{r.company?.company_name}</Td>
              <Td>{r.company?.crm_status ? <Badge variant="secondary">{r.company.crm_status}</Badge> : '—'}</Td>
              <Td>{r.company?.owner_name ?? '—'}</Td>
              <Td>{r.view?.nom_event ?? '—'}</Td>
              <Td>{formatDate(r.view?.date_debut)}</Td>
              <Td>{r.view?.ville ?? '—'}</Td>
              <Td className="max-w-[200px] truncate" title={r.view?.stand_exposants_list ?? ''}>
                {r.view?.stand_exposants_list ?? '—'}
              </Td>
              {showDaysLeft && <Td>{r.view?.days_until_event ?? '—'}</Td>}
              <Td>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onClickEvent(r.event_id, r.eventSlug ?? null)}
                  disabled={!r.eventSlug}
                >
                  Voir <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MatchedCompaniesTable: React.FC<{ companies: Company[]; matches: EnrichedMatch[] }> = ({ companies, matches }) => {
  if (companies.length === 0) return <EmptyText label="Aucune entreprise matchée." />;
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <Th>Entreprise</Th><Th>Domaine</Th><Th>Salons à venir</Th><Th>Salons passés</Th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const own = matches.filter((m) => m.crm_company_id === c.id);
            const future = own.filter((m) => m.view?.date_debut && new Date(m.view.date_debut) >= new Date()).length;
            const past = own.length - future;
            return (
              <tr key={c.id} className="border-t">
                <Td className="font-medium">{c.company_name}</Td>
                <Td className="text-muted-foreground">{c.normalized_domain ?? '—'}</Td>
                <Td>{future}</Td>
                <Td>{past}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const UnmatchedTable: React.FC<{ companies: Company[] }> = ({ companies }) => {
  if (companies.length === 0) return <EmptyText label="Toutes les entreprises ont été matchées." />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">
        Le matching MVP est basé sur une correspondance exacte du domaine web. Certains groupes utilisant des sous-domaines ou des sites pays peuvent ne pas être détectés automatiquement.
      </p>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr><Th>Entreprise</Th><Th>Site web importé</Th><Th>Domaine normalisé</Th><Th>Raison probable</Th></tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              let reason = 'Aucun exposant Lotexpo connu avec ce domaine';
              if (!c.website_raw) reason = 'Site web manquant';
              else if (!c.normalized_domain) reason = 'Domaine invalide';
              return (
                <tr key={c.id} className="border-t">
                  <Td className="font-medium">{c.company_name}</Td>
                  <Td className="text-muted-foreground max-w-xs truncate">{c.website_raw ?? '—'}</Td>
                  <Td className="text-muted-foreground">{c.normalized_domain ?? '—'}</Td>
                  <Td>{reason}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ImportsHistory: React.FC<{ imports: Import[]; onSelect: (id: string) => void }> = ({ imports, onSelect }) => {
  if (imports.length === 0) return <EmptyText label="Aucun import pour le moment." />;
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr><Th>Date</Th><Th>Fichier</Th><Th>Statut</Th><Th>Lignes</Th><Th>Matchées</Th><Th>Non matchées</Th><Th></Th></tr>
        </thead>
        <tbody>
          {imports.map((i) => (
            <tr key={i.id} className="border-t">
              <Td>{formatDate(i.created_at)}</Td>
              <Td className="font-medium">{i.file_name ?? '—'}</Td>
              <Td><Badge variant={i.status === 'completed' ? 'secondary' : i.status === 'failed' ? 'destructive' : 'outline'}>{i.status}</Badge></Td>
              <Td>{i.total_rows ?? 0}</Td>
              <Td>{i.matched_companies_count ?? 0}</Td>
              <Td>{i.unmatched_companies_count ?? 0}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => onSelect(i.id)}>Voir</Button></Td>
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

const RadarEmptyState: React.FC = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-3xl mx-auto px-4 py-12 text-center">
      <Radar className="h-12 w-12 mx-auto text-primary mb-3" />
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Votre Radar CRM est vide pour le moment</h1>
      <p className="text-muted-foreground mb-6">
        Importez une liste de prospects, clients, partenaires ou concurrents. Lotexpo détectera automatiquement les événements où ces entreprises exposent.
      </p>

      <Card className="text-left mb-6">
        <CardHeader>
          <CardTitle className="text-base">Exemple de résultat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3 mb-2">
            <Demo n="42" l="entreprises analysées" />
            <Demo n="8" l="détectées sur des salons à venir" />
            <Demo n="13" l="participations passées" />
          </div>
          <div className="border rounded-md p-3 bg-muted/30">
            <p className="font-medium">ACME Industries <span className="text-muted-foreground text-xs">— Prospect</span></p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="h-3 w-3" /> Global Industrie · 25 mars 2026 · Paris · Hall 4 - B32
            </p>
          </div>
        </CardContent>
      </Card>

      <Button asChild size="lg">
        <Link to="/radar-crm"><Upload className="h-4 w-4 mr-2" /> Importer mon fichier CSV</Link>
      </Button>
    </div>
  </div>
);

const Demo: React.FC<{ n: string; l: string }> = ({ n, l }) => (
  <div className="border rounded-md p-3">
    <p className="text-xl font-bold text-primary">{n}</p>
    <p className="text-xs text-muted-foreground">{l}</p>
  </div>
);

export default RadarCrmResults;
