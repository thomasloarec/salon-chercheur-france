import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import AnswerMarkdown from '@/components/recherche-ia/AnswerMarkdown';
import SignupWallDialog from '@/components/recherche-ia/SignupWallDialog';
import ThinkingIndicator from '@/components/recherche-ia/ThinkingIndicator';
import { usePublicStats } from '@/hooks/usePublicStats';
// import RechercheIAShowcase from '@/components/recherche-ia/RechercheIAShowcase';

type Role = 'user' | 'assistant';
interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}
interface Credits {
  used: number;
  allowed: number;
  remaining: number;
}
type WallType = 'signup' | 'daily_limit' | 'paywall';

const EXAMPLES = [
  'Je cherche un salon pour la restauration',
  'Sur quel salon exposer si je vends du logiciel RH ?',
  'Quels salons de la santé cet automne ?',
  'Où rencontrer des distributeurs en agroalimentaire ?',
  "Quels exposants sur le prochain salon de l'industrie ?",
];

// Suggestions cliquables affichées sous le champ (écran d'accueil).
const SUGGESTIONS = [
  'Où expose Banque Populaire ?',
  'Les prochains salons de la mode et du textile',
  'Mes concurrents sont X, Y et Z : à quels salons exposent-ils ?',
  'Salons de la tech à Paris en 2026',
];

/** Respecte prefers-reduced-motion. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

/** Effet de frappe cyclant une liste de phrases (repris de la Home). */
function useTypewriter(queries: string[], active: boolean) {
  const reduced = usePrefersReducedMotion();
  const [text, setText] = useState(queries[0]);
  useEffect(() => {
    if (!active || reduced) { setText(queries[0]); return; }
    let qi = 0, ci = 0, del = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const f = queries[qi];
      if (!del) {
        ci++;
        setText(f.slice(0, ci));
        if (ci === f.length) { del = true; timer = setTimeout(tick, 1500); return; }
        timer = setTimeout(tick, 52);
      } else {
        ci--;
        setText(f.slice(0, ci));
        if (ci === 0) { del = false; qi = (qi + 1) % queries.length; timer = setTimeout(tick, 260); return; }
        timer = setTimeout(tick, 26);
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [active, reduced, queries]);
  return text;
}

const ROTATING_WORDS = ['salon', 'client', 'concurrent', 'fournisseur', 'partenaire', 'distributeur', 'prospect'];

/** Mot tournant avec fondu doux, respecte prefers-reduced-motion. */
function RotatingText({ words, intervalMs = 2400 }: { words: string[]; intervalMs?: number }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduced || words.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setVisible(true);
      }, 300);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [reduced, words, intervalMs]);

  return (
    <span className="relative inline-block min-w-[12ch] text-center" aria-live="polite">
      <span
        className={`inline-block transition-all duration-300 ease-out ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        }`}
      >
        {words[index]}
      </span>
    </span>
  );
}


interface RechercheIAChatProps {
  /**
   * 'page'    → mise en page centrée pour la page dédiée (/recherche-ia)
   * 'sidebar' → colonne pleine hauteur pour le Sheet sur la liste des salons
   */
  variant?: 'page' | 'sidebar';
  /** Affiche l'accroche éditoriale (titre + sous-titre). */
  showHero?: boolean;
  /** Niveau du titre de l'accroche (h1 pour la page dédiée, h2 en sidebar). */
  headingAs?: 'h1' | 'h2';
  /**
   * Question initiale (ex : param `?q=` transmis depuis la home).
   * Si présente, la recherche est déclenchée automatiquement UNE seule fois.
   */
  initialQuery?: string;
}

/**
 * Expérience de chat « Recherche IA Visiteur » réutilisable.
 * Utilisée à la fois dans la page dédiée et dans la sidebar de la liste des salons.
 * Même logique : sign-in anonyme, appels à l'Edge Function recherche-ia-visiteur,
 * gestion crédits/murs.
 */
