import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search, ArrowRight, Sparkles, Route, Radar, Rocket, LayoutGrid,
  Users, Store, Building2, AlertTriangle, Zap, MapPin, CalendarDays,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import EventCard from '@/components/EventCard';
import { usePublicStats } from '@/hooks/usePublicStats';
import { useUpcomingEvents } from '@/hooks/useUpcomingEvents';

/* ------------------------------------------------------------------ */
/* Placeholder animé (typewriter) pour le champ de recherche du hero    */
/* ------------------------------------------------------------------ */
const TYPEWRITER_QUERIES = [
  "Je cherche des fournisseurs d'emballage écoresponsable…",
  'Où exposent mes concurrents en cosmétique bio ?',
  'Sur quel salon rencontrer des directeurs achats agro ?',
  'Quels salons couvrent déjà le marché de la foodtech ?',
];

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

function useTypewriterPlaceholder(active: boolean) {
  const reduced = usePrefersReducedMotion();
  const [text, setText] = useState(TYPEWRITER_QUERIES[0]);

  useEffect(() => {
    if (!active || reduced) {
      setText(TYPEWRITER_QUERIES[0]);
      return;
    }
    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const full = TYPEWRITER_QUERIES[phrase];
      if (!deleting) {
        char++;
        setText(full.slice(0, char));
        if (char >= full.length) {
          deleting = true;
          timer = setTimeout(tick, 1800);
          return;
        }
        timer = setTimeout(tick, 45);
      } else {
        char--;
        setText(full.slice(0, char));
        if (char <= 0) {
          deleting = false;
          phrase = (phrase + 1) % TYPEWRITER_QUERIES.length;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 25);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [active, reduced]);

  return text;
}

/* ------------------------------------------------------------------ */
/* Compteur count-up au scroll                                          */
/* ------------------------------------------------------------------ */
function CountUp({ target, format }: { target: number; format: (n: number) => string }) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  // Détecte le passage dans la vue (une seule fois).
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Anime dès que la cible est connue ET visible (les stats arrivent en async).
  useEffect(() => {
    if (!inView || target <= 0) return;
    if (reduced) { setValue(target); return; }
    const duration = 1600;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.floor(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
      else setValue(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, reduced]);

  return <span ref={ref}>{format(value)}</span>;
}

const floorTo = (n: number, step: number) => Math.floor(n / step) * step;
const frThousands = (n: number) => n.toLocaleString('fr-FR');

/* ------------------------------------------------------------------ */
/* Reveal au scroll                                                     */
/* ------------------------------------------------------------------ */
function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) { setShown(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [reduced]);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */
const Home = () => {
  const navigate = useNavigate();
  const { data: stats } = usePublicStats();
  const { data: upcoming, isLoading: upcomingLoading } = useUpcomingEvents(8);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const placeholder = useTypewriterPlaceholder(!focused && query.length === 0);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = query.trim();
    if (!value) return;
    navigate(`/recherche-ia?q=${encodeURIComponent(value)}`);
  };

  const salonsLabel = stats ? `${frThousands(floorTo(stats.salons, 50))}+` : '…';
  const exposantsLabel = stats ? `${frThousands(floorTo(stats.exposants, 1000))}+` : '…';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Salons professionnels en France, lus par l'IA | Lotexpo</title>
        <meta
          name="description"
          content="L'information sur les salons est partout, donc introuvable. L'IA de Lotexpo lit tout — salons, exposants, secteurs — et vous donne la réponse qui compte."
        />
        <link rel="canonical" href="https://lotexpo.com/" />
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden bg-background">
          <div className="max-w-4xl mx-auto px-6 pt-16 pb-14 md:pt-24 md:pb-20 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary text-primary text-xs font-semibold px-3 py-1 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Nouveau · Les salons professionnels, lus par l'IA
            </span>

            <h1 className="heading-display text-4xl md:text-6xl text-foreground">
              Le bon salon.
              <span className="block text-accent">Les bonnes rencontres.</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              L'information sur les salons est partout, donc introuvable. L'IA de Lotexpo lit
              tout (salons, exposants, secteurs) et vous donne la réponse qui compte.
            </p>

            {/* Champ de recherche */}
            <form onSubmit={submitSearch} className="mt-8 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background shadow-lg p-2 focus-within:border-accent transition-colors">
                <Search className="ml-2 h-5 w-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={placeholder}
                  aria-label="Décrivez votre besoin"
                  className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground text-base py-2.5 min-w-0"
                />
                <Button
                  type="submit"
                  className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-4"
                >
                  <span className="hidden sm:inline">Chercher avec l'IA</span>
                  <ArrowRight className="h-4 w-4 sm:ml-2" />
                </Button>
              </div>
            </form>

            <div className="mt-5 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <span>ou</span>
              <Link to="/salons">
                <Button variant="ghost" className="text-primary hover:text-accent">
                  Voir tous les salons
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ============================= COMPTEURS ============================= */}
        <section className="border-y border-border bg-secondary/40">
          <div className="max-w-5xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="heading-display text-4xl md:text-5xl text-primary">
                  <CountUp target={stats ? floorTo(stats.salons, 50) : 0} format={(n) => `${frThousands(n)}+`} />
                </div>
                <p className="mt-2 text-muted-foreground">salons professionnels indexés</p>
              </div>
              <div>
                <div className="heading-display text-4xl md:text-5xl text-primary">
                  <CountUp target={stats ? floorTo(stats.exposants, 1000) : 0} format={(n) => `${frThousands(n)}+`} />
                </div>
                <p className="mt-2 text-muted-foreground">fiches exposants lues et structurées par l'IA</p>
              </div>
              <div>
                <div className="heading-display text-4xl md:text-5xl text-primary">France entière</div>
                <p className="mt-2 text-muted-foreground">tous secteurs confondus</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================= PROBLÈME ============================= */}
        <section className="bg-primary text-primary-foreground">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal className="max-w-2xl mx-auto text-center">
              <p className="text-accent font-semibold uppercase tracking-wide text-xs mb-3">
                Le cercle vicieux
              </p>
              <h2 className="heading-display text-3xl md:text-4xl">
                Chacun attend l'autre. Le cercle se resserre.
              </h2>
            </Reveal>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: Users,
                  title: 'Visiteurs',
                  text: "Trop d'événements, trop peu d'infos comparables. On ne sait plus quel salon vaut le déplacement.",
                },
                {
                  icon: Store,
                  title: 'Exposants',
                  text: 'Ils investissent sans visibilité sur le public réellement présent. Le ROI devient un pari.',
                },
                {
                  icon: Building2,
                  title: 'Salons',
                  text: 'Ils peinent à prouver leur valeur. Moins de visiteurs qualifiés, moins d\u2019exposants convaincus.',
                },
              ].map((c, i) => (
                <Reveal key={c.title} className="h-full" >
                  <div
                    className="h-full rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6"
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/20 text-accent mb-4">
                      <c.icon className="h-5 w-5" />
                    </div>
                    <h3 className="heading-display text-xl mb-2">{c.title}</h3>
                    <p className="text-primary-foreground/75 text-sm leading-relaxed">{c.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Palier */}
            <Reveal className="mt-14 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-destructive/20 text-primary-foreground px-4 py-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-accent" />
                Un écosystème <span className="italic text-accent">en danger</span>
              </div>
            </Reveal>

            {/* Bascule */}
            <Reveal className="mt-10 max-w-2xl mx-auto text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="heading-display text-2xl md:text-3xl">
                C'est l'IA qui débloque l'issue.
              </h3>
              <p className="mt-3 text-primary-foreground/80">
                Lotexpo lit l'ensemble du marché et redonne à chacun l'information qui manquait.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ============================= SOLUTION ============================= */}
        <section className="bg-background">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <Reveal className="max-w-2xl mx-auto text-center mb-16">
              <p className="text-accent font-semibold uppercase tracking-wide text-xs mb-3">
                La solution
              </p>
              <h2 className="heading-display text-3xl md:text-4xl text-foreground">
                Une intelligence qui lit le marché à votre place
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Cinq briques connectées pour transformer le brouillard des salons en décisions claires.
              </p>
            </Reveal>

            <div className="space-y-16 md:space-y-24">
              {SOLUTION_BLOCKS.map((block, i) => (
                <SolutionRow key={block.title} block={block} reversed={i % 2 === 1} />
              ))}
            </div>
          </div>
        </section>

        {/* ============================= PROCHAINS SALONS ============================= */}
        <section className="bg-secondary/40 border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="flex items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-accent font-semibold uppercase tracking-wide text-xs mb-2">
                  Agenda
                </p>
                <h2 className="heading-display text-3xl md:text-4xl text-foreground">
                  Prochains salons
                </h2>
              </div>
              <Link to="/salons" className="hidden sm:block">
                <Button variant="outline">
                  Voir tous les salons
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {upcomingLoading ? (
              <div className="grid gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-background p-4 animate-pulse">
                    <div className="h-44 bg-muted rounded-lg mb-4" />
                    <div className="h-4 bg-muted rounded mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : upcoming && upcoming.length > 0 ? (
              <div className="grid gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 justify-items-center">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} view="grid" />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucun salon à venir pour le moment.
              </p>
            )}

            <div className="text-center mt-10 sm:hidden">
              <Link to="/salons">
                <Button variant="outline">
                  Voir tous les salons
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ============================= CTA FINAL ============================= */}
        <section className="bg-primary text-primary-foreground">
          <div className="max-w-3xl mx-auto px-6 py-20 text-center">
            <Reveal>
              <h2 className="heading-display text-3xl md:text-5xl">
                Le salon redevient lisible.
              </h2>
              <p className="mt-4 text-primary-foreground/80 text-lg">
                Posez votre question. L'IA lit tout et vous répond.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/recherche-ia" className="w-full sm:w-auto">
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-6 text-base">
                    Essayer la recherche IA
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/salons" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full h-12 px-6 text-base border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    Voir tous les salons
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sous-blocs solution                                                  */
/* ------------------------------------------------------------------ */
interface SolutionBlock {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; to: string };
  visual: React.ReactNode;
}

const SolutionRow = ({ block, reversed }: { block: SolutionBlock; reversed: boolean }) => (
  <Reveal>
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center ${reversed ? 'md:[&>*:first-child]:order-2' : ''}`}>
      <div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-accent mb-4">
          <block.icon className="h-5 w-5" />
        </div>
        <p className="text-accent font-semibold uppercase tracking-wide text-xs mb-2">{block.eyebrow}</p>
        <h3 className="heading-display text-2xl md:text-3xl text-foreground mb-3">{block.title}</h3>
        <p className="text-muted-foreground text-base leading-relaxed mb-5">{block.text}</p>
        <Link to={block.cta.to}>
          <Button variant="outline" className="group">
            {block.cta.label}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </div>
      <div>{block.visual}</div>
    </div>
  </Reveal>
);

/* Visuels mock (brand-consistent, sans image externe) */
const VisualCard = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-secondary/30 p-5 shadow-sm">{children}</div>
);

const SOLUTION_BLOCKS: SolutionBlock[] = [
  {
    icon: Sparkles,
    eyebrow: 'Recherche IA',
    title: 'Posez votre question, obtenez la réponse',
    text: "En langage naturel : l'IA lit les salons, les exposants et les secteurs, puis vous donne la réponse qui compte — pas une liste de liens.",
    cta: { label: 'Essayer la recherche IA', to: '/recherche-ia' },
    visual: (
      <VisualCard>
        <div className="space-y-3">
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2 text-sm max-w-[80%]">
              Où exposent mes concurrents en cosmétique bio ?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-background border border-border px-4 py-3 text-sm text-foreground max-w-[90%]">
              3 salons concentrent l'offre : <span className="text-accent font-medium">Cosmetic 360</span>,
              <span className="text-accent font-medium"> MakeUp in Paris</span> et
              <span className="text-accent font-medium"> Natexpo</span>. Voici les exposants clés…
            </div>
          </div>
        </div>
      </VisualCard>
    ),
  },
  {
    icon: Route,
    eyebrow: 'Parcours IA',
    title: 'Un parcours de visite optimisé',
    text: "Selon vos objectifs, l'IA génère l'itinéraire : les bons stands, dans le bon ordre, pour ne rien manquer sur place.",
    cta: { label: 'Générer mon parcours', to: '/recherche-ia' },
    visual: (
      <VisualCard>
        <ol className="space-y-3">
          {['Hall 1 · Stand A12 — Fournisseur emballage', 'Hall 2 · Stand C04 — Directeur achats agro', 'Hall 3 · Stand E21 — Solution foodtech'].map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl bg-background border border-border px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold shrink-0">{i + 1}</span>
              <span className="text-sm text-foreground">{s}</span>
            </li>
          ))}
        </ol>
      </VisualCard>
    ),
  },
  {
    icon: Radar,
    eyebrow: 'Radar CRM',
    title: 'Vos comptes, repérés sur le terrain',
    text: 'Importez votre CRM : Lotexpo croise vos comptes et prospects avec les listes d\u2019exposants et vous dit où les rencontrer.',
    cta: { label: 'Découvrir Radar CRM', to: '/radar-crm' },
    visual: (
      <VisualCard>
        <div className="space-y-2">
          {[
            { name: 'Acme Packaging', match: 'expose à Emballage 2026' },
            { name: 'BioCosm SAS', match: 'expose à Natexpo' },
            { name: 'FreshAgro', match: 'expose à SIAL Paris' },
          ].map((r) => (
            <div key={r.name} className="flex items-center justify-between rounded-xl bg-background border border-border px-4 py-2.5">
              <span className="text-sm font-medium text-foreground">{r.name}</span>
              <span className="inline-flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                <Radar className="h-3 w-3" /> {r.match}
              </span>
            </div>
          ))}
        </div>
      </VisualCard>
    ),
  },
  {
    icon: Rocket,
    eyebrow: 'Nouveautés',
    title: 'Les innovations, avant le salon',
    text: 'Suivez les nouveautés produits annoncées par les exposants, secteur par secteur, pour préparer les bonnes rencontres.',
    cta: { label: 'Voir les nouveautés', to: '/nouveautes' },
    visual: (
      <VisualCard>
        <div className="grid grid-cols-2 gap-3">
          {['Emballage recyclé', 'Cosmétique solide', 'Capteur IoT agro', 'App de commande'].map((n) => (
            <div key={n} className="rounded-xl bg-background border border-border p-3">
              <div className="flex items-center gap-1.5 text-accent text-xs font-medium mb-1.5">
                <Rocket className="h-3.5 w-3.5" /> Nouveauté
              </div>
              <p className="text-sm text-foreground leading-snug">{n}</p>
            </div>
          ))}
        </div>
      </VisualCard>
    ),
  },
  {
    icon: LayoutGrid,
    eyebrow: 'Moteur & fiches',
    title: 'Chaque salon, chaque exposant : structuré',
    text: 'Un moteur et des fiches lisibles, à jour : dates, lieu, secteurs, exposants. La donnée brute rendue exploitable.',
    cta: { label: 'Explorer les salons', to: '/salons' },
    visual: (
      <VisualCard>
        <div className="rounded-xl bg-background border border-border p-4">
          <div className="h-24 rounded-lg bg-secondary/60 mb-3" />
          <p className="heading-display text-base text-foreground mb-1">SIAL Paris 2026</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <CalendarDays className="h-3.5 w-3.5" /> 17 – 21 octobre 2026
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Paris Nord Villepinte
          </p>
        </div>
      </VisualCard>
    ),
  },
];

export default Home;