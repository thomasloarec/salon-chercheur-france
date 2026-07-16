
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, Sparkles, X, Building2, ExternalLink, RefreshCw, Clock, CalendarPlus, Check, Bookmark, Search, Users, BarChart3, CheckCircle2, Loader2, Lock, Mail, Eye, EyeOff, Route, ShoppingCart, TrendingUp, Briefcase, Megaphone, FlaskConical, Factory, CircleDashed, PackageSearch, Scale, Handshake, Target, ScanLine, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { normalizeStandNumber } from '@/utils/standUtils';
import { supabase } from '@/integrations/supabase/client';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitPlan, useSaveVisitPlan, storePendingVisitPlan } from '@/hooks/useVisitPlan';
import { useExhibitorsByEvent } from '@/hooks/useExhibitorsByEvent';
import { toggleFavorite } from '@/utils/toggleFavorite';
import { useFavoriteEvents } from '@/hooks/useFavoriteEvents';
import { toast } from '@/hooks/use-toast';
import { triggerOnboarding } from '@/hooks/useOnboarding';
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

// Liste complète canonique (filet de sécurité pour "Autre" / rôle inconnu).
const ALL_OBJECTIVES = OBJECTIVES;

// Filtre d'affichage : objectifs pertinents par rôle (étape 1 → étape 2).
// Les clés matchent EXACTEMENT les valeurs de rôle stockées (cf. ROLES).
// Les chaînes d'objectif sont les chaînes canoniques verbatim.
const OBJECTIVES_BY_ROLE: Record<string, string[]> = {
  'Achats / Approvisionnement': [
    'Trouver de nouveaux fournisseurs', 'Comparer des solutions',
    'Découvrir les innovations du marché', 'Faire de la veille concurrentielle',
    'Identifier des partenaires'],
  'R&D / Ingénierie': [
    'Découvrir les innovations du marché', 'Faire de la veille concurrentielle',
    'Identifier des partenaires', 'Comparer des solutions', 'Trouver de nouveaux fournisseurs'],
  'Commercial / Business Development': [
    'Rencontrer mes clients et prospects', 'Identifier des partenaires',
    'Faire de la veille concurrentielle', 'Découvrir les innovations du marché'],
  'Direction / Management': [
    'Trouver de nouveaux fournisseurs', 'Comparer des solutions',
    'Découvrir les innovations du marché', 'Faire de la veille concurrentielle',
    'Identifier des partenaires', 'Rencontrer mes clients et prospects'],
  'Production / Industrialisation': [
    'Trouver de nouveaux fournisseurs', 'Comparer des solutions',
    'Découvrir les innovations du marché', 'Faire de la veille concurrentielle',
    'Identifier des partenaires'],
  'Marketing / Innovation': [
    'Découvrir les innovations du marché', 'Faire de la veille concurrentielle',
    'Identifier des partenaires', 'Comparer des solutions'],
};

const DURATIONS = ['2h', 'Demi-journée', 'Journée complète'];

// Présentation uniquement : mapping icône → valeur string (ne modifie aucune valeur).
const ROLE_ICONS: Record<string, LucideIcon> = {
  'Achats / Approvisionnement': ShoppingCart,
  'Commercial / Business Development': TrendingUp,
  'Direction / Management': Briefcase,
  'Marketing / Innovation': Megaphone,
  'R&D / Ingénierie': FlaskConical,
  'Production / Industrialisation': Factory,
  'Autre': CircleDashed,
};

const OBJECTIVE_ICONS: Record<string, LucideIcon> = {
  'Trouver de nouveaux fournisseurs': PackageSearch,
  'Comparer des solutions': Scale,
  'Découvrir les innovations du marché': Sparkles,
  'Faire de la veille concurrentielle': Eye,
  'Identifier des partenaires': Handshake,
  'Rencontrer mes clients et prospects': Target,
};