const RechercheIAChat = ({ variant = 'page', showHero = true, headingAs = 'h2', initialQuery }: RechercheIAChatProps) => {
  const { session, loading: authLoading } = useAuth();

  const isSidebar = variant === 'sidebar';
  const Heading = headingAs;

  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [deepSearch, setDeepSearch] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [conversationKey, setConversationKey] = useState<string | null>(null);

  // Mur affiché sous la conversation (mou = après réponse, dur = bloquant).
  const [wall, setWall] = useState<{ type: WallType; hard: boolean; resetAt: string | null } | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [paidIntentSent, setPaidIntentSent] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const anonAttempted = useRef(false);
  const autoSent = useRef(false);

  // 1) Session : sign-in anonyme si aucune session active.
  useEffect(() => {
    if (authLoading) return;
    if (session) {
      setAuthReady(true);
      return;
    }
    if (anonAttempted.current) return;
    anonAttempted.current = true;

    (async () => {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        toast({
          title: 'Connexion impossible',
          description:
            "Impossible de démarrer une session. La connexion anonyme est peut-être désactivée.",
          variant: 'destructive',
        });
      }
      setAuthReady(true);
    })();
  }, [authLoading, session]);

  useEffect(() => {
    if (session) setAuthReady(true);
  }, [session]);

  // Auto-scroll du conteneur de messages vers le bas (pas de la fenêtre).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, asking, wall]);

  const hasStarted = messages.length > 0;
  const hardWallActive = wall?.hard === true;

  // Placeholder animé (typewriter) : actif tant que le champ est vide et non bloqué.
  const animatedPlaceholder = useTypewriter(EXAMPLES, !hardWallActive && input.length === 0);

  const buildHistory = () =>
    messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

  const send = async (raw: string) => {
    const question = raw.trim();
    if (!question || asking || hardWallActive) return;
    if (!session) {
      toast({
        title: 'Session en cours de préparation',
        description: 'Patientez un instant puis réessayez.',
      });
      return;
    }

    const history = buildHistory();
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAsking(true);
    setDeepSearch(false);
    setWall((w) => (w && !w.hard ? null : w));

    const deepTimer = setTimeout(() => setDeepSearch(true), 10000);

    try {
      const { data, error } = await supabase.functions.invoke('recherche-ia-visiteur', {
        body: { question, history, conversation_key: conversationKey },
      });

      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 429) {
          toast({
            title: 'Trop de requêtes',
            description: 'Réessaie dans un moment.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Recherche indisponible',
            description: 'Une erreur est survenue. Réessaie dans un instant.',
            variant: 'destructive',
          });
        }
        return;
      }

      if (data?.credits) setCredits(data.credits as Credits);
      if (data?.conversation_key) setConversationKey(data.conversation_key as string);

      if (data?.wall && !data?.answer) {
        setWall({ type: data.wall.type as WallType, hard: true, resetAt: data.wall.reset_at ?? null });
        return;
      }

      if (data?.answer) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: data.answer as string },
        ]);
      }

      if (data?.wall?.soft) {
        setWall({ type: data.wall.type as WallType, hard: false, resetAt: data.wall.reset_at ?? null });
      }
    } catch (err) {
      toast({
        title: 'Recherche indisponible',
        description: err instanceof Error ? err.message : 'Réessaie dans un instant.',
        variant: 'destructive',
      });
    } finally {
      clearTimeout(deepTimer);
      setAsking(false);
      setDeepSearch(false);
    }
  };

  const handleUpgraded = () => {
    setWall(null);
    setCredits(null);
    toast({ title: 'Vous pouvez reprendre vos recherches ✓' });
  };

  // Déclenchement automatique de la question initiale (param `?q=` depuis la home).
  // Une seule fois, dès que la session anonyme/utilisateur est prête.
  useEffect(() => {
    if (autoSent.current) return;
    const q = initialQuery?.trim();
    if (!q || !session || asking) return;
    autoSent.current = true;
    setInput(q);
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, session]);

  const handlePaidIntent = async () => {
    setPaidIntentSent(true);
    try {
      await supabase.rpc('log_funnel_event', { p_event_type: 'paid_intent_clicked' });
    } catch {
      /* silencieux */
    }
  };

  const remainingLabel = useMemo(() => {
    if (!credits) return null;
    const r = credits.remaining;
    return `${r} recherche${r > 1 ? 's' : ''} restante${r > 1 ? 's' : ''}`;
  }, [credits]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  // Landing (page dédiée, avant toute question) : la maquette place la barre de
  // recherche directement dans le hero, la démo « L'IA en action » venant en dessous.
  const isLandingPage = !isSidebar && !hasStarted;

  // Chiffres réels : salons arrondis à la dizaine inf., exposants au millier inf.
  const { data: publicStats } = usePublicStats();
  const salonsLabel =
    publicStats && publicStats.salons >= 10
      ? (Math.floor(publicStats.salons / 10) * 10).toLocaleString('fr-FR')
      : null;
  const exposantsLabel =
    publicStats && publicStats.exposants >= 1000
      ? (Math.floor(publicStats.exposants / 1000) * 1000).toLocaleString('fr-FR')
      : null;

  // Accroche / hero réutilisable dans les deux mises en page.
  const heroBlock = showHero ? (
    <section
      className={`section-rule ${isLandingPage ? 'text-center mx-auto max-w-3xl' : hasStarted ? 'mb-6' : 'mb-8'}`}
    >
      <p className="text-primary font-semibold uppercase tracking-wide text-xs mb-2">
        Recherche IA · Lotexpo
      </p>
      <Heading
        className={`heading-display text-primary ${
          isSidebar
            ? 'text-2xl'
            : hasStarted
            ? 'text-2xl md:text-3xl'
            : 'text-3xl md:text-5xl'
        }`}
      >
        <span className="text-foreground">Posez votre question,</span>
        <span className="block text-primary">
          trouvez votre <RotatingText words={ROTATING_WORDS} />.
        </span>
      </Heading>
      {!hasStarted && (
        <p
          className={`text-muted-foreground mt-4 max-w-2xl ${isLandingPage ? 'mx-auto' : ''} ${
            isSidebar ? 'text-sm' : 'text-base md:text-lg'
          }`}
        >
          {salonsLabel && exposantsLabel
            ? `L'IA de Lotexpo a lu les ${salonsLabel} salons et leurs ${exposantsLabel} exposants. `
            : "L'IA de Lotexpo a lu tous les salons référencés et leurs exposants. "}
          Décrivez ce que vous cherchez en une phrase : elle vous dit où aller et à qui parler.
        </p>
      )}
    </section>
  ) : null;

  // Compteur de crédits restants.
  const creditsBadge = remainingLabel ? (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-primary text-xs font-medium px-3 py-1">
        {remainingLabel}
      </span>
    </div>
  ) : null;

  // Barre de saisie (le champ + le bouton d'envoi).
  const inputBar = (
    <div className="rounded-2xl border border-border bg-background shadow-sm p-2 flex items-end gap-2">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          hardWallActive
            ? 'Débloquez de nouvelles recherches pour continuer…'
            : animatedPlaceholder
        }
        rows={1}
        disabled={asking || hardWallActive || !authReady}
        className="min-h-[44px] max-h-40 resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent"
      />
      <Button
        type="submit"
        size="icon"
        className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={asking || hardWallActive || !authReady || !input.trim()}
        aria-label="Envoyer"
      >
        {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );

  const annuaireNote = (
    <p className="mt-2 text-center text-xs text-muted-foreground">
      Besoin d'explorer par filtres ?{' '}
      <Link to="/salons" className="text-primary hover:underline font-medium">
        Utilisez l'annuaire des salons
      </Link>
    </p>
  );

  const signupDialog = (
    <SignupWallDialog open={signupOpen} onOpenChange={setSignupOpen} onUpgraded={handleUpgraded} />
  );

  const suggestionsRow = (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => send(s)}
          disabled={!authReady || asking || hardWallActive}
          className="rounded-full border border-border bg-background px-3.5 py-2 text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {s}
        </button>
      ))}
    </div>
  );

  // ------- Mise en page LANDING (page dédiée) : hero + recherche + démo -------
  if (isLandingPage) {
    return (
      <div className="flex flex-col animate-fade-in">
        {heroBlock}

        {/* Barre de recherche intégrée au hero */}
        <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl mx-auto">
          {inputBar}
          {suggestionsRow}
          {annuaireNote}
        </form>

        {/* Showcase mis de côté : données fictives, à remplacer par de vraies réponses de l'agent */}
        {/* <RechercheIAShowcase /> */}

        {signupDialog}
      </div>
    );
  }

  // ------- Mise en page CONVERSATION / SIDEBAR -------
  return (
    <div className={isSidebar ? 'flex h-full flex-col' : 'flex flex-col flex-1 min-h-0'}>
      {/* Zone défilante : hero + conversation.
          En sidebar : remplit le Sheet (flex-1).
          En page : hauteur bornée au viewport pour scroller à l'intérieur. */}
      <div
        ref={scrollContainerRef}
        className={
          isSidebar
            ? 'flex-1 overflow-y-auto min-h-0 px-1'
            : 'flex-1 min-h-0 overflow-y-auto'
        }
      >
        {heroBlock}

        {/* Showcase mis de côté : données fictives, à remplacer par de vraies réponses de l'agent */}
        {/* {!hasStarted && <RechercheIAShowcase />} */}

        {/* Conversation */}
        {hasStarted && (
          <div className="flex-1 space-y-5">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end animate-fade-in">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-[15px]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start gap-2 animate-fade-in">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    L
                  </div>
                  <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-background/80 backdrop-blur border border-border px-4 py-3 shadow-sm">
                    <AnswerMarkdown>{m.content}</AnswerMarkdown>
                  </div>
                </div>
              )
            )}

            {asking && (
              <ThinkingIndicator
                question={messages[messages.length - 1]?.content ?? ''}
                deepSearch={deepSearch}
              />
            )}

            {wall && (
              <WallCallout
                type={wall.type}
                hard={wall.hard}
                resetAt={wall.resetAt}
                paidIntentSent={paidIntentSent}
                onSignup={() => setSignupOpen(true)}
                onPaidIntent={handlePaidIntent}
              />
            )}
          </div>
        )}
      </div>

      {/* Zone fixe : compteur + saisie */}
      <div className={isSidebar ? 'pt-3 mt-2 border-t border-border' : ''}>
        {creditsBadge && (
          <div className={isSidebar ? 'mb-3' : 'mt-4'}>{creditsBadge}</div>
        )}
        <form onSubmit={onSubmit} className={isSidebar ? '' : 'mt-4'}>
          {inputBar}
          {annuaireNote}
        </form>
      </div>

      {signupDialog}
    </div>
  );
};

