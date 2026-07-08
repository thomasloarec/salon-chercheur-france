import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Sparkles, ArrowRight, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import AnswerMarkdown from '@/components/recherche-ia/AnswerMarkdown';
import SignupWallDialog from '@/components/recherche-ia/SignupWallDialog';

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
  "Quels salons pour l'emballage écologique ?",
];

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
}

/**
 * Expérience de chat « Recherche IA Visiteur » réutilisable.
 * Utilisée à la fois dans la page dédiée et dans la sidebar de la liste des salons.
 * Même logique : sign-in anonyme, appels à l'Edge Function recherche-ia-visiteur,
 * gestion crédits/murs.
 */
const RechercheIAChat = ({ variant = 'page', showHero = true, headingAs = 'h2' }: RechercheIAChatProps) => {
  const { session, loading: authLoading } = useAuth();

  const isSidebar = variant === 'sidebar';
  const Heading = headingAs;

  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);

  // Mur affiché sous la conversation (mou = après réponse, dur = bloquant).
  const [wall, setWall] = useState<{ type: WallType; hard: boolean } | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [paidIntentSent, setPaidIntentSent] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const anonAttempted = useRef(false);

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
    setWall((w) => (w && !w.hard ? null : w));

    try {
      const { data, error } = await supabase.functions.invoke('recherche-ia-visiteur', {
        body: { question, history },
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
      setAsking(false);
    }
  };

  const handleUpgraded = () => {
    setWall(null);
    setCredits(null);
    toast({ title: 'Vous pouvez reprendre vos recherches ✓' });
  };

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

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Zone défilante : hero + accueil + conversation */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto min-h-0 ${isSidebar ? 'px-1' : ''}`}
      >
        {/* Hero / accroche */}
        {showHero && (
          <section className={`section-rule ${hasStarted ? 'mb-6' : 'mb-8'}`}>
            <p className="text-accent font-semibold uppercase tracking-wide text-xs mb-2">
              Recherche IA · Lotexpo
            </p>
            <Heading
              className={`heading-display text-foreground ${
                isSidebar
                  ? 'text-2xl'
                  : hasStarted
                  ? 'text-2xl md:text-3xl'
                  : 'text-3xl md:text-5xl'
              }`}
            >
              L'IA lit. Vous décidez.
            </Heading>
            {!hasStarted && (
              <p className={`text-muted-foreground mt-4 max-w-2xl ${isSidebar ? 'text-sm' : 'text-base md:text-lg'}`}>
                Le marché des salons est illisible. Décrivez votre besoin en une phrase,
                l'assistant repère les bons salons à venir et les exposants qui comptent.
              </p>
            )}
          </section>
        )}

        {/* Écran d'accueil : puces d'exemple */}
        {!hasStarted && (
          <div className={`grid gap-3 ${isSidebar ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => send(ex)}
                disabled={asking || !authReady}
                className="group text-left rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-accent/50 transition-colors p-4 disabled:opacity-60"
              >
                <span className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <span className="text-sm text-foreground">{ex}</span>
                </span>
              </button>
            ))}
          </div>
        )}

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
                  L'assistant analyse les salons…
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
        {/* Compteur de crédits */}
        {remainingLabel && (
          <div className={isSidebar ? 'mb-3 flex justify-center' : 'mt-4 flex justify-center'}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-primary text-xs font-medium px-3 py-1">
              {remainingLabel}
            </span>
          </div>
        )}

        {/* Barre de saisie */}
        <form onSubmit={onSubmit} className={isSidebar ? '' : 'mt-4 sticky bottom-4'}>
          <div className="rounded-2xl border border-border bg-background shadow-sm p-2 flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                hardWallActive
                  ? 'Débloquez de nouvelles recherches pour continuer…'
                  : 'Décrivez votre besoin (secteur, produit, entreprise…)'
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
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Besoin d'explorer par filtres ?{' '}
            <Link to="/" className="text-accent hover:underline font-medium">
              Utilisez l'annuaire des salons
            </Link>
          </p>
        </form>
      </div>

      <SignupWallDialog
        open={signupOpen}
        onOpenChange={setSignupOpen}
        onUpgraded={handleUpgraded}
      />
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
