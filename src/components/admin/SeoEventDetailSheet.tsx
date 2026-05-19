import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, ExternalLink, Settings, RefreshCw, Wand2, Archive,
  CheckCircle2, AlertTriangle, XCircle, Info, Save,
} from 'lucide-react';

/**
 * Drawer/Sheet de détail SEO pour UN événement.
 * - Résumé, raisons du blocage en français, données analysées
 * - Édition rapide des champs sensibles
 * - Actions : revalider, corriger automatiquement, ignorer, marquer valide/rejeter
 */

interface AutoValCheck {
  code: string;
  status: 'pass' | 'warning' | 'fail';
  label?: string;
  details?: string;
  evidence?: string[];
  blocker?: boolean;
}
interface AutoValReport {
  status?: string;
  score?: number;
  decision?: string;
  checks?: AutoValCheck[];
  ignored_for_now?: boolean;
}

interface EventRow {
  id: string;
  nom_event: string | null;
  slug: string | null;
  ville: string | null;
  nom_lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  pays: string | null;
  code_postal: string | null;
  rue: string | null;
  secteur: unknown;
  affluence: string | null;
  tarif: string | null;
  url_site_officiel: string | null;
  description_event: string | null;
  description_enrichie: string | null;
  meta_description_gen: string | null;
  visible: boolean | null;
  enrichissement_score: number | null;
  enrichissement_niveau: string | null;
  enrichissement_statut: string | null;
  auto_validation_status: string | null;
  auto_validation_score: number | null;
  auto_validation_report: AutoValReport | null;
  validation_mode: string | null;
}

export interface ProcessedEventLite {
  id: string;
  nom_event?: string | null;
  slug?: string | null;
  decision?: string | null;
  meta_reason?: string | null;
  desc_reason?: string | null;
  error?: string | null;
}

function explainCheck(c: AutoValCheck, ev: EventRow): string {
  const evid = (c.evidence ?? []).slice(0, 3).join(', ');
  switch (c.code) {
    case 'city_consistency':
      return `Ville incorrecte : le texte mentionne « ${evid} », mais l'événement est à ${ev.ville ?? '—'}.`;
    case 'venue_consistency':
      return `Lieu incorrect : le texte mentionne « ${evid} », différent de ${ev.nom_lieu ?? '—'}.`;
    case 'date_consistency':
      return `Date incohérente : année(s) « ${evid} » absente(s) des dates source.`;
    case 'numbers_grounded':
      return `Chiffre non sourcé : « ${evid} » n'est pas présent dans les données de l'événement.`;
    case 'price_invented':
      return `Tarif inventé : aucun tarif officiel n'est connu en base.`;
    case 'program_invented':
      return `Programme inventé : ${c.details ?? 'horaires, ateliers ou intervenants non sourcés'}.`;
    case 'exhibitors_grounded':
      return `Exposant non sourcé : « ${evid} » cité mais absent de la liste officielle.`;
    case 'length_min':
      return c.status === 'fail'
        ? `Texte trop court : ${c.details ?? ''}.`
        : `Texte un peu court (${c.details ?? ''}).`;
    case 'superlatives':
      return `Superlatifs non sourcés (${evid}).`;
    case 'generic_text':
      return `Texte trop générique : à reformuler pour gagner en précision.`;
    case 'repetition':
      return `Répétitions détectées.`;
    case 'fake_faq':
      return `FAQ artificielle.`;
    case 'commercial_promise':
      return `Promesse commerciale à reformuler.`;
    default:
      return c.details ?? c.label ?? c.code;
  }
}

function humanSkipReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/déjà remplie/i.test(raw)) return 'Description déjà rédigée et validée — aucune action nécessaire.';
  if (/Événement passé/i.test(raw)) return 'Événement passé : il n\'est pas re-traité.';
  if (/Données insuffisantes/i.test(raw)) return 'Données insuffisantes pour générer une description (nom manquant).';
  if (/Score/i.test(raw) && /<\s*55/.test(raw)) return `Score trop faible pour être enrichi (${raw}).`;
  if (/Statut/i.test(raw)) return `Statut bloquant : ${raw}.`;
  return raw;
}

function statutBadge(ev: EventRow) {
  const statut = ev.enrichissement_statut;
  const av = ev.auto_validation_status;
  if (statut === 'valide' && av === 'passed' && ev.validation_mode === 'auto') {
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" />Publié automatiquement</Badge>;
  }
  if (av === 'failed') return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Échec validation</Badge>;
  if (av === 'warning') return <Badge className="bg-amber-100 text-amber-800 border-amber-300"><AlertTriangle className="h-3 w-3 mr-1" />En revue</Badge>;
  if (statut === 'en_attente') return <Badge className="bg-amber-100 text-amber-800 border-amber-300">En attente</Badge>;
  if (statut === 'valide') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Validé</Badge>;
  return <Badge variant="outline">Non traité</Badge>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processed: ProcessedEventLite | null;
}

