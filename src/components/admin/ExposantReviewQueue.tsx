import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GitMerge, Split, Building2, Landmark, ExternalLink } from 'lucide-react';

type ReviewKind = 'name_conflict' | 'fuzzy_pair' | 'salon_domain';

type Review = {
  id: string;
  kind: ReviewKind;
  member_id_exposants: string[];
  score: number | null;
  reasons: any;
};

type Member = {
  id_exposant: string;
  nom_exposant: string | null;
  website_exposant: string | null;
  dedup_status: string | null;
};

const KIND_LABEL: Record<ReviewKind, string> = {
  name_conflict: 'Conflits de nom',
  fuzzy_pair: 'Noms proches (flous)',
  salon_domain: 'Domaines suspects',
};

export function ExposantReviewQueue() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ReviewKind>('name_conflict');
  const [canonical, setCanonical] = useState<Record<string, string>>({});

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['exposant-reviews'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('exposant_duplicate_reviews' as any)
        .select('id,kind,member_id_exposants,score,reasons')
        .eq('status', 'review_required') as any);
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });

  const memberIds = useMemo(
    () => Array.from(new Set((reviews ?? []).flatMap((r) => r.member_id_exposants ?? []))),
    [reviews],
  );

  const { data: members } = useQuery({
    queryKey: ['exposant-review-members', memberIds.length],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('exposants' as any)
        .select('id_exposant,nom_exposant,website_exposant,dedup_status')
        .in('id_exposant', memberIds) as any);
      if (error) throw error;
      const map: Record<string, Member> = {};
      (data ?? []).forEach((m: Member) => { map[m.id_exposant] = m; });
      return map;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['exposant-reviews'] });
    qc.invalidateQueries({ queryKey: ['exposant-cleanup-actions'] });
  };

  const mergeMut = useMutation({
    mutationFn: async ({ review, canon }: { review: Review; canon: string }) => {
      const variants = review.member_id_exposants.filter((x) => x !== canon);
      const { error } = await (supabase.rpc as any)('resolve_exposant_review_merge', {
        p_review_id: review.id,
        p_action: 'merge',
        p_canonical_id_exposant: canon,
        p_variant_id_exposants: variants,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Fusionné' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e?.message ?? '', variant: 'destructive' }),
  });

  const distinctMut = useMutation({
    mutationFn: async (review: Review) => {
      const { error } = await (supabase.rpc as any)('resolve_exposant_review_merge', {
        p_review_id: review.id,
        p_action: 'distinct',
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Marqué distinct' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e?.message ?? '', variant: 'destructive' }),
  });

  const domainMut = useMutation({
    mutationFn: async ({ review, verdict }: { review: Review; verdict: 'salon' | 'groupe' }) => {
      const { error } = await (supabase.rpc as any)('resolve_exposant_review_domain', {
        p_review_id: review.id,
        p_verdict: verdict,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Verdict enregistré' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e?.message ?? '', variant: 'destructive' }),
  });

  const list = (reviews ?? []).filter((r) => r.kind === kind);

  const counts = useMemo(() => {
    const c: Record<string, number> = { name_conflict: 0, fuzzy_pair: 0, salon_domain: 0 };
    (reviews ?? []).forEach((r) => { c[r.kind] = (c[r.kind] ?? 0) + 1; });
    return c;
  }, [reviews]);

  const chosen = (r: Review) => canonical[r.id] ?? r.member_id_exposants[0];
  const busy = mergeMut.isPending || distinctMut.isPending || domainMut.isPending;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-medium">Revue à trancher — cas ambigus</h3>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Ces cas ne pouvaient pas être fusionnés automatiquement. Choisis la fiche à conserver puis fusionne,
              ou marque comme entreprises distinctes. Chaque fusion apparaît ensuite dans le panneau des corrections Airtable.
            </p>
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as ReviewKind)}>
            <SelectTrigger className="w-full md:w-[260px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_conflict">Conflits de nom ({counts.name_conflict})</SelectItem>
              <SelectItem value="fuzzy_pair">Noms proches ({counts.fuzzy_pair})</SelectItem>
              <SelectItem value="salon_domain">Domaines suspects ({counts.salon_domain})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun cas dans « {KIND_LABEL[kind]} ». Bravo.
          </p>
        ) : (
          <div className="space-y-3">
            {list.map((r) => (
              <div key={r.id} className="border rounded-lg p-4 space-y-3">
                {r.kind === 'salon_domain' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{r.reasons?.domaine}</span>
                      <Badge variant="outline">
                        {r.score} entreprises différentes partagent ce domaine
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.member_id_exposants.map((id) => (
                        <Badge key={id} variant="secondary" className="font-normal">
                          {members?.[id]?.nom_exposant ?? id}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => domainMut.mutate({ review: r, verdict: 'salon' })}>
                        <Landmark className="h-4 w-4 mr-2" />
                        C'est un salon (corriger les domaines)
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => domainMut.mutate({ review: r, verdict: 'groupe' })}>
                        <Building2 className="h-4 w-4 mr-2" />
                        C'est un groupe (aucune action)
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {r.kind === 'fuzzy_pair'
                          ? `${r.reasons?.nom_a} ≈ ${r.reasons?.nom_b}`
                          : (r.reasons?.nom_normalise ?? 'Conflit')}
                      </span>
                      {r.kind === 'fuzzy_pair' && r.score != null && (
                        <Badge variant="outline">similarité {r.score}%</Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {r.member_id_exposants.map((id) => {
                        const m = members?.[id];
                        return (
                          <label key={id} className="flex flex-wrap items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name={`canon-${r.id}`}
                              checked={chosen(r) === id}
                              onChange={() => setCanonical((c) => ({ ...c, [r.id]: id }))}
                            />
                            <span className="font-medium">{m?.nom_exposant ?? id}</span>
                            {m?.website_exposant && (
                              <a
                                href={m.website_exposant}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                              >
                                {m.website_exposant}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <span className="font-mono text-xs text-muted-foreground">{id}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => mergeMut.mutate({ review: r, canon: chosen(r) })}>
                        <GitMerge className="h-4 w-4 mr-2" />
                        Fusionner (garder la sélection)
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => distinctMut.mutate(r)}>
                        <Split className="h-4 w-4 mr-2" />
                        Entreprises distinctes
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ExposantReviewQueue;