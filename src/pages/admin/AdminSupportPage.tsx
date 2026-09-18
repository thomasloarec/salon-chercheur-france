import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAdminSupportInbox } from '@/components/admin/support/useAdminSupportInbox';
import { useAdminSupport } from '@/components/admin/support/AdminSupportWidget';

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  pending_user: 'En attente du demandeur',
  resolved: 'Résolu',
  closed: 'Clos',
};

const waitingLabel = (minutes: number) => {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
};

type SupportStats = {
  period_days: number;
  threads_total: number;
  threads_open: number;
  threads_resolved: number;
  threads_escalated: number;
  messages_total: number;
  first_reply_minutes_median: number | null;
  first_reply_minutes_p90: number | null;
  answered_under_delay_rate: number | null;
  resolution_rate: number | null;
  oldest_waiting_minutes: number | null;
  by_topic: { topic: string | null; count: number }[] | null;
  by_context: { context_type: string; count: number }[] | null;
  by_day: { day: string; count: number }[] | null;
};

const num = (value: number | null | undefined, suffix = '') =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? '-'
    : `${Math.round(Number(value))}${suffix}`;

const csvCell = (value: unknown) => {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
};

const AdminSupportPage = () => {
  const { data, isLoading } = useAdminSupportInbox();
  const { openThread } = useAdminSupport();
  const [status, setStatus] = useState<string>('all');
  const [contextType, setContextType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState<string>('30');
  const [exporting, setExporting] = useState(false);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ['admin-support-stats', days],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc('support_stats', {
        p_days: Number(days),
      });
      if (error) throw error;
      return result as unknown as SupportStats;
    },
  });

  const threads = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads
      .filter((t) => (status === 'all' ? true : t.status === status))
      .filter((t) => (contextType === 'all' ? true : t.context_type === contextType))
      .filter((t) =>
        q
          ? (t.entity_label ?? '').toLowerCase().includes(q) ||
            (t.requester_email ?? '').toLowerCase().includes(q)
          : true,
      )
      .slice()
      .sort((a, b) => (b.minutes_waiting ?? 0) - (a.minutes_waiting ?? 0));
  }, [threads, status, contextType, search]);

  const byDay = useMemo(
    () =>
      (stats?.by_day ?? []).map((d) => ({
        day: d.day,
        label: new Date(d.day).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
        }),
        count: Number(d.count) || 0,
      })),
    [stats],
  );

  const byTopic = useMemo(() => {
    const list = (stats?.by_topic ?? []).map((t) => ({
      topic: t.topic || 'Non précisé',
      count: Number(t.count) || 0,
    }));
    const total = list.reduce((sum, t) => sum + t.count, 0);
    return list
      .sort((a, b) => b.count - a.count)
      .map((t) => ({ ...t, pct: total ? Math.round((t.count / total) * 100) : 0 }));
  }, [stats]);

  const contextCount = (type: string) =>
    Number((stats?.by_context ?? []).find((c) => c.context_type === type)?.count ?? 0);

  const oldestWaiting = stats?.oldest_waiting_minutes ?? null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: rowsExport, error } = await supabase.rpc('support_feedback_export', {
        p_days: Number(days),
      });
      if (error) throw error;
      const list = rowsExport ?? [];
      if (list.length === 0) {
        toast.info('Aucune donnée à exporter sur cette période.');
        return;
      }
      const headers = [
        'Date',
        'Type de compte',
        'Entité',
        'Motif',
        'Statut',
        'Email du demandeur',
        'Premier message',
        'Nombre de messages',
        'Délai de première réponse (min)',
        'Escaladé',
      ];
      const lines = [
        headers.map(csvCell).join(';'),
        ...list.map((r) =>
          [
            r.created_at,
            r.context_type === 'exhibitor' ? 'Exposant' : 'Organisateur',
            r.entity_label,
            r.topic || 'Non précisé',
            STATUS_LABELS[r.status] ?? r.status,
            r.requester_email,
            r.first_message,
            r.message_count,
            r.first_reply_minutes ?? '',
            r.escalated ? 'Oui' : 'Non',
          ]
            .map(csvCell)
            .join(';'),
        ),
      ];
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feedback-support-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[support] export failed', err);
      toast.error("L'export du feedback a échoué. Réessayez dans un instant.");
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    {
      title: 'Demandes reçues',
      value: statsLoading ? '...' : num(stats?.threads_total),
      hint: `Sur ${days} jours`,
    },
    {
      title: 'Délai médian de première réponse',
      value: statsLoading ? '...' : num(stats?.first_reply_minutes_median, ' min'),
      hint: `p90 : ${statsLoading ? '...' : num(stats?.first_reply_minutes_p90, ' min')}`,
    },
    {
      title: 'Répondu avant escalade',
      value: statsLoading ? '...' : num(stats?.answered_under_delay_rate, ' %'),
      hint: 'Part des demandes',
    },
    {
      title: 'Taux de résolution',
      value: statsLoading ? '...' : num(stats?.resolution_rate, ' %'),
      hint: 'Demandes résolues ou closes',
    },
    {
      title: 'Plus ancienne demande en attente',
      value: statsLoading ? '...' : num(oldestWaiting, ' min'),
      hint: 'Temps depuis le dernier message',
      alert: (oldestWaiting ?? 0) > 5,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demandes d'aide</h1>
          <p className="text-muted-foreground mt-1">
            Conversations de support des exposants et des organisateurs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Export en cours' : 'Exporter le feedback'}
          </Button>
        </div>
      </div>

      {statsError && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">
            Les indicateurs n'ont pas pu être chargés. Actualisez la page pour réessayer.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  'text-2xl font-bold',
                  card.alert ? 'text-destructive' : undefined,
                )}
              >
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{card.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Demandes par jour</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : byDay.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Aucune demande sur cette période.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value: number) => [`${value}`, 'Demandes']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition par motif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : byTopic.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Aucun motif enregistré sur cette période.
              </p>
            ) : (
              <div className="space-y-3">
                {byTopic.map((t) => (
                  <div key={t.topic} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{t.topic}</span>
                      <span className="text-muted-foreground shrink-0">
                        {t.count} · {t.pct} %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(2, t.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground border-t pt-3">
              Par type de compte : {contextCount('exhibitor')} exposant
              {contextCount('exhibitor') > 1 ? 's' : ''} et {contextCount('organizer')}{' '}
              organisateur{contextCount('organizer') > 1 ? 's' : ''}.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Fils de discussion
            <Badge variant="secondary" className="ml-2">
              {rows.length}
            </Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une entreprise ou un email"
              className="sm:w-64"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="open">Ouvert</SelectItem>
                <SelectItem value="pending_user">En attente du demandeur</SelectItem>
                <SelectItem value="resolved">Résolu</SelectItem>
                <SelectItem value="closed">Clos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contextType} onValueChange={setContextType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type de compte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les comptes</SelectItem>
                <SelectItem value="exhibitor">Exposant</SelectItem>
                <SelectItem value="organizer">Organisateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune demande ne correspond à ces filtres.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entité</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Demandeur</TableHead>
                    <TableHead>Dernier message</TableHead>
                    <TableHead>Attente</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((thread) => (
                    <TableRow
                      key={thread.thread_id}
                      className="cursor-pointer"
                      onClick={() => openThread(thread.thread_id)}
                    >
                      <TableCell className="font-medium">
                        {thread.entity_label}
                        {thread.admin_unread_count > 0 && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            {thread.admin_unread_count}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {thread.context_type === 'exhibitor' ? 'Exposant' : 'Organisateur'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {thread.topic || 'Non précisé'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {thread.requester_name || thread.requester_email || 'Inconnu'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {thread.last_message_preview}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-sm',
                          thread.minutes_waiting > 5
                            ? 'text-destructive font-medium'
                            : 'text-muted-foreground',
                        )}
                      >
                        {waitingLabel(thread.minutes_waiting ?? 0)}
                        {thread.escalated_at ? ' · escaladé' : ''}
                      </TableCell>
                      <TableCell className="text-sm">
                        {STATUS_LABELS[thread.status] ?? thread.status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSupportPage;