type Step = 1 | 2 | 3 | 'loading' | 'results' | 'auth';

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
  ai_duration_ms?: number;
  under_threshold?: boolean;
  qualified_count?: number;
  mode?: string;
}

// ── Wizard Session Tracking ──────────────────────────────────────────────────
async function createWizardSession(eventId: string, userId?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('wizard_sessions' as any)
      .insert({ event_id: eventId, user_id: userId || null, step_reached: 'opened' })
      .select('id')
      .single();
    if (error) { console.error('wizard_sessions insert error:', error); return null; }
    return (data as any)?.id || null;
  } catch (e) { console.error('wizard_sessions insert exception:', e); return null; }
}

async function updateWizardSession(sessionId: string, updates: Record<string, any>) {
  try {
    await supabase
      .from('wizard_sessions' as any)
      .update(updates)
      .eq('id', sessionId);
  } catch (e) { console.error('wizard_sessions update exception:', e); }
}

export default function PrepareVisitWizard({ open, onOpenChange, event, exhibitorCount }: PrepareVisitWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState('');
  const [objective, setObjective] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [duration, setDuration] = useState('');
  // Chips de suggestion = mots-clés suggérés du salon (jsonb → string[]).
  // Pas de fetch exhibitor_ai, pas de liste en dur de repli.
  const suggestions: string[] = Array.isArray(event.suggested_keywords)
    ? (event.suggested_keywords as string[])
    : [];
  // Placeholder dynamique : 2 premières suggestions du salon, sinon repli générique.
  const keywordPlaceholder =
    suggestions.length >= 2
      ? `Ex. : ${suggestions[0]}, ${suggestions[1]}…`
      : suggestions.length === 1
        ? `Ex. : ${suggestions[0]}…`
        : 'Tapez un mot-clé puis Entrée…';
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Inline auth state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signup');
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authShowConfirmPassword, setAuthShowConfirmPassword] = useState(false);

  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { data: existingPlan } = useVisitPlan(event.id);
  const { data: favoriteEvents = [] } = useFavoriteEvents();
  const saveVisitPlan = useSaveVisitPlan();

  const isFavorited = favoriteEvents.some((e: any) => e.id === event.id);

  // ── Échantillon DÉCORATIF de vrais exposants pour l'écran d'analyse (marquee) ──
  // Gate strict : ne fetch QUE quand le wizard est ouvert (slug vide => hook désactivé).
  // Best-effort : si vide / en cours / en erreur, l'écran s'affiche sans marquee.
  const { data: scanData } = useExhibitorsByEvent(
    open ? (event.slug || '') : '',
    undefined,
    40,
    0,
    event.id_event,
  );
  const scanExhibitors: { name: string; sector?: string }[] = (scanData?.exhibitors || [])
    .map((e: any) => ({
      name: e.name || e.exhibitor_name || '',
      sector: e.secteur || e.sector || undefined,
    }))
    .filter((e) => e.name);

  // ── Tracking session ref ──
  const wizardSessionId = useRef<string | null>(null);

  // Create session on open
  useEffect(() => {
    if (open && !wizardSessionId.current) {
      createWizardSession(event.id, user?.id).then(id => {
        wizardSessionId.current = id;
      });
    }
    if (!open) {
      wizardSessionId.current = null;
    }
  }, [open, event.id, user?.id]);

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords(prev => [...prev, trimmed]);
    }
  };

  // Build the final keyword list at submit time:
  // merge validated chips with whatever is still pending in the input,
  // split on commas, trim, drop empties and case-insensitive duplicates.
  const buildKeywords = (): string[] => {
    const fromInput = keywordInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const merged = [...keywords, ...fromInput];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const k of merged) {
      const key = k.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(k);
      }
    }
    return result;
  };

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && keywordInput.trim()) {
      e.preventDefault();
      keywordInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(addKeyword);
      setKeywordInput('');
    }
  };

  const handleSubmit = async () => {
    setStep('loading');
    setError(null);
    setBannerDismissed(false);
    setLoadingComplete(false);

    // Flush any pending input text into the keyword list before sending.
    const finalKeywords = buildKeywords();
    setKeywords(finalKeywords);
    setKeywordInput('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('prepare-visit', {
        body: {
          eventId: event.id,
          role,
          objective,
          keywords: finalKeywords,
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

      // Track results
      if (wizardSessionId.current) {
        updateWizardSession(wizardSessionId.current, {
          step_reached: 'results',
          nb_prioritaires: data.prioritaires?.length || 0,
          nb_optionnels: data.optionnels?.length || 0,
          ai_duration_ms: data.ai_duration_ms || null,
          completed_at: new Date().toISOString(),
        });
      }

      // Signal completion → LoadingScreen animates to 100%, then we transition
      setLoadingComplete(true);
    } catch (err: any) {
      console.error('Prepare visit error:', err);
      setError(err.message || 'Une erreur est survenue');

      // Track error
      if (wizardSessionId.current) {
        updateWizardSession(wizardSessionId.current, {
          ai_error: err.message || 'Unknown error',
        });
      }

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
    setLoadingComplete(false);
  };

  // ── Step transitions with tracking ──
  const goToStep2 = () => {
    setStep(2);
    if (wizardSessionId.current) {
      updateWizardSession(wizardSessionId.current, { step_reached: 'step1', role });
    }
  };

  const goToStep3 = () => {
    setStep(3);
    if (wizardSessionId.current) {
      updateWizardSession(wizardSessionId.current, { step_reached: 'step2', objectif: objective });
    }
  };

  const handleSave = async (replace = false) => {
    if (!results) return;
    setSaving(true);

    try {
      if (!user) {
        // Scenario 4: Not logged in — show inline auth step
        setStep('auth');
        // Track auth shown
        if (wizardSessionId.current) {
          updateWizardSession(wizardSessionId.current, { auth_shown: true });
        }
        setSaving(false);
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

      // Track saved
      if (wizardSessionId.current) {
        updateWizardSession(wizardSessionId.current, {
          step_reached: 'saved',
          saved: true,
          role,
          objectif: objective,
          keywords,
          duration,
          user_id: user.id,
        });
      }

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

  // After successful auth, auto-save the visit plan
  useEffect(() => {
    if (user && step === 'auth' && results) {
      // Track auth success
      if (wizardSessionId.current) {
        updateWizardSession(wizardSessionId.current, {
          auth_success: true,
          auth_method: 'email',
          user_id: user.id,
        });
      }

      // User just authenticated — save automatically
      const autoSave = async () => {
        setSaving(true);
        try {
          if (!isFavorited) {
            await toggleFavorite(event.id);
          }
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

          // Track saved after auth
          if (wizardSessionId.current) {
            updateWizardSession(wizardSessionId.current, {
              step_reached: 'saved',
              saved: true,
              role,
              objectif: objective,
              keywords,
              duration,
            });
          }

          toast({ title: 'Salon ajouté à votre agenda avec votre liste personnalisée ✓' });
          setBannerDismissed(true);
          setStep('results');
        } catch (err: any) {
          console.error('Auto-save after auth error:', err);
          toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
          setStep('results');
        } finally {
          setSaving(false);
        }
      };
      autoSave();
    }
  }, [user, step]);

  const handleInlineSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const { error } = await signIn(authEmail, authPassword);
    if (error) {
      setAuthError(error.message.includes('Invalid login credentials') ? 'Email ou mot de passe incorrect' : error.message);
    }
    setAuthLoading(false);
  };

  const handleInlineSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    if (authPassword !== authConfirmPassword) {
      setAuthError('Les mots de passe ne correspondent pas');
      setAuthLoading(false);
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Le mot de passe doit contenir au moins 6 caractères');
      setAuthLoading(false);
      return;
    }
    const { error } = await signUp(authEmail, authPassword);
    if (error) {
      setAuthError(error.message.includes('User already registered') ? 'Un compte avec cet email existe déjà' : error.message);
    } else {
      triggerOnboarding();
      setAuthMessage('Compte créé ! Vérifiez votre email pour confirmer votre inscription.');
    }
    setAuthLoading(false);
  };

  const handleInlineGoogleSignIn = async () => {
    // Track auth shown for Google
    if (wizardSessionId.current) {
      updateWizardSession(wizardSessionId.current, { auth_shown: true, auth_method: 'google' });
    }
    // Store pending plan before OAuth redirect (Google requires page redirect)
    if (results) {
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
    }
    triggerOnboarding();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
  };

  const bannerConfig = getBannerConfig();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-auto sm:max-w-3xl" aria-describedby={undefined}>
        <VisuallyHidden><DialogTitle>Préparer ma visite</DialogTitle></VisuallyHidden>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Route className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate">Préparer ma visite avec l'IA</h2>
              <p className="text-sm text-muted-foreground truncate">{event.nom_event}</p>
            </div>
            <button
              onClick={() => { handleReset(); onOpenChange(false); }}
              className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Progress bar */}
          {typeof step === 'number' && (
            <div className="flex gap-1.5 mt-4">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={cn(
                    'h-[5px] flex-1 rounded-full transition-colors',
                    s <= step ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-6 overflow-x-hidden">
          {/* STEP 1 - Role */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-1">Quel est votre rôle ?</h3>
                <p className="text-sm text-muted-foreground">Sélectionnez le profil qui correspond le mieux à votre fonction</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(r => {
                  const RoleIcon = ROLE_ICONS[r] ?? CircleDashed;
                  const selected = role === r;
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        // Reset de l'objectif s'il n'est plus pertinent pour le nouveau rôle.
                        const allowed = OBJECTIVES_BY_ROLE[r] ?? ALL_OBJECTIVES;
                        if (objective && !allowed.includes(objective)) setObjective('');
                        setTimeout(() => { setStep(2); if (wizardSessionId.current) updateWizardSession(wizardSessionId.current, { step_reached: 'step1', role: r }); }, 200);
                      }}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-lg border bg-card text-left transition-all duration-150 cursor-pointer hover:border-primary/40 hover:shadow-sm hover:-translate-y-px',
                        selected
                          ? 'border-2 border-primary bg-primary/5'
                          : 'border-border'
                      )}
                    >
                      <RoleIcon className={cn('w-5 h-5 flex-shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-sm', selected ? 'font-medium text-primary' : 'font-medium')}>{r}</span>
                    </button>
                  );
                })}
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
                {(OBJECTIVES_BY_ROLE[role] ?? ALL_OBJECTIVES).map(o => {
                  const ObjIcon = OBJECTIVE_ICONS[o] ?? Sparkles;
                  const selected = objective === o;
                  return (
                    <button
                      key={o}
                      onClick={() => { setObjective(o); setTimeout(() => { setStep(3); if (wizardSessionId.current) updateWizardSession(wizardSessionId.current, { step_reached: 'step2', objectif: o }); }, 200); }}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-lg border bg-card text-left transition-all duration-150 cursor-pointer hover:border-primary/40 hover:shadow-sm hover:-translate-y-px',
                        selected
                          ? 'border-2 border-primary bg-primary/5'
                          : 'border-border'
                      )}
                    >
                      <ObjIcon className={cn('w-5 h-5 flex-shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-sm font-medium', selected && 'text-primary')}>{o}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-start pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 w-4 h-4" /> Retour
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 - Keywords + Duration */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-1">
                  {objective === 'Rencontrer mes clients et prospects'
                    ? 'Que proposez-vous ?'
                    : 'Quels thèmes vous intéressent ?'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {objective === 'Rencontrer mes clients et prospects'
                    ? 'Décrivez votre offre — on trouve les exposants susceptibles de devenir vos clients.'
                    : 'Listez les produits, matériaux ou solutions que vous recherchez.'}
                </p>
              </div>

              <div>
                <Input
                  placeholder={keywordPlaceholder}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordInputKeyDown}
                />
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {keywords.map(kw => (
                      <Badge key={kw} className="gap-1 pr-1 rounded-md bg-primary/10 text-primary hover:bg-primary/10">
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="ml-1 text-primary hover:opacity-70">
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
                          : 'border-border text-muted-foreground hover:border-primary/40'
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
            <LoadingScreen
              exhibitorCount={exhibitorCount}
              scanExhibitors={scanExhibitors}
              complete={loadingComplete}
              onComplete={() => setStep('results')}
            />
          )}

          {/* RESULTS */}
          {step === 'results' && (
            <div className="space-y-6 pb-24 min-w-0 overflow-x-hidden">
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
                  {(results.prioritaires.length + results.optionnels.length) === 0 ? (
                    /* Empty / few results state */
                    <div className="text-center py-12 space-y-4">
                      <p className="font-medium">
                        Peu d'exposants correspondent précisément à vos critères.
                      </p>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Élargissez vos mots-clés ou changez d'objectif pour obtenir des recommandations.
                      </p>
                      <div className="flex justify-center pt-2">
                        <Button onClick={handleReset} className="gap-2">
                          <ArrowLeft className="w-4 h-4" /> Revenir au questionnaire
                        </Button>
                      </div>
                    </div>
                  ) : (
                  <>
                  {/* Seller mode banner */}
                  {results.mode === 'seller' && (
                    <div className="max-w-full overflow-hidden bg-info/10 border border-info/30 rounded-xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed break-words">
                      <span className="font-medium">Mode prospection :</span> nous remontons les exposants
                      dont l'activité suggère qu'ils pourraient être clients de votre offre — à valider sur place.
                    </div>
                  )}

                  {/* Summary banner */}
                  <div className="max-w-full overflow-hidden bg-secondary rounded-md p-3 sm:p-4 text-center space-y-1">
                    <p className="text-xs sm:text-sm font-medium leading-relaxed break-words text-balance">
                      Basé sur votre profil, voici les{' '}
                      <span className="text-primary font-bold">{results.prioritaires.length + results.optionnels.length}</span>{' '}
                      exposants à prioriser{duration ? ` pour une visite de ${duration}` : ''} parmi les{' '}
                      <span className="font-bold">{results.totalExhibitors}</span> présents.
                    </p>
                    {(() => {
                      // Critères réellement disponibles à l'écran résultats (state du wizard).
                      const segments: string[] = [];
                      const roleObjective = [role, objective].filter(Boolean).join(' · ');
                      if (roleObjective) segments.push(roleObjective);
                      if (keywords.length > 0) segments.push(keywords.slice(0, 3).join(', '));
                      if (segments.length === 0) return null;
                      return (
                        <p className="text-[12px] sm:text-[13px] text-secondary-foreground/70 break-words">
                          Pour : {segments.join(' · ')}
                        </p>
                      );
                    })()}
                    <p className="text-xs text-muted-foreground break-words">
                      {checkedIds.size} exposant{checkedIds.size > 1 ? 's' : ''} sélectionné{checkedIds.size > 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Prioritaires */}
                  {results.prioritaires.length > 0 && (
                    <section className="min-w-0 overflow-x-hidden">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 break-words">
                        <Star className="w-5 h-5 text-foreground flex-shrink-0" /> Vos incontournables
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                        {results.prioritaires.map((rec, i) => (
                          <CascadeItem key={rec.exhibitor_id} delay={Math.min(i * 60, 700)}>
                            <RecommendationCard
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
                          </CascadeItem>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Optionnels */}
                  {results.optionnels.length > 0 && (
                    <section className="min-w-0 overflow-x-hidden">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground break-words">
                        <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" /> À voir si vous avez le temps
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                        {results.optionnels.map((rec, i) => (
                          <CascadeItem
                            key={rec.exhibitor_id}
                            delay={Math.min((results.prioritaires.length + i) * 60, 700)}
                          >
                            <RecommendationCard
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
                          </CascadeItem>
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
                  )}
                </>
              ) : null}
            </div>
           )}

          {/* AUTH STEP — inline login/signup */}
          {step === 'auth' && (
            <div className="space-y-6 max-w-md mx-auto">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Créez un compte pour sauvegarder votre liste</h3>
                <p className="text-sm text-muted-foreground">
                  Votre sélection personnalisée sera enregistrée dans votre agenda.
                </p>
              </div>

              {/* Google button */}
              <Button onClick={handleInlineGoogleSignIn} variant="outline" className="w-full flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuer avec Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Tabs value={authTab} onValueChange={(v) => { setAuthTab(v as 'signin' | 'signup'); setAuthError(''); setAuthMessage(''); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Connexion</TabsTrigger>
                  <TabsTrigger value="signup">Inscription</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleInlineSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="wizard-signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="wizard-signin-email" type="email" placeholder="votre@email.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wizard-signin-password">Mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="wizard-signin-password" type={authShowPassword ? 'text' : 'password'} placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="pl-10 pr-10" required />
                        <button type="button" onClick={() => setAuthShowPassword(!authShowPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                          {authShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={authLoading}>
                      {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Se connecter
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleInlineSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="wizard-signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="wizard-signup-email" type="email" placeholder="votre@email.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wizard-signup-password">Mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="wizard-signup-password" type={authShowPassword ? 'text' : 'password'} placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="pl-10 pr-10" required />
                        <button type="button" onClick={() => setAuthShowPassword(!authShowPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                          {authShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wizard-signup-confirm">Confirmer le mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="wizard-signup-confirm" type={authShowConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} className="pl-10 pr-10" required />
                        <button type="button" onClick={() => setAuthShowConfirmPassword(!authShowConfirmPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                          {authShowConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={authLoading}>
                      {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Créer un compte
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {authError && (
                <Alert className="border-destructive/50 bg-destructive/5">
                  <AlertDescription className="text-destructive">{authError}</AlertDescription>
                </Alert>
              )}
              {authMessage && (
                <Alert className="border-info/30 bg-info/10">
                  <AlertDescription className="text-info">{authMessage}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setStep('results')}>
                  <ArrowLeft className="mr-2 w-4 h-4" /> Retour aux résultats
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Save Banner */}
        {bannerConfig && step === 'results' && (
          <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t px-4 sm:px-6 py-4 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Bookmark className="w-5 h-5 text-foreground flex-shrink-0" />
                <p className="text-sm font-medium break-words sm:truncate leading-snug">{bannerConfig.message}</p>
              </div>
              <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto sm:flex-shrink-0">
                {bannerConfig.secondaryLabel && bannerConfig.secondaryAction && (
                  <Button variant="ghost" size="sm" onClick={bannerConfig.secondaryAction} className="w-full sm:w-auto">
                    {bannerConfig.secondaryLabel}
                  </Button>
                )}
                <Button size="sm" onClick={bannerConfig.primaryAction} disabled={saving} className="gap-2 w-full sm:w-auto">
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
function LoadingScreen({
  exhibitorCount,
  scanExhibitors,
  complete,
  onComplete,
}: {
  exhibitorCount: number;
  scanExhibitors: { name: string; sector?: string }[];
  complete: boolean;
  onComplete: () => void;
}) {
  // Progression ESTIMÉE par le temps écoulé (le backend ne renvoie aucun avancement).
  // Courbe décélérante plafonnée à 90% : progress = 90 * (1 - exp(-t/12000)).
  // À l'arrivée réelle de la réponse (complete) → saut à 100% une fois, puis onComplete.
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (complete) return; // l'effet "complete" ci-dessous prend le relais
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const value = 90 * (1 - Math.exp(-elapsed / 12000)); // plafonne à 90, jamais au-delà
      setProgress(value);
    }, 100);
    return () => clearInterval(id);
  }, [complete]);

  // Quand le backend répond → barre à 100% puis transition vers les résultats.
  useEffect(() => {
    if (!complete) return;
    setProgress(100);
    const timer = setTimeout(() => onComplete(), 500);
    return () => clearTimeout(timer);
  }, [complete, onComplete]);

  // Liste dupliquée pour une boucle de marquee continue.
  const hasMarquee = scanExhibitors.length > 0;
  const marqueeItems = hasMarquee ? [...scanExhibitors, ...scanExhibitors] : [];

  return (
    <div className="flex flex-col items-center justify-center py-14 gap-8 px-4">
      {/* Keyframes locales (indéterminé + marquee vertical) */}
      <style>{`
        @keyframes pv-marquee-up {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>

      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-9 h-9 text-foreground animate-pulse" />
      </div>

      <div className="text-center space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold">Préparation de votre visite en cours</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-primary">{exhibitorCount}</span> fiches exposants analysées
        </p>
      </div>

      {/* Barre de progression honnête (estimation temporelle, plafond 90% → 100% à l'arrivée) */}
      <div className="w-full max-w-xs space-y-3">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium min-h-[1.5rem]">
          <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
          <span className="text-center">Analyse sémantique des profils…</span>
        </div>
      </div>

      {/* Mise en scène "scan" — marquee vertical de vrais exposants (décoratif, sans verdict) */}
      {hasMarquee && (
        <div
          className="w-full max-w-xs h-[150px] overflow-hidden relative"
          aria-hidden="true"
        >
          <div style={{ animation: 'pv-marquee-up 12s linear infinite' }}>
            {marqueeItems.map((ex, i) => (
              <div
                key={`${ex.name}-${i}`}
                className="flex items-center gap-2 py-2 px-3 opacity-60"
              >
                <ScanLine className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                <span className="text-sm truncate">{ex.name}</span>
                {ex.sector && (
                  <span className="text-xs text-muted-foreground truncate">· {ex.sector}</span>
                )}
              </div>
            ))}
          </div>
          {/* fondus haut/bas pour un défilement propre */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
        Les grands salons peuvent demander quelques secondes supplémentaires.
      </p>
    </div>
  );
}

// --- Recommendation Card ---
// One-time mount fade-in wrapper for results cards (honours prefers-reduced-motion).
const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function CascadeItem({ delay, children }: { delay: number; children: React.ReactNode }) {
  // Starts visible when reduced motion is preferred → no animation.
  const [shown, setShown] = useState(PREFERS_REDUCED_MOTION);
  useEffect(() => {
    if (PREFERS_REDUCED_MOTION) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (PREFERS_REDUCED_MOTION) return <>{children}</>;
  return (
    <div
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-all duration-300 ease-out will-change-transform',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'
      )}
    >
      {children}
    </div>
  );
}

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
  const initials = (rec.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'min-w-0 max-w-full overflow-hidden rounded-lg bg-background border-[0.5px] p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm',
        variant === 'primary' ? 'border-secondary' : 'border-border',
        !checked && 'opacity-50'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="flex-shrink-0"
        />
        <div className="w-10 h-10 rounded-lg bg-secondary flex-shrink-0 flex items-center justify-center overflow-hidden text-xs font-semibold text-secondary-foreground">
          {logoUrl ? (
            <img src={logoUrl} alt={rec.name} className="w-full h-full object-contain" />
          ) : initials ? (
            <span>{initials}</span>
          ) : (
            <Building2 className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-[15px] font-medium leading-tight break-words">{rec.name}</p>
          {rec.secteur_principal && (
            <p className="text-[13px] text-muted-foreground mt-0.5 break-words">{rec.secteur_principal}</p>
          )}
        </div>
        {standNumber && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary whitespace-nowrap">
            Stand {standNumber}
          </span>
        )}
      </div>

      <p className="max-w-full min-w-0 text-[13.5px] leading-[1.6] text-muted-foreground break-words overflow-hidden">
        {rec.raison}
      </p>
    </div>
  );
}
