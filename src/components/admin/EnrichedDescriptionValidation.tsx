import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle, XCircle, Loader2, RefreshCw, Rocket,
  ChevronDown, ChevronUp, Clock, FileCheck, AlertTriangle, Calendar,
  Pencil, Save, X
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

interface PendingEvent {
  id: string;
  nom_event: string;
  slug: string | null;
  ville: string | null;
  date_debut: string | null;
  enrichissement_score: number | null;
  description_enrichie: string | null;
}

interface Stats {
  pending: number;
  validated: number;
  eligibleUntreated: number;
  totalFuture: number;
}

export function EnrichedDescriptionValidation() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ pending: 0, validated: 0, eligibleUntreated: 0, totalFuture: 0 });
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, validRes, eligibleRes, futureRes, eventsRes] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('enrichissement_statut', 'en_attente'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('enrichissement_statut', 'valide'),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('enrichissement_statut', 'non_traite')
          .gte('enrichissement_score', 55)
          .gt('date_debut', today),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .gt('date_debut', today),
        supabase.from('events')
          .select('id, nom_event, slug, ville, date_debut, enrichissement_score, description_enrichie')
          .eq('enrichissement_statut', 'en_attente')
          .order('enrichissement_score', { ascending: false })
          .limit(100),
      ]);

      setStats({
        pending: pendingRes.count ?? 0,
        validated: validRes.count ?? 0,
        eligibleUntreated: eligibleRes.count ?? 0,
        totalFuture: futureRes.count ?? 0,
      });
      setEvents(eventsRes.data ?? []);
    } catch (e) {
      console.error('Fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startEditing = (ev: PendingEvent) => {
    setEditingId(ev.id);
    setEditText(ev.description_enrichie ?? '');
    setExpandedIds(prev => new Set(prev).add(ev.id));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (id: string) => {
    setSaveLoading(true);
    const { error } = await supabase.from('events')
      .update({ description_enrichie: editText })
      .eq('id', id);
    setSaveLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '💾 Description modifiée' });
      setEvents(prev => prev.map(e => e.id === id ? { ...e, description_enrichie: editText } : e));
      setEditingId(null);
      setEditText('');
    }
  };

  const updateStatus = async (id: string, status: 'valide' | 'rejete') => {
    setActionLoading(id);
    const { error } = await supabase.from('events').update({ enrichissement_statut: status }).eq('id', id);
    setActionLoading(null);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: status === 'valide' ? '✅ Validé' : '❌ Rejeté' });
      setEvents(prev => prev.filter(e => e.id !== id));
      setStats(prev => ({
        ...prev,
        pending: prev.pending - 1,
        validated: status === 'valide' ? prev.validated + 1 : prev.validated,
      }));
    }
  };

  const bulkValidate = async () => {
    setBulkLoading(true);
    const { error, count } = await supabase
      .from('events')
      .update({ enrichissement_statut: 'valide' })
      .eq('enrichissement_statut', 'en_attente');
    setBulkLoading(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `✅ ${count ?? stats.pending} événements validés` });
      fetchData();
    }
  };

  const launchEnrichment = async () => {
    setEnrichLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-event-meta', {
        body: { batch_desc_enrichie: true, limit: 10 },
      });
      if (error) throw error;
      const results = data as { total?: number; done?: number; errors?: number; skipped?: number };
      toast({
        title: '📝 Descriptions enrichies générées',
        description: `${results.done ?? 0} générées, ${results.skipped ?? 0} ignorées, ${results.errors ?? 0} erreurs sur ${results.total ?? 0} éligibles.`,
      });
      fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setEnrichLoading(false);
    }
  };

  const scoreBadge = (score: number | null) => {
    if (score == null) return <Badge variant="outline">—</Badge>;
    if (score >= 65) return <Badge className="bg-green-100 text-green-800 border-green-300">{score}</Badge>;
    if (score >= 55) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{score}</Badge>;
    return <Badge variant="outline">{score}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Validation des descriptions enrichies
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-xs text-yellow-600">En attente</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <div className="text-2xl font-bold text-green-700">{stats.validated}</div>
            <div className="text-xs text-green-600">Validés</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-600" />
            <div className="text-2xl font-bold text-orange-700">{stats.eligibleUntreated}</div>
            <div className="text-xs text-orange-600">Non traités éligibles</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <div className="text-2xl font-bold text-blue-700">{stats.totalFuture}</div>
            <div className="text-xs text-blue-600">Événements futurs</div>
          </div>
        </div>

        {/* 2. Pending list */}
        {events.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun événement en attente de validation.
          </p>
        )}

        {events.length > 0 && (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {events.map(ev => {
              const expanded = expandedIds.has(ev.id);
              const isEditing = editingId === ev.id;
              const preview = ev.description_enrichie?.slice(0, 200) ?? '';
              const hasMore = (ev.description_enrichie?.length ?? 0) > 200;
              return (
                <div key={ev.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={ev.slug ? `/salon/${ev.slug}` : '#'}
                        className="font-medium text-primary hover:underline truncate block"
                      >
                        {ev.nom_event}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[ev.ville, ev.date_debut].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {scoreBadge(ev.enrichissement_score)}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={12}
                        className="text-sm font-mono"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveEdit(ev.id)}
                          disabled={saveLoading}
                          className="text-xs"
                        >
                          {saveLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                          Enregistrer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing} className="text-xs">
                          <X className="h-3 w-3 mr-1" /> Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground whitespace-pre-line">
                        {expanded ? ev.description_enrichie : preview}
                        {hasMore && !expanded && '…'}
                      </div>
                      {hasMore && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => toggleExpand(ev.id)}>
                          {expanded ? <><ChevronUp className="h-3 w-3 mr-1" /> Réduire</> : <><ChevronDown className="h-3 w-3 mr-1" /> Voir tout</>}
                        </Button>
                      )}
                    </>
                  )}

                  <div className="flex gap-2 pt-1">
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-700 border-blue-300 hover:bg-blue-50"
                        onClick={() => startEditing(ev)}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Modifier
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      disabled={actionLoading === ev.id}
                      onClick={() => updateStatus(ev.id, 'valide')}
                    >
                      {actionLoading === ev.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-300 hover:bg-red-50"
                      disabled={actionLoading === ev.id}
                      onClick={() => updateStatus(ev.id, 'rejete')}
                    >
                      <XCircle className="h-3 w-3 mr-1" /> Rejeter
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. Bulk validate + 4. Launch wave */}
        <div className="flex flex-wrap gap-3 pt-2 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" disabled={stats.pending === 0 || bulkLoading}>
                {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Valider tous les textes en attente ({stats.pending})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tout valider ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va passer {stats.pending} événement(s) en statut "validé".
                  Les descriptions enrichies seront alors visibles sur le site.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={bulkValidate}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" disabled={enrichLoading || stats.eligibleUntreated === 0}>
                {enrichLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
                Générer les descriptions enrichies ({stats.eligibleUntreated} éligibles)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Générer les descriptions enrichies ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va générer les descriptions enrichies (texte long SEO)
                  pour un lot de 10 événements éligibles (score ≥ 55) qui n'en ont pas encore.
                  Cela consomme des crédits API Claude.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={launchEnrichment}>Lancer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