/** Encart CTA affiché sous la conversation pour les murs signup / recharge quotidienne. */
const WallCallout = ({
  type,
  hard,
  resetAt,
  paidIntentSent,
  onSignup,
  onPaidIntent,
}: {
  type: WallType;
  hard: boolean;
  resetAt: string | null;
  paidIntentSent: boolean;
  onSignup: () => void;
  onPaidIntent: () => void;
}) => {
  if (type === 'signup') {
    return (
      <div className="rounded-2xl border border-primary/40 bg-secondary/60 p-5">
        <p className="heading-display text-lg text-foreground mb-1">
          {hard ? 'Vous avez utilisé vos 5 recherches gratuites' : 'Encore une envie de creuser ?'}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Créez votre compte Lotexpo pour 10 recherches par jour. Vos échanges sont conservés.
        </p>
        <Button onClick={onSignup} className="bg-primary text-primary-foreground hover:bg-primary/90">
          Créer mon compte
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  // type === 'daily_limit' (et fallback historique 'paywall') : mur de recharge.
  // reset_at = instant ou UNE recherche se libere (fenetre glissante 24h).
  const resetLabel = (() => {
    if (!resetAt) return null;
    const d = new Date(resetAt);
    if (Number.isNaN(d.getTime())) return null;
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const memeJour = d.toDateString() === new Date().toDateString();
    return memeJour
      ? `Une nouvelle recherche sera disponible à ${heure}.`
      : `Une nouvelle recherche sera disponible demain à ${heure}.`;
  })();

  return (
    <div className="rounded-2xl border border-primary/30 bg-secondary/60 p-5">
      <p className="heading-display text-lg text-foreground mb-1">
        Vous avez utilisé vos 10 recherches du moment
      </p>
      <p className="text-sm text-muted-foreground mb-1">
        {resetLabel ?? 'Vos recherches se rechargent au fil des prochaines 24 heures.'}
      </p>
      <p className="text-xs text-muted-foreground/80">
        {paidIntentSent ? (
          'Un forfait sans limite arrive — merci de votre intérêt, on vous tient au courant.'
        ) : (
          <>
            Besoin de chercher sans attendre ?{' '}
            <button
              type="button"
              onClick={onPaidIntent}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Rejoindre la liste du forfait illimité
            </button>
          </>
        )}
      </p>
    </div>
  );
};

export default RechercheIAChat;
