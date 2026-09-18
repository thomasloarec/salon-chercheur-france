import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

const AdminSupportPage = () => {
  const { data, isLoading } = useAdminSupportInbox();
  const { openThread } = useAdminSupport();
  const [status, setStatus] = useState<string>('all');
  const [contextType, setContextType] = useState<string>('all');
  const [search, setSearch] = useState('');

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

  const todo = threads.filter(
    (t) => (t.admin_unread_count ?? 0) > 0 || t.status === 'open',
  ).length;
  const oldest = threads.reduce((max, t) => Math.max(max, t.minutes_waiting ?? 0), 0);
  const resolved30 = threads.filter(
    (t) =>
      (t.status === 'resolved' || t.status === 'closed') &&
      t.last_admin_message_at &&
      Date.now() - new Date(t.last_admin_message_at).getTime() < 30 * 24 * 3600 * 1000,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes d'aide</h1>
        <p className="text-muted-foreground mt-1">
          Conversations de support des exposants et des organisateurs
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fils à traiter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? '...' : todo}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attente la plus ancienne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? '...' : waitingLabel(oldest)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Résolus sur 30 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isLoading ? '...' : resolved30}</p>
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
