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
import { useToast } from '@/components/ui/use-toast';
import { GitMerge, Split, Building2, Landmark, ExternalLink } from 'lucide-react';

type ReviewKind = 'name_conflict' | 'fuzzy_pair' | 'salon_domain' | 'domain_group';
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
  domain_group: 'Doublons par domaine',
  name_conflict: 'Conflits de nom',
  fuzzy_pair: 'Noms proches (flous)',
  salon_domain: 'Domaines suspects',
};
const KIND_ORDER: ReviewKind[] = ['domain_group', 'name_conflict', 'fuzzy_pair', 'salon_domain'];

const linkHref = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

export function ExposantReviewQueue() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ReviewKind>('domain_group');
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
    () => Array.from(new Set((reviews ?? []).flatMap((r) => r.member_id_exposants))),
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
  };

  const mergeMut = useMutation({
    mutationFn: async ({ review, canon }: { review: Review; canon: string }) => {
      const variants = review.member_id_exposants.filter((x) => x !== canon);
      const { error } = await (supabase.rpc as any)('resolve_exposant_review_merge', {
        p_review_id: review.id, p_action: 'merge',
        p_canonical_id_exposant: canon, p_variant_id_exposants: variants,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Fusionné' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e?.message ?? '', variant: 'destructive' }),
  });

  const distinctMut = useMutation({
    mutationFn: async (review: Review) => {
      const { error } = await (supabase.rpc as any)('resolve_exposant_review_merge', {
        p_review_id: review.id, p_action: 'distinct',
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Marqué distinct' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e?.message ?? '', variant: 'destructive' }),
  });

  const domainMut = useMutation({
    mutationFn: async ({ review, verdict }: { review: Review; verdict: 'salon' | 'groupe' }) => {
      const { error } = await (supabase.rpc as any)('resolve_exposant_review_domain', {
        p_review_id: review.id, p_verdict: verdict,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Verdict enregistré' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e?.message ?? '', variant: 'destructive' }),
  });

  const list = (reviews ?? []).filter((r) => r.kind === kind);
  const counts = useMemo(() => {
    const c: Record<string, number> = { domain_group: 0, name_conflict: 0, fuzzy_pair: 0, salon_domain: 0 };
    (reviews ?? []).forEach((r) => { c[r.kind] = (c[r.kind] ?? 0) + 1; });
    return c;
  }, [reviews]);

  const chosen = (r: Review) => canonical[r.id] ?? r.member_id_exposants[0];
  const nameOf = (id: string) => members?.[id]?.nom_exposant ?? id;

  const headerFor = (r: Review) => {
    if (r.kind === 'fuzzy_pair') return `${r.reasons?.nom_a} ≈ ${r.reasons?.nom_b}`;
    if (r.kind === 'domain_group') return `Même domaine · ${r.reasons?.brand_root ?? ''}`;
    return r.reasons?.nom_normalise ?? 'Doublon';
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">Fusionner les doublons d'exposants</h3>
            <p className="text-sm text-muted-foreground">
              <strong>Coche la fiche à conserver</strong>, les autres lui seront rattachées (participations comprises)
              et deviennent des alias invisibles sur le site. Ou marque « entreprises distinctes ». Pour les domaines
              partagés par plusieurs sociétés, tranche salon ou groupe.
            </p>
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as ReviewKind)}>
            <SelectTrigger className="w-60 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map((k) => (
                <SelectItem key={k} value={k}>{KIND_LABEL[k]} ({counts[k] ?? 0})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucun cas dans « {KIND_LABEL[kind]} ». Bravo.</p>
        ) : (
          <div className="space-y-3">
            {list.map((r) => (
              <div key={r.id} className="rounded-md border p-4 space-y-3">
                {r.kind === 'salon_domain' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{r.reasons?.domaine}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {r.score} entreprises différentes partagent ce domaine
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.member_id_exposants.map((id) => (
                        <Badge key={id} variant="secondary" className="font-normal">{nameOf(id)}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="destructive" onClick={() => domainMut.mutate({ review: r, verdict: 'salon' })}>
                        <Landmark className="h-4 w-4 mr-2" />C'est un salon (corriger les domaines)
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => domainMut.mutate({ review: r, verdict: 'groupe' })}>
                        <Building2 className="h-4 w-4 mr-2" />C'est un groupe (aucune action)
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{headerFor(r)}</span>
                      {r.kind === 'fuzzy_pair' && r.score != null && (
                        <Badge variant="outline">similarité {r.score}%</Badge>
                      )}
                      {r.kind === 'domain_group' && (
                        <Badge variant="outline">{r.member_id_exposants.length} fiches</Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      {r.member_id_exposants.map((id) => {
                        const m = members?.[id];
                        const isKept = chosen(r) === id;
                        return (
                          <label
                            key={id}
                            className={`flex items-center gap-3 text-sm cursor-pointer rounded px-2 py-1.5 border ${isKept ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                          >
                            <input
                              type="radio"
                              name={`canon-${r.id}`}
                              checked={isKept}
                              onChange={() => setCanonical((c) => ({ ...c, [r.id]: id }))}
                            />
                            <span className="font-medium">{m?.nom_exposant ?? id}</span>
                            {m?.website_exposant && (
                              <a href={linkHref(m.website_exposant)} target="_blank" rel="noreferrer"
                                 className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
                                {m.website_exposant}<ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {isKept
                              ? <Badge className="ml-auto">Conservée</Badge>
                              : <span className="ml-auto text-xs text-muted-foreground">deviendra un alias</span>}
                          </label>
                        );
                      })}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      En fusionnant : <strong>{nameOf(chosen(r))}</strong> est conservée. Les{' '}
                      {r.member_id_exposants.length - 1} autre(s) lui sont rattachées (participations comprises) et
                      disparaissent des pages du site.
                    </p>

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => mergeMut.mutate({ review: r, canon: chosen(r) })}>
                        <GitMerge className="h-4 w-4 mr-2" />Fusionner vers la fiche cochée
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => distinctMut.mutate(r)}>
                        <Split className="h-4 w-4 mr-2" />Entreprises distinctes
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