export function SeoEventDetailSheet({ open, onOpenChange, processed }: Props) {
  const { toast } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<EventRow>>({});
  const [exhibitorCount, setExhibitorCount] = useState<number | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setEvent(null);
    setEdits({});
    try {
      const [{ data, error }, { count }] = await Promise.all([
        supabase.from('events').select(
          'id, nom_event, slug, ville, nom_lieu, date_debut, date_fin, pays, code_postal, rue, secteur, affluence, tarif, url_site_officiel, description_event, description_enrichie, meta_description_gen, visible, enrichissement_score, enrichissement_niveau, enrichissement_statut, auto_validation_status, auto_validation_score, auto_validation_report, validation_mode'
        ).eq('id', id).maybeSingle(),
        supabase.from('participation').select('id', { count: 'exact', head: true }).eq('id_event', id),
      ]);
      if (error) throw error;
      setEvent(data as unknown as EventRow);
      setExhibitorCount(count ?? 0);
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open && processed?.id) load(processed.id);
  }, [open, processed?.id, load]);

  const refreshGlobal = () => window.dispatchEvent(new CustomEvent('seo-enrichment-refresh'));

  const saveEdits = async () => {
    if (!event || Object.keys(edits).length === 0) return;
    setBusy('save');
    const { error } = await supabase.from('events').update(edits as never).eq('id', event.id);
    setBusy(null);
    if (error) {
      toast({ title: 'Erreur sauvegarde', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '💾 Modifications enregistrées' });
      await load(event.id);
      refreshGlobal();
    }
  };

  const revalidate = async () => {
    if (!event) return;
    setBusy('reval');
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: {
          target: 'revalidate-enriched-description',
          payload: { dry_run: false, event_ids: [event.id], limit: 1 },
        },
      });
      if (error) throw error;
      const s = (data as { summary?: { auto_validated?: number; warning?: number; failed?: number } })?.summary;
      toast({
        title: '🛡️ Revalidation terminée',
        description: `auto ${s?.auto_validated ?? 0} · warning ${s?.warning ?? 0} · failed ${s?.failed ?? 0}`,
      });
      await load(event.id);
      refreshGlobal();
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const autoFix = async () => {
    if (!event) return;
    setBusy('fix');
    try {
      const { data, error } = await supabase.functions.invoke('admin-seo-batch-proxy', {
        body: { target: 'seo-auto-fix-description', payload: { event_id: event.id } },
      });
      if (error) throw error;
      const r = data as { summary?: { fixed?: boolean; reason?: string; after?: { status?: string; decision?: string } } };
      toast({
        title: r.summary?.fixed ? '✨ Texte corrigé' : 'Aucune correction',
        description: r.summary?.reason ?? `Statut: ${r.summary?.after?.status ?? '?'} · décision: ${r.summary?.after?.decision ?? '?'}`,
      });
      await load(event.id);
      refreshGlobal();
    } catch (e) {
      toast({ title: 'Erreur correction', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const setIgnore = async (ignored: boolean) => {
    if (!event) return;
    setBusy('ignore');
    const report = (event.auto_validation_report ?? {}) as AutoValReport;
    const newReport: AutoValReport = ignored
      ? { ...report, ignored_for_now: true }
      : Object.fromEntries(Object.entries(report).filter(([k]) => k !== 'ignored_for_now'));
    const { error } = await supabase.from('events').update({
      auto_validation_report: newReport as never,
      validation_mode: ignored ? 'manual' : event.validation_mode,
    }).eq('id', event.id);
    setBusy(null);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: ignored ? '🗄️ Événement ignoré' : '↩️ Réintégré dans la file' });
      await load(event.id);
      refreshGlobal();
    }
  };

  const markValid = async () => {
    if (!event) return;
    setBusy('valid');
    const { error } = await supabase.from('events').update({
      enrichissement_statut: 'valide',
      validation_mode: 'manual',
    }).eq('id', event.id);
    setBusy(null);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else { toast({ title: '✅ Validé manuellement' }); await load(event.id); refreshGlobal(); }
  };

  const rejectDesc = async () => {
    if (!event) return;
    if (!confirm('Supprimer la description enrichie et marquer comme « non traité » ?')) return;
    setBusy('reject');
    const { error } = await supabase.from('events').update({
      description_enrichie: null,
      enrichissement_statut: null,
      auto_validation_status: null,
      auto_validation_score: null,
      auto_validation_report: null,
      validation_mode: null,
    }).eq('id', event.id);
    setBusy(null);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else { toast({ title: '🗑️ Description rejetée' }); await load(event.id); refreshGlobal(); }
  };

  const field = <K extends keyof EventRow>(key: K, current: EventRow[K]): EventRow[K] => {
    return (key in edits ? (edits as Record<string, unknown>)[key as string] : current) as EventRow[K];
  };
  const setField = <K extends keyof EventRow>(key: K, value: EventRow[K]) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };
  const dirty = Object.keys(edits).length > 0;

  const failChecks = event?.auto_validation_report?.checks?.filter((c) => c.status === 'fail') ?? [];
  const warnChecks = event?.auto_validation_report?.checks?.filter((c) => c.status === 'warning') ?? [];
  const skipReason = humanSkipReason(processed?.meta_reason ?? processed?.desc_reason ?? processed?.error);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg pr-8">
            {processed?.nom_event ?? event?.nom_event ?? 'Détail événement'}
          </SheetTitle>
          <SheetDescription>
            Pourquoi cet événement est dans cet état et que faire ensuite.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Chargement…
          </div>
        ) : !event ? (
          <div className="py-8 text-sm text-red-700">Événement introuvable.</div>
        ) : (
          <div className="space-y-6 mt-4 pb-12">
            {/* A — Résumé */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">A. Résumé</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <Info2 label="Slug" value={event.slug} />
                <Info2 label="Statut" value={statutBadge(event)} />
                <Info2 label="Dates" value={`${event.date_debut ?? '?'} → ${event.date_fin ?? '?'}`} />
                <Info2 label="Ville" value={event.ville} />
                <Info2 label="Lieu" value={event.nom_lieu} />
                <Info2 label="Score" value={event.enrichissement_score != null ? `${event.enrichissement_score} (${event.enrichissement_niveau ?? '—'})` : '—'} />
                <Info2 label="Validation" value={event.auto_validation_status ? `${event.auto_validation_status} · ${event.auto_validation_score ?? '?'}/100` : '—'} />
                <Info2 label="Visible" value={event.visible ? 'Oui' : 'Non'} />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {event.slug && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/events/${event.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Page publique
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={`/admin/events/${event.id}`} target="_blank" rel="noopener noreferrer">
                    <Settings className="h-3 w-3 mr-1" /> Fiche admin complète
                  </a>
                </Button>
              </div>
            </section>

            <Separator />

            {/* B — Pourquoi bloqué */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">B. Pourquoi cet événement est-il dans cet état ?</h3>
              {failChecks.length === 0 && warnChecks.length === 0 && !skipReason ? (
                <div className="text-xs text-muted-foreground">
                  Aucune raison particulière détectée. L'événement est probablement déjà publié ou en attente d'un prochain traitement.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {skipReason && (
                    <li className="text-xs flex gap-2 bg-slate-50 border border-slate-200 rounded p-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 text-slate-500 flex-shrink-0" />
                      <span>{skipReason}</span>
                    </li>
                  )}
                  {failChecks.map((c, i) => (
                    <li key={`f${i}`} className="text-xs flex gap-2 bg-red-50 border border-red-200 rounded p-2">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 text-red-600 flex-shrink-0" />
                      <span>{explainCheck(c, event)}</span>
                    </li>
                  ))}
                  {warnChecks.map((c, i) => (
                    <li key={`w${i}`} className="text-xs flex gap-2 bg-amber-50 border border-amber-200 rounded p-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
                      <span>{explainCheck(c, event)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            {/* C — Données analysées */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">C. Données analysées</h3>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <DataRow label="nom_event" present={!!event.nom_event} value={event.nom_event} />
                <DataRow label="ville" present={!!event.ville} value={event.ville} />
                <DataRow label="nom_lieu" present={!!event.nom_lieu} value={event.nom_lieu} />
                <DataRow label="date_debut" present={!!event.date_debut} value={event.date_debut} />
                <DataRow label="date_fin" present={!!event.date_fin} value={event.date_fin} />
                <DataRow label="secteur" present={!!event.secteur && (Array.isArray(event.secteur) ? event.secteur.length > 0 : true)} value={Array.isArray(event.secteur) ? `${event.secteur.length} secteur(s)` : '—'} />
                <DataRow label="affluence" present={!!event.affluence} value={event.affluence} />
                <DataRow label="url_site_officiel" present={!!event.url_site_officiel} value={event.url_site_officiel} />
                <DataRow label="exposants liés" present={(exhibitorCount ?? 0) > 0} value={`${exhibitorCount ?? 0}`} />
                <DataRow label="description_event" present={!!event.description_event} value={event.description_event ? `${event.description_event.length} car.` : '—'} />
                <DataRow label="description_enrichie" present={!!event.description_enrichie} value={event.description_enrichie ? `${event.description_enrichie.length} car.` : '—'} />
                <DataRow label="meta_description_gen" present={!!event.meta_description_gen} value={event.meta_description_gen ? `${event.meta_description_gen.length} car.` : '—'} />
              </div>
            </section>

            <Separator />

            {/* D — Édition */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">D. Modifier les données</h3>
              <div className="grid grid-cols-2 gap-3">
                <FieldText label="Ville" value={field('ville', event.ville) ?? ''} onChange={(v) => setField('ville', v as string)} />
                <FieldText label="Lieu" value={field('nom_lieu', event.nom_lieu) ?? ''} onChange={(v) => setField('nom_lieu', v as string)} />
                <FieldText label="Date début" type="date" value={(field('date_debut', event.date_debut) ?? '') as string} onChange={(v) => setField('date_debut', (v || null) as string)} />
                <FieldText label="Date fin" type="date" value={(field('date_fin', event.date_fin) ?? '') as string} onChange={(v) => setField('date_fin', (v || null) as string)} />
                <FieldText label="Affluence" value={field('affluence', event.affluence) ?? ''} onChange={(v) => setField('affluence', v as string)} />
                <FieldText label="Site officiel" value={field('url_site_officiel', event.url_site_officiel) ?? ''} onChange={(v) => setField('url_site_officiel', v as string)} />
              </div>
              <FieldText label="nom_event" value={field('nom_event', event.nom_event) ?? ''} onChange={(v) => setField('nom_event', v as string)} />
              <FieldArea label="description_event (source)" rows={3} value={field('description_event', event.description_event) ?? ''} onChange={(v) => setField('description_event', v)} />
              <FieldArea label="description_enrichie (publique)" rows={6} value={field('description_enrichie', event.description_enrichie) ?? ''} onChange={(v) => setField('description_enrichie', v)} />
              <FieldArea label="meta_description_gen" rows={2} value={field('meta_description_gen', event.meta_description_gen) ?? ''} onChange={(v) => setField('meta_description_gen', v)} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="visible-edit" checked={!!field('visible', event.visible)} onChange={(e) => setField('visible', e.target.checked as never)} />
                <Label htmlFor="visible-edit" className="text-xs">Visible publiquement</Label>
              </div>
              <Button size="sm" onClick={saveEdits} disabled={!dirty || busy === 'save'}>
                {busy === 'save' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                Enregistrer les modifications
              </Button>
            </section>

            <Separator />

            {/* E — Actions */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">E. Actions disponibles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={revalidate} disabled={!!busy}>
                  {busy === 'reval' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Relancer la validation
                </Button>
                <Button variant="outline" size="sm" onClick={autoFix} disabled={!!busy || !event.description_enrichie}>
                  {busy === 'fix' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                  Corriger automatiquement
                </Button>
                <Button variant="outline" size="sm" onClick={markValid} disabled={!!busy || !event.description_enrichie || event.enrichissement_statut === 'valide'}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Valider manuellement
                </Button>
                {event.auto_validation_report?.ignored_for_now ? (
                  <Button variant="outline" size="sm" onClick={() => setIgnore(false)} disabled={!!busy}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Réintégrer dans la file
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setIgnore(true)} disabled={!!busy}>
                    <Archive className="h-3 w-3 mr-1" /> Ignorer pour l'instant
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-red-700 border-red-200 hover:bg-red-50" onClick={rejectDesc} disabled={!!busy || !event.description_enrichie}>
                  <XCircle className="h-3 w-3 mr-1" /> Rejeter la description
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                « Corriger automatiquement » utilise l'IA pour réparer les erreurs détectées sans inventer de nouvelles informations. Aucun déploiement Vercel n'est déclenché sauf si une description passe réellement en valide.
              </p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value || '—'}</div>
    </>
  );
}

function DataRow({ label, present, value }: { label: string; present: boolean; value: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        {present
          ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          : <XCircle className="h-3 w-3 text-red-500" />}
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="truncate">{value ?? <span className="text-muted-foreground">manquant</span>}</div>
    </>
  );
}

function FieldText({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-8 text-xs" />
    </div>
  );
}

function FieldArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-xs" />
    </div>
  );
}