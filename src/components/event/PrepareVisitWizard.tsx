import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Sparkles, X, Building2, ExternalLink, RefreshCw, Clock, CalendarPlus, Check, Bookmark, Search, Users, BarChart3, CheckCircle2 } from 'lucide-react';
import { normalizeStandNumber } from '@/utils/standUtils';
import { supabase } from '@/integrations/supabase/client';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitPlan, useSaveVisitPlan, storePendingVisitPlan } from '@/hooks/useVisitPlan';
import { toggleFavorite } from '@/utils/toggleFavorite';
import { useFavoriteEvents } from '@/hooks/useFavoriteEvents';
import { toast } from '@/hooks/use-toast';
import type { Event } from '@/types/event';
import { cn } from '@/lib/utils';

interface PrepareVisitWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  exhibitorCount: number;
}

const ROLES = [
  'Achats / Approvisionnement',
  'R&D / Ingénierie',
  'Commercial / Business Development',
  'Direction / Management',
  'Production / Industrialisation',
  'Marketing / Innovation',
  'Autre',
];

const OBJECTIVES = [
  'Trouver de nouveaux fournisseurs',
  'Découvrir les innovations du marché',
  'Rencontrer mes clients et prospects',
  'Faire de la veille concurrentielle',
  'Identifier des partenaires',
  'Comparer des solutions',
];

const DURATIONS = ['2h', 'Demi-journée', 'Journée complète'];

type Step = 1 | 2 | 3 | 'loading' | 'results';

interface Recommendation {
  exhibitor_id: string;
  raison: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  stand: string | null;
  secteur_principal: string | null;
}

interface Results {
  prioritaires: Recommendation[];
  optionnels: Recommendation[];
  totalExhibitors: number;
  analyzedExhibitors: number;
}

