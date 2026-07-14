import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ArrowRight, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import AnswerMarkdown from '@/components/recherche-ia/AnswerMarkdown';
import SignupWallDialog from '@/components/recherche-ia/SignupWallDialog';
import RechercheIAShowcase from '@/components/recherche-ia/RechercheIAShowcase';

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
type WallType = 'signup' | 'paywall';

const EXAMPLES = [
  'À quels salons aller pour voir des logiciels de gestion pour la restauration ?',
  'Sur quel salon exposer si je fais du logiciel resto-tech ?',
  'Où expose IDELINK ?',
  "Quels salons pour l'emballage écoresponsable ?",
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
  const [wall, setWall] = useState<{ type: WallType; hard: boolean } | null>(null);
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
        setWall({ type: data.wall.type as WallType, hard: true });
        return;
      }

      if (data?.answer) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: data.answer as string },
        ]);
      }

      if (data?.wall?.soft) {
        setWall({ type: data.wall.type as WallType, hard: false });
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

  // Accroche / hero réutilisable dans les deux mises en page.
  const heroBlock = showHero ? (
    <section
      className={`section-rule ${isLandingPage ? 'text-center mx-auto max-w-3xl' : hasStarted ? 'mb-6' : 'mb-8'}`}
    >
      <p className="text-accent font-semibold uppercase tracking-wide text-xs mb-2">
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
        Toutes les opportunités des salons professionnels, révélées par l'IA.
      </Heading>
      {!hasStarted && (
        <p
          className={`text-muted-foreground mt-4 max-w-2xl ${isLandingPage ? 'mx-auto' : ''} ${
            isSidebar ? 'text-sm' : 'text-base md:text-lg'
          }`}
        >
          Le marché des salons est illisible. L'IA de Lotexpo a lu tous les salons et
          leurs exposants : décrivez ce que vous cherchez en une phrase, elle vous dit
          où aller et à qui parler.
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
        className="h-10 w-10 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
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
      <Link to="/salons" className="text-accent hover:underline font-medium">
        Utilisez l'annuaire des salons
      </Link>
    </p>
  );

  const signupDialog = (
    <SignupWallDialog open={signupOpen} onOpenChange={setSignupOpen} onUpgraded={handleUpgraded} />
  );

  // ------- Mise en page LANDING (page dédiée) : hero + recherche + démo -------
  if (isLandingPage) {
    return (
      <div className="flex flex-col">
        {heroBlock}

        {/* Barre de recherche intégrée au hero */}
        <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl mx-auto">
          {inputBar}
          {annuaireNote}
        </form>

        {/* Démo « L'IA en action » */}
        <RechercheIAShowcase />

        {signupDialog}
      </div>
    );
  }

  // ------- Mise en page CONVERSATION / SIDEBAR -------
  return (
    <div className={isSidebar ? 'flex h-full flex-col' : 'flex flex-col'}>
      {/* Zone défilante : hero + conversation.
          En sidebar : remplit le Sheet (flex-1).
          En page : hauteur bornée au viewport pour scroller à l'intérieur. */}
      <div
        ref={scrollContainerRef}
        className={
          isSidebar
            ? 'flex-1 overflow-y-auto min-h-0 px-1'
            : 'overflow-y-auto max-h-[calc(100vh-16rem)]'
        }
      >
        {heroBlock}

        {/* Écran d'accueil sidebar : démo « L'IA en action » */}
        {!hasStarted && <RechercheIAShowcase />}

        {/* Conversation */}
        {hasStarted && (
          <div className="flex-1 space-y-5">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-[15px]">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-secondary/60 border border-border px-4 py-3">
                    <AnswerMarkdown>{m.content}</AnswerMarkdown>
                  </div>
                </div>
              )
            )}

            {asking && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-secondary/60 border border-border px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  {deepSearch ? 'Question plus complexe, j\'approfondis la recherche…' : "L'assistant analyse les salons…"}
                </div>
              </div>
            )}

            {wall && (
              <WallCallout
                type={wall.type}
                hard={wall.hard}
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
        <form onSubmit={onSubmit} className={isSidebar ? '' : 'mt-4 sticky bottom-4'}>
          {inputBar}
          {annuaireNote}
        </form>
      </div>

      {signupDialog}
    </div>
  );
};

/** Encart CTA affiché sous la conversation pour les murs signup / paywall. */
const WallCallout = ({
  type,
  hard,
  paidIntentSent,
  onSignup,
  onPaidIntent,
}: {
  type: WallType;
  hard: boolean;
  paidIntentSent: boolean;
  onSignup: () => void;
  onPaidIntent: () => void;
}) => {
  if (type === 'signup') {
    return (
      <div className="rounded-2xl border border-accent/40 bg-secondary/60 p-5">
        <p className="heading-display text-lg text-foreground mb-1">
          {hard ? 'Vous avez utilisé vos 3 recherches gratuites' : 'Encore une envie de creuser ?'}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Créez votre compte Lotexpo pour 3 recherches de plus. Vos échanges sont conservés.
        </p>
        <Button onClick={onSignup} className="bg-accent text-accent-foreground hover:bg-accent/90">
          Créer mon compte
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-secondary/60 p-5">
      <p className="heading-display text-lg text-foreground mb-1 flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        Vous avez exploré à fond
      </p>
      {paidIntentSent ? (
        <p className="text-sm text-muted-foreground">
          Bientôt disponible — on te tient au courant. Merci de ton intérêt !
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Un forfait arrive pour continuer sans limite.
          </p>
          <Button
            onClick={onPaidIntent}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Débloquer / Rejoindre la liste
          </Button>
        </>
      )}
    </div>
  );
};

export default RechercheIAChat;
