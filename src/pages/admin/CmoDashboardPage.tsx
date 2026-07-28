import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContentSettings, useUpdateContentSetting } from '@/hooks/useContentSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, PauseCircle, PlayCircle } from 'lucide-react';

interface ContentItemRow {
  id: string;
  status: string | null;
  platform: string | null;
  editorial_line: string | null;
  planned_date: string | null;
}

interface IncidentRow {
  id: string;
  severity: string | null;
  incident_type: string | null;
  description: string | null;
  created_at: string;
}

interface StorySeedRow {
  share_safe_status: string | null;
}

const PUBLISHED_STATUSES = ['published', 'measured', 'learned'];
const PRODUCTION_STATUSES = ['copy_ready', 'asset_rendering', 'qa', 'scheduled'];
const BLOCKED_STATUSES = ['blocked', 'failed'];

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const BlockError = ({ message }: { message: string }) => (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Erreur de chargement</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
  </Alert>
);

function useMonthItems() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return useQuery<ContentItemRow[]>({
    queryKey: ['cmo-month-items', toIso(start)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_items')
        .select('id, status, platform, editorial_line, planned_date')
        .gte('planned_date', toIso(start))
        .lte('planned_date', toIso(end));
      if (error) throw error;
      return (data ?? []) as ContentItemRow[];
    },
  });
}

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
    </CardContent>
  </Card>
);

const CmoDashboardPage: React.FC = () => {
  const settings = useContentSettings();
  const updateSetting = useUpdateContentSetting();
  const monthItems = useMonthItems();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const incidents = useQuery<IncidentRow[]>({
    queryKey: ['cmo-open-incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_incidents')
        .select('id, severity, incident_type, description, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as IncidentRow[];
    },
  });

  const seeds = useQuery<StorySeedRow[]>({
    queryKey: ['cmo-story-seeds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_story_seeds')
        .select('share_safe_status');
      if (error) throw error;
      return (data ?? []) as StorySeedRow[];
    },
  });

  const paused = settings.data?.values?.publication_paused === true;
  const pausedRow = settings.data?.rows.find((r) => r.key === 'publication_paused');

  const items = monthItems.data ?? [];
  const count = (list: string[]) => items.filter((i) => i.status && list.includes(i.status)).length;
  const byValue = (field: keyof ContentItemRow, value: string) =>
    items.filter((i) => i[field] === value).length;

  const seedCount = (status: string) =>
    (seeds.data ?? []).filter((s) => s.share_safe_status === status).length;
  const greyZone = seedCount('zone_grise');

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const confirmToggle = async () => {
    await updateSetting.mutateAsync({ key: 'publication_paused', value: !paused });
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Pilotage CMO IA</h1>
        <p className="text-muted-foreground mt-1">
          Vue d'ensemble du système de contenus autonome.
        </p>
      </div>

      {/* Bloc 1 — État de publication */}
      {settings.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : settings.isError ? (
        <BlockError message="Impossible de lire les réglages de publication." />
      ) : (
        <div className="space-y-2">
          <Card className={paused ? 'border-destructive/50 bg-destructive/5' : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {paused ? (
                  <PauseCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <PlayCircle className="h-5 w-5 text-primary" />
                )}
                {paused ? 'Publication en pause' : 'Publication active'}
              </CardTitle>
              <CardDescription>
                {paused
                  ? 'Aucun contenu ne peut être publié sur LinkedIn ni TikTok tant que la publication est en pause.'
                  : 'Le système peut publier selon le calendrier approuvé.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant={paused ? 'default' : 'destructive'}
                onClick={() => setConfirmOpen(true)}
                disabled={updateSetting.isPending}
              >
                {paused ? 'Activer la publication' : 'Mettre en pause'}
              </Button>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Dernière modification : {formatDate(pausedRow?.updated_at)}
          </p>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paused ? 'Activer la publication' : 'Mettre la publication en pause'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paused
                ? 'Cette action autorise le système à publier automatiquement sur les comptes Lotexpo. Confirmer ?'
                : 'Toutes les publications programmées seront suspendues. Confirmer ?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bloc 2 — Le mois en cours */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold capitalize">Le mois en cours — {monthLabel}</h2>
        {monthItems.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : monthItems.isError ? (
          <BlockError message="Impossible de charger les contenus du mois." />
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-muted-foreground">
              Aucun contenu planifié ce mois-ci. Le premier plan mensuel n'a pas encore été généré.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Contenus planifiés" value={items.length} />
              <StatCard label="Publiés" value={count(PUBLISHED_STATUSES)} />
              <StatCard label="En production" value={count(PRODUCTION_STATUSES)} />
              <StatCard label="Bloqués" value={count(BLOCKED_STATUSES)} />
            </div>
            <Card>
              <CardContent className="pt-6 flex flex-wrap gap-2">
                <Badge variant="secondary">LinkedIn : {byValue('platform', 'linkedin')}</Badge>
                <Badge variant="secondary">TikTok : {byValue('platform', 'tiktok')}</Badge>
                <Badge variant="secondary">Les deux : {byValue('platform', 'both')}</Badge>
                <Badge variant="outline">Signal : {byValue('editorial_line', 'signal')}</Badge>
                <Badge variant="outline">Aventure : {byValue('editorial_line', 'aventure')}</Badge>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      {/* Bloc 3 — Incidents ouverts */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Incidents ouverts</h2>
        {incidents.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : incidents.isError ? (
          <BlockError message="Impossible de charger les incidents." />
        ) : (incidents.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-muted-foreground">Aucun incident ouvert.</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 divide-y">
              {(incidents.data ?? []).map((incident) => (
                <div key={incident.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                  <Badge
                    variant={
                      incident.severity === 'critical' || incident.severity === 'high'
                        ? 'destructive'
                        : incident.severity === 'medium'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {incident.severity ?? 'inconnu'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{incident.incident_type ?? 'Incident'}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {incident.description ?? 'Sans description.'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(incident.created_at)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Bloc 4 — Matière narrative */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Matière narrative</h2>
        {seeds.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : seeds.isError ? (
          <BlockError message="Impossible de charger la matière narrative." />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Racontables" value={seedCount('racontable')} />
              <StatCard label="En zone grise" value={greyZone} />
              <StatCard label="Verrouillés" value={seedCount('jamais')} />
            </div>
            {greyZone > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {greyZone} élément{greyZone > 1 ? 's' : ''} narratif{greyZone > 1 ? 's' : ''}{' '}
                  attend{greyZone > 1 ? 'ent' : ''} un arbitrage.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default CmoDashboardPage;