export default function PrepareVisitWizard({ open, onOpenChange, event, exhibitorCount }: PrepareVisitWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState('');
  const [objective, setObjective] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [duration, setDuration] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loadingComplete, setLoadingComplete] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: existingPlan } = useVisitPlan(event.id);
  const { data: favoriteEvents = [] } = useFavoriteEvents();
  const saveVisitPlan = useSaveVisitPlan();

  const isFavorited = favoriteEvents.some((e: any) => e.id === event.id);

  // Fetch keyword suggestions from exhibitor_ai
  useEffect(() => {
    if (step !== 3 || !event.id) return;
    const fetchSuggestions = async () => {
      try {
        const { data: eventData } = await supabase
          .from('events')
          .select('id_event')
          .eq('id', event.id)
          .single();

        if (!eventData) return;

        const { data: participations } = await supabase
          .from('participation')
          .select('exhibitor_id')
          .eq('id_event_text', eventData.id_event)
          .not('exhibitor_id', 'is', null);

        const ids = (participations || []).map(p => p.exhibitor_id).filter(Boolean) as string[];
        if (ids.length === 0) return;

        const { data: aiRows } = await supabase
          .from('exhibitor_ai')
          .select('mots_cles_metier')
          .in('exhibitor_id', ids);

        if (!aiRows) return;

        const freq: Record<string, number> = {};
        aiRows.forEach(row => {
          const kws = row.mots_cles_metier as string[] | null;
          if (Array.isArray(kws)) {
            kws.forEach((k: string) => {
              const normalized = k.trim().toLowerCase();
              if (normalized) freq[normalized] = (freq[normalized] || 0) + 1;
            });
          }
        });

        const sorted = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

        setSuggestions(sorted);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    };
    fetchSuggestions();
  }, [step, event.id]);

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords(prev => [...prev, trimmed]);
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      addKeyword(keywordInput);
      setKeywordInput('');
    }
  };

  const handleSubmit = async () => {
    setStep('loading');
    setError(null);
    setBannerDismissed(false);
    setLoadingComplete(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('prepare-visit', {
        body: {
          eventId: event.id,
          role,
          objective,
          keywords,
          duration,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResults(data);
      const allIds = new Set([
        ...(data.prioritaires || []).map((r: Recommendation) => r.exhibitor_id),
        ...(data.optionnels || []).map((r: Recommendation) => r.exhibitor_id),
      ]);
      setCheckedIds(allIds);
      // Signal completion → LoadingScreen animates to 100%, then we transition
      setLoadingComplete(true);
    } catch (err: any) {
      console.error('Prepare visit error:', err);
      setError(err.message || 'Une erreur est survenue');
      setStep('results');
    }
  };

  const handleRetry = () => {
    setResults(null);
    setError(null);
    handleSubmit();
  };

  const handleReset = () => {
    setStep(1);
    setRole('');
    setObjective('');
    setKeywords([]);
    setKeywordInput('');
    setDuration('');
    setResults(null);
    setError(null);
    setBannerDismissed(false);
    setCheckedIds(new Set());
  };

  const handleSave = async (replace = false) => {
    if (!results) return;
    setSaving(true);

    try {
      if (!user) {
        // Scenario 4: Not logged in - store in localStorage
        const filteredPrioritaires = results.prioritaires.filter(r => checkedIds.has(r.exhibitor_id));
        const filteredOptionnels = results.optionnels.filter(r => checkedIds.has(r.exhibitor_id));
        storePendingVisitPlan({
          event_id: event.id,
          event_slug: event.slug || '',
          role,
          objectif: objective,
          keywords,
          duration,
          prioritaires: filteredPrioritaires,
          optionnels: filteredOptionnels,
        });
        navigate('/auth?tab=signup');
        return;
      }

      // Add to favorites if not already
      if (!isFavorited) {
        await toggleFavorite(event.id);
      }

      // Save visit plan - only checked exhibitors
      const filteredPrioritaires = results.prioritaires.filter(r => checkedIds.has(r.exhibitor_id));
      const filteredOptionnels = results.optionnels.filter(r => checkedIds.has(r.exhibitor_id));
      await saveVisitPlan.mutateAsync({
        event_id: event.id,
        role,
        objectif: objective,
        keywords,
        duration,
        prioritaires: filteredPrioritaires,
        optionnels: filteredOptionnels,
      });

      toast({
        title: replace ? 'Liste mise à jour ✓' : 'Salon ajouté à votre agenda avec votre liste personnalisée ✓',
      });
      setBannerDismissed(true);
    } catch (err: any) {
      console.error('Save visit plan error:', err);
      toast({
        title: 'Erreur',
        description: err.message || 'Impossible de sauvegarder',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 = !!role;
  const canProceedStep2 = !!objective;

  // Determine banner scenario
  const getBannerConfig = () => {
    if (!results || error || bannerDismissed) return null;

    if (!user) {
      // Scenario 4
      return {
        message: 'Créez un compte gratuit pour retrouver cette liste dans Mon Agenda',
        primaryLabel: 'Enregistrer ma liste →',
        primaryAction: () => handleSave(),
        secondaryLabel: null as string | null,
        secondaryAction: null as (() => void) | null,
      };
    }

    if (existingPlan) {
      // Scenario 3
      return {
        message: 'Vous avez déjà une liste enregistrée pour ce salon',
        primaryLabel: 'Remplacer ma liste',
        primaryAction: () => handleSave(true),
        secondaryLabel: "Garder l'ancienne",
        secondaryAction: () => setBannerDismissed(true),
      };
    }

    if (isFavorited) {
      // Scenario 2
      return {
        message: 'Cet événement est dans votre agenda — enregistrez votre liste',
        primaryLabel: 'Enregistrer ma liste →',
        primaryAction: () => handleSave(),
        secondaryLabel: null,
        secondaryAction: null,
      };
    }

    // Scenario 1
    return {
      message: 'Enregistrez votre liste pour la retrouver dans Mon Agenda',
      primaryLabel: 'Ajouter à mon agenda →',
      primaryAction: () => handleSave(),
      secondaryLabel: null,
      secondaryAction: null,
    };
  };

  const bannerConfig = getBannerConfig();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Préparer ma visite avec l'IA</h2>
              <p className="text-sm text-muted-foreground">{event.nom_event}</p>
            </div>
          </div>

          {/* Progress bar */}
          {typeof step === 'number' && (
            <div className="flex gap-2 mt-4">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    s <= step ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-6">
          {/* STEP 1 - Role */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-1">Quel est votre rôle ?</h3>
                <p className="text-sm text-muted-foreground">Sélectionnez le profil qui correspond le mieux à votre fonction</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(r => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
                      role === r
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <span className="font-medium text-sm">{r}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  Continuer <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2 - Objective */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-1">Quel est votre objectif principal ?</h3>
                <p className="text-sm text-muted-foreground">Choisissez l'objectif qui décrit le mieux votre visite</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OBJECTIVES.map(o => (
                  <button
                    key={o}
                    onClick={() => setObjective(o)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
                      objective === o
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <span className="font-medium text-sm">{o}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 w-4 h-4" /> Retour
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
                  Continuer <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 - Keywords + Duration */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-1">Quels thèmes vous intéressent ?</h3>
                <p className="text-sm text-muted-foreground">Ajoutez des mots-clés pour affiner les recommandations</p>
              </div>

              <div>
                <Input
                  placeholder="Tapez un mot-clé puis Entrée..."
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordInputKeyDown}
                />
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {keywords.map(kw => (
                      <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Suggestions basées sur les exposants :</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions
                      .filter(s => !keywords.includes(s))
                      .slice(0, 6)
                      .map(s => (
                        <button
                          key={s}
                          onClick={() => addKeyword(s)}
                          className="text-xs px-3 py-1.5 rounded-full border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <p className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Combien de temps avez-vous sur le salon ?
                </p>
                <div className="flex gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cn(
                        'px-4 py-2 rounded-full text-sm font-medium border transition-all',
                        duration === d
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 w-4 h-4" /> Retour
                </Button>
                <Button onClick={handleSubmit} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Lancer l'analyse
                </Button>
              </div>
            </div>
          )}

          {/* LOADING */}
          {step === 'loading' && (
            <LoadingScreen exhibitorCount={exhibitorCount} />
          )}

          {/* RESULTS */}
          {step === 'results' && (
            <div className="space-y-6 pb-24">
              {error ? (
                <div className="text-center py-12 space-y-4">
                  <p className="text-destructive font-medium">{error}</p>
                  <p className="text-sm text-muted-foreground">
                    L'analyse n'a pas pu aboutir. Vous pouvez réessayer.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={handleReset}>Modifier mes critères</Button>
                    <Button onClick={handleRetry} className="gap-2">
                      <RefreshCw className="w-4 h-4" /> Réessayer
                    </Button>
                  </div>
                </div>
              ) : results ? (
                <>
                  {/* Summary banner */}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-1">
                    <p className="text-sm font-medium">
                      Basé sur votre profil, voici les{' '}
                      <span className="text-primary font-bold">{results.prioritaires.length + results.optionnels.length}</span>{' '}
                      exposants à prioriser parmi les{' '}
                      <span className="font-bold">{results.totalExhibitors}</span> présents.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {checkedIds.size} exposant{checkedIds.size > 1 ? 's' : ''} sélectionné{checkedIds.size > 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Prioritaires */}
                  {results.prioritaires.length > 0 && (
                    <section>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        ⭐ Vos incontournables
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {results.prioritaires.map((rec) => (
                          <RecommendationCard
                            key={rec.exhibitor_id}
                            rec={rec}
                            variant="primary"
                            eventId={event.id}
                            checked={checkedIds.has(rec.exhibitor_id)}
                            onCheckedChange={(checked) => {
                              setCheckedIds(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(rec.exhibitor_id);
                                else next.delete(rec.exhibitor_id);
                                return next;
                              });
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Optionnels */}
                  {results.optionnels.length > 0 && (
                    <section>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                        💡 À voir si vous avez le temps
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {results.optionnels.map((rec) => (
                          <RecommendationCard
                            key={rec.exhibitor_id}
                            rec={rec}
                            variant="secondary"
                            eventId={event.id}
                            checked={checkedIds.has(rec.exhibitor_id)}
                            onCheckedChange={(checked) => {
                              setCheckedIds(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(rec.exhibitor_id);
                                else next.delete(rec.exhibitor_id);
                                return next;
                              });
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="flex justify-center pt-4">
                    <Button variant="outline" onClick={handleReset}>
                      Modifier mes critères
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Sticky Save Banner */}
        {bannerConfig && step === 'results' && (
          <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Bookmark className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium truncate">{bannerConfig.message}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {bannerConfig.secondaryLabel && bannerConfig.secondaryAction && (
                  <Button variant="ghost" size="sm" onClick={bannerConfig.secondaryAction}>
                    {bannerConfig.secondaryLabel}
                  </Button>
                )}
                <Button size="sm" onClick={bannerConfig.primaryAction} disabled={saving} className="gap-2">
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="w-4 h-4" />
                  )}
                  {bannerConfig.primaryLabel}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Loading Screen ---
const LOADING_STEPS = [
  { threshold: 0, message: 'Analyse du salon…', icon: Search },
  { threshold: 20, message: 'Identification des exposants les plus pertinents…', icon: Users },
  { threshold: 45, message: 'Évaluation de la pertinence selon votre profil…', icon: BarChart3 },
  { threshold: 70, message: 'Priorisation des exposants recommandés…', icon: Sparkles },
  { threshold: 88, message: 'Finalisation de votre sélection personnalisée…', icon: CheckCircle2 },
];

function LoadingScreen({ exhibitorCount }: { exhibitorCount: number }) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed += 200;
      setProgress((prev) => {
        if (prev >= 93) return prev; // cap at 93 until real response
        // Non-linear curve: fast start, gradual slowdown
        const seconds = elapsed / 1000;
        if (seconds < 2) return Math.min(seconds * 12, 24); // 0→24 in 2s
        if (seconds < 5) return 24 + (seconds - 2) * 8; // 24→48 in 3s
        if (seconds < 10) return 48 + (seconds - 5) * 5.6; // 48→76 in 5s
        if (seconds < 15) return 76 + (seconds - 10) * 2.4; // 76→88 in 5s
        if (seconds < 25) return 88 + (seconds - 15) * 0.5; // 88→93 in 10s
        return 93;
      });
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const currentStep = [...LOADING_STEPS].reverse().find((s) => progress >= s.threshold) || LOADING_STEPS[0];
  const StepIcon = currentStep.icon;

  return (
    <div className="flex flex-col items-center justify-center py-14 gap-8 px-4">
      {/* Animated icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-9 h-9 text-primary animate-pulse" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <span className="text-[10px] font-bold text-primary-foreground">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold">Préparation de votre visite en cours</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nous analysons les {exhibitorCount} exposants du salon pour vous proposer une sélection personnalisée.
        </p>
      </div>

      {/* Progress bar + percentage */}
      <div className="w-full max-w-xs space-y-3">
        <Progress value={progress} className="h-2.5" />
        <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium min-h-[1.5rem]">
          <StepIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-center">{currentStep.message}</span>
        </div>
      </div>

      {/* Reassuring text */}
      <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
        Les grands salons peuvent demander quelques secondes supplémentaires.
      </p>
    </div>
  );
}

// --- Recommendation Card ---
function RecommendationCard({
  rec,
  variant,
  eventId,
  checked,
  onCheckedChange,
}: {
  rec: Recommendation;
  variant: 'primary' | 'secondary';
  eventId: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const logoUrl = getExhibitorLogoUrl(rec.logo_url, rec.website);
  const standNumber = normalizeStandNumber(rec.stand);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3 transition-shadow hover:shadow-md',
        variant === 'primary' ? 'bg-background' : 'bg-muted/30',
        !checked && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="mt-1 flex-shrink-0"
        />
        <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt={rec.name} className="w-full h-full object-contain" />
          ) : (
            <Building2 className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{rec.name}</p>
          {rec.secteur_principal && (
            <p className="text-xs text-muted-foreground mt-0.5">{rec.secteur_principal}</p>
          )}
          {standNumber && (
            <p className="text-xs text-muted-foreground mt-0.5">Stand {standNumber}</p>
          )}
        </div>
      </div>

      <div className={cn(
        'text-xs rounded-lg p-3 leading-relaxed',
        variant === 'primary'
          ? 'bg-primary/5 text-foreground border border-primary/10'
          : 'bg-muted/50 text-muted-foreground'
      )}>
        {rec.raison}
      </div>
    </div>
  );
}
