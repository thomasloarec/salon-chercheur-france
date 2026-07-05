import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Building2, Users, Loader2 } from 'lucide-react';

interface RadarSpaceRow {
  account_id: string;
  name: string | null;
  org_name: string | null;
  plan: string;
  trial_ends_at: string | null;
  members: number;
  companies: number;
  created_at: string;
}

interface RadarSpaceMember {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
  last_seen_at: string | null;
  created_at: string;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

const planVariant = (plan: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (plan === 'paid') return 'default';
  if (plan === 'beta') return 'secondary';
  if (plan === 'trial') return 'outline';
  return 'destructive';
};

const RadarCrmSpacesPanel: React.FC = () => {
  const [spaces, setSpaces] = useState<RadarSpaceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [membersByAccount, setMembersByAccount] = useState<
    Record<string, RadarSpaceMember[] | 'loading'>
  >({});

  const loadSpaces = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_radar_accounts');
    if (error) {
      setErr(error.message);
      setSpaces([]);
      return;
    }
    setSpaces((data as unknown as RadarSpaceRow[]) ?? []);
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  const loadMembers = useCallback(
    async (accountId: string) => {
      if (membersByAccount[accountId]) return;
      setMembersByAccount((prev) => ({ ...prev, [accountId]: 'loading' }));
      const { data, error } = await supabase.rpc('admin_list_radar_account_members', {
        p_account_id: accountId,
      });
      setMembersByAccount((prev) => ({
        ...prev,
        [accountId]: error ? [] : ((data as unknown as RadarSpaceMember[]) ?? []),
      }));
    },
    [membersByAccount],
  );

  if (err) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Espaces collaboratifs
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-destructive">Erreur : {err}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Espaces collaboratifs
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble des espaces Radar CRM et de leurs membres.
        </p>
      </CardHeader>
      <CardContent>
        {!spaces ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : spaces.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun espace collaboratif pour le moment.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {spaces.map((s) => {
              const displayName = s.org_name?.trim() || s.name || 'Espace sans nom';
              const members = membersByAccount[s.account_id];
              return (
                <AccordionItem key={s.account_id} value={s.account_id}>
                  <AccordionTrigger
                    className="hover:no-underline"
                    onClick={() => loadMembers(s.account_id)}
                  >
                    <div className="flex flex-1 flex-col gap-1 pr-3 text-left sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Créateur : {s.name ?? '—'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={planVariant(s.plan)}>{s.plan}</Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {s.members}
                        </Badge>
                        <Badge variant="outline">{s.companies} entreprises</Badge>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(s.created_at)}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {members === 'loading' || members === undefined ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des membres…
                      </div>
                    ) : members.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">Aucun membre.</p>
                    ) : (
                      <ul className="divide-y">
                        {members.map((m) => {
                          const isOwner = m.role === 'owner';
                          const isRevoked = m.status !== 'active';
                          return (
                            <li
                              key={m.user_id}
                              className="flex flex-wrap items-center justify-between gap-2 py-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {m.display_name?.trim() || m.email || 'Membre'}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {m.email ?? '—'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={isOwner ? 'default' : 'secondary'}>
                                  {isOwner ? 'Super admin' : 'Membre'}
                                </Badge>
                                <Badge variant={isRevoked ? 'destructive' : 'outline'}>
                                  {isRevoked ? 'revoked' : 'active'}
                                </Badge>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default RadarCrmSpacesPanel;
