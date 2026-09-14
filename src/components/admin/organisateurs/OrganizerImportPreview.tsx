import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  importId: string;
}

type PreviewData = {
  import_id: string;
  event?: { id: string; nom_event?: string; date_debut?: string } | null;
  compteurs?: Record<string, number> | null;
  a_arbitrer?: Array<Record<string, any>> | null;
  changements_stand?: Array<Record<string, any>> | null;
  retraits?: Array<Record<string, any>> | null;
};

type CandidatesData = {
  ligne?: Record<string, any> | null;
  candidats?: Array<Record<string, any>> | null;
};

const COUNTER_LABELS: Record<string, string> = {
  lignes_fichier: 'Lignes du fichier',
  participations_actuelles: 'Participations actuelles',
  create: 'À créer',
  update_stand: 'Stand modifié',
  unchanged: 'Inchangé',
  review: 'À arbitrer',
  ignore: 'Ignorées',
  retraits: 'Retraits',
};

const OrganizerImportPreview: React.FC<Props> = ({ importId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [matching, setMatching] = useState(false);
  const [openLineId, setOpenLineId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [forceMessage, setForceMessage] = useState<string | null>(null);
  const [forceWord, setForceWord] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<Record<string, any> | null>(null);

  const { data: importRow } = useQuery({
    queryKey: ['organizer-import-row', importId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizer_exhibitor_imports')
        .select('id, status, matched_at, applied_at, stats')
        .eq('id', importId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const status = importRow?.status ?? null;
  const previewAvailable = status === 'matched' || status === 'applied';

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ['organizer-import-preview', importId, status],
    enabled: previewAvailable,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('organizer_preview_exhibitor_list', {
        p_import_id: importId,
      });
      if (error) throw error;
      return data as unknown as PreviewData;
    },
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['organizer-line-candidates', openLineId],
    enabled: !!openLineId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('organizer_line_candidates', {
        p_line_id: openLineId as string,
      });
      if (error) throw error;
      return data as unknown as CandidatesData;
    },
  });

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ['organizer-import-row', importId] });
    await queryClient.invalidateQueries({ queryKey: ['organizer-import-preview', importId] });
    await queryClient.invalidateQueries({ queryKey: ['staging-organizer-exhibitors'] });
  };

  const runMatch = async () => {
    setMatching(true);
    try {
      const { error } = await supabase.rpc('organizer_match_exhibitor_list', {
        p_import_id: importId,
      });
      if (error) throw error;
      await reload();
      toast({ title: 'Rapprochement terminé' });
    } catch (err: any) {
      toast({
        title: 'Rapprochement impossible',
        description: err?.message ?? 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setMatching(false);
    }
  };

  const decide = async (decision: 'lier' | 'creer' | 'ignorer', idExposant?: string) => {
    if (!openLineId) return;
    setDeciding(true);
    setPanelError(null);
    try {
      const args: Record<string, unknown> = { p_line_id: openLineId, p_decision: decision };
      if (decision === 'lier') args.p_id_exposant = idExposant;
      const { error } = await supabase.rpc(
        'organizer_decide_line',
        args as { p_line_id: string; p_decision: string; p_id_exposant?: string },
      );
      if (error) throw error;
      setOpenLineId(null);
      await reload();
      toast({ title: 'Décision enregistrée' });
    } catch (err: any) {
      setPanelError(err?.message ?? 'Erreur inconnue');
    } finally {
      setDeciding(false);
    }
  };

  const compteurs = preview?.compteurs ?? {};
  const aArbitrer = preview?.a_arbitrer ?? [];
  const changements = preview?.changements_stand ?? [];
  const retraits = preview?.retraits ?? [];

  const isApplied = status === 'applied';
  const storedApplication = (importRow?.stats as any)?.application ?? null;
  const recap = applyResult ?? storedApplication;
  const reviewCount = Number(compteurs?.review ?? 0);
  const canApply = !isApplied && status === 'matched' && reviewCount === 0;

  const nbAvant = Number(compteurs?.participations_actuelles ?? 0);
  const nbRetraits = Number(compteurs?.retraits ?? 0);
  const nbCreate = Number(compteurs?.create ?? 0);
  const nbApres = nbAvant - nbRetraits + nbCreate;

  const eventId = preview?.event?.id ?? null;
  const { data: eventRow } = useQuery({
    queryKey: ['organizer-import-event-slug', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, slug, nom_event')
        .eq('id', eventId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const applyList = async (confirmWord?: string) => {
    setApplying(true);
    setApplyError(null);
    try {
      const { data, error } = await supabase.rpc('organizer_apply_exhibitor_list', {
        p_import_id: importId,
        ...(confirmWord ? { p_confirm: confirmWord } : {}),
      });
      if (error) throw error;
      setApplyResult((data ?? {}) as Record<string, any>);
      setConfirmOpen(false);
      setForceOpen(false);
      setForceWord('');
      setForceMessage(null);
      await reload();
      toast({ title: 'Liste appliquée au site' });
    } catch (err: any) {
      const message = err?.message ?? 'Erreur inconnue';
      const needsConfirm =
        /plus de 30%/i.test(message) || /moins de la moitie|moins de la moitié/i.test(message);
      if (needsConfirm && !confirmWord) {
        setConfirmOpen(false);
        setForceMessage(message);
        setForceWord('');
        setForceOpen(true);
      } else {
        setApplyError(message);
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!isApplied && (status === 'parsed' || status === 'matched') && (
          <Button size="sm" onClick={runMatch} disabled={matching} className="flex items-center gap-2">
            {matching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Lancer le rapprochement
          </Button>
        )}
        {status && (
          <span className="text-xs text-muted-foreground">Statut de l'import : {status}</span>
        )}
      </div>

      {previewError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{(previewError as any)?.message}</AlertDescription>
        </Alert>
      )}

      {previewLoading && <Skeleton className="h-24 w-full" />}

      {recap && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">Import appliqué au site</p>
          </div>
          {importRow?.applied_at && (
            <p className="text-xs text-muted-foreground">
              Appliqué le {new Date(importRow.applied_at).toLocaleString('fr-FR')}
            </p>
          )}
          <p className="text-base font-semibold">
            Le salon compte désormais {recap.participations_apres ?? '—'} participations.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              ['Exposants créés', recap.exposants_crees],
              ['Participations créées', recap.participations_creees],
              ['Participations mises à jour', recap.participations_majs],
              ['Participations supprimées', recap.participations_supprimees],
              ['Participations avant', recap.participations_avant],
            ].map(([label, value]) => (
              <Badge key={String(label)} variant="outline" className="bg-background">
                {label} : {value ?? 0}
              </Badge>
            ))}
          </div>
          {eventRow?.slug && (
            <a
              href={`/events/${eventRow.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4"
            >
              Voir la page publique du salon
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {!recap && preview && (
        <div className="space-y-4">
          {/* Bloc compteurs */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {['lignes_fichier', 'participations_actuelles'].map((k) => (
                <Badge key={k} variant="outline" className="border-border bg-muted text-foreground">
                  {COUNTER_LABELS[k]} : {compteurs?.[k] ?? 0}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['create', 'update_stand', 'unchanged', 'review', 'retraits'].map((k) => (
                <Badge key={k} variant="outline" className="border-border bg-background">
                  {COUNTER_LABELS[k]} : {compteurs?.[k] ?? 0}
                </Badge>
              ))}
            </div>
          </div>

          {/* Application */}
          {!isApplied && (
            <div className="space-y-2">
              <Button
                size="sm"
                disabled={!canApply || applying}
                onClick={() => {
                  setApplyError(null);
                  setConfirmOpen(true);
                }}
              >
                Appliquer au site
              </Button>
              {reviewCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {reviewCount} ligne(s) à arbitrer avant de pouvoir appliquer
                </p>
              )}
              {applyError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{applyError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Bloc changements de stand */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Changements de stand</p>
            {changements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun stand modifié</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium">Nom</th>
                      <th className="px-2 py-2 font-medium">Stand avant</th>
                      <th className="px-2 py-2 font-medium">Stand après</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changements.map((c, i) => (
                      <tr key={`${c.line_no}-${i}`} className="border-t">
                        <td className="px-2 py-1.5">{c.nom || '—'}</td>
                        <td className="px-2 py-1.5">{c.stand_avant || '—'}</td>
                        <td className="px-2 py-1.5">{c.stand_apres || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bloc retraits */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Retraits</p>
            {retraits.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun retrait</p>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Ces participations seront supprimées du site. Une archive permet de les restaurer.
                  </AlertDescription>
                </Alert>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60">
                      <tr className="text-left">
                        <th className="px-2 py-2 font-medium">Nom</th>
                        <th className="px-2 py-2 font-medium">Stand</th>
                        <th className="px-2 py-2 font-medium">Domaine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retraits.map((r, i) => (
                        <tr key={`${r.id_participation}-${i}`} className="border-t">
                          <td className="px-2 py-1.5">{r.nom || '—'}</td>
                          <td className="px-2 py-1.5">{r.stand || '—'}</td>
                          <td className="px-2 py-1.5">{r.domaine || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Bloc arbitrages */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Lignes à arbitrer</p>
            {aArbitrer.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune ligne à arbitrer</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium">Ligne</th>
                      <th className="px-2 py-2 font-medium">Nom</th>
                      <th className="px-2 py-2 font-medium">Site web</th>
                      <th className="px-2 py-2 font-medium">Raison</th>
                      <th className="px-2 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {aArbitrer.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-1.5">{l.line_no}</td>
                        <td className="px-2 py-1.5">{l.nom || '—'}</td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate">{l.website || '—'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{l.raison || l.match_kind || '—'}</td>
                        <td className="px-2 py-1.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPanelError(null);
                              setOpenLineId(l.id);
                            }}
                          >
                            Arbitrer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!openLineId} onOpenChange={(o) => !o && setOpenLineId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Arbitrer une ligne</DialogTitle>
            <DialogDescription>
              Choisissez un exposant existant, créez une nouvelle fiche ou ignorez la ligne.
            </DialogDescription>
          </DialogHeader>

          {candidatesLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <p className="font-medium">{candidates?.ligne?.nom || '—'}</p>
                <p className="text-muted-foreground text-xs">
                  Ligne {candidates?.ligne?.line_no ?? '—'} · Stand{' '}
                  {candidates?.ligne?.stand || '—'} · {candidates?.ligne?.website || 'aucun site'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {candidates?.ligne?.raison || candidates?.ligne?.match_kind || '—'}
                </p>
              </div>

              {panelError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{panelError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Candidats ({candidates?.candidats?.length ?? 0})
                </p>
                {(candidates?.candidats ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun candidat proposé.</p>
                ) : (
                  (candidates?.candidats ?? []).map((c, i) => (
                    <div
                      key={`${c.id_exposant}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium truncate">{c.nom || c.id_exposant}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.website || '—'} · {c.id_exposant}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">Score {c.score ?? '—'}</Badge>
                          {Array.isArray(c.origines) && c.origines.length > 0 && (
                            <Badge variant="outline">{c.origines.join(', ')}</Badge>
                          )}
                          {c.deja_sur_ce_salon && <Badge variant="outline">Déjà sur ce salon</Badge>}
                          <Badge variant="outline">
                            {c.nb_participations ?? 0} participation(s)
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={deciding}
                        onClick={() => decide('lier', String(c.id_exposant))}
                      >
                        Lier à ce candidat
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" disabled={deciding} onClick={() => decide('creer')}>
                  Créer un nouvel exposant
                </Button>
                <Button size="sm" variant="ghost" disabled={deciding} onClick={() => decide('ignorer')}>
                  Ignorer cette ligne
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizerImportPreview;
