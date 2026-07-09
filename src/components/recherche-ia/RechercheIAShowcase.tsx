// TODO: remplacer par de vraies réponses de l'agent avant mise en ligne.
import React, { useEffect, useRef, useState } from 'react';

interface DemoCard {
  name: string;
  meta: string;
  why: string;
}
interface DemoTab {
  key: string;
  tab: string;
  question: string;
  intro: string;
  cards: DemoCard[];
  relance: string;
}

const TABS: DemoTab[] = [
  {
    key: 'trouver',
    tab: 'Trouver un salon',
    question: 'À quels salons aller pour voir des logiciels de gestion pour la restauration ?',
    intro: 'Trois salons réunissent les éditeurs de solutions pour la restauration :',
    cards: [
      { name: 'Food Hotel Tech', meta: '10-11 mars · Paris', why: 'Le plus ciblé : ~47 exposants en tech restauration (caisse, commande, réservation).' },
      { name: 'SIRHA', meta: '23-27 janv. · Lyon', why: 'Généraliste mais massif : des dizaines d’éditeurs y exposent.' },
      { name: 'Sandwich & Snack Show', meta: '19-20 mai · Paris', why: 'Orienté restauration rapide et nomade.' },
    ],
    relance: 'Parmi les exposants pertinents : Adoria, Inpulse, Zelty. Je peux détailler le stand de l’un d’eux.',
  },
  {
    key: 'exposer',
    tab: 'Où exposer',
    question: 'Sur quel salon exposer si je fais du logiciel resto-tech ?',
    intro: 'Pour toucher des restaurateurs et franchises en recherche de solutions digitales :',
    cards: [
      { name: 'Food Hotel Tech', meta: 'Paris', why: 'L’audience la plus qualifiée pour la resto-tech. Vos concurrents directs (Adoria, Inpulse) y sont déjà présents.' },
      { name: 'SIRHA', meta: 'Lyon', why: 'Audience massive et internationale, mais plus large. Fort pour la notoriété.' },
    ],
    relance: 'Si votre priorité est la génération de leads, Food Hotel Tech offre le meilleur ratio ciblage / coût.',
  },
  {
    key: 'reperer',
    tab: 'Repérer un acteur',
    question: 'Où expose IDELINK ?',
    intro: 'IDELINK est référencé sur 1 salon :',
    cards: [
      { name: 'Food Hotel Tech', meta: '10-11 mars · Paris', why: 'Stand à confirmer.' },
    ],
    relance: 'Voulez-vous les autres exposants du même secteur sur ce salon ?',
  },
  {
    key: 'sourcer',
    tab: 'Sourcer un fournisseur',
    question: 'Quels salons pour l’emballage écoresponsable ?',
    intro: 'Deux salons couvrent l’emballage durable :',
    cards: [
      { name: 'All4Pack', meta: 'Paris', why: 'Le rendez-vous emballage & logistique, avec un pôle éco-conception.' },
      { name: 'ADF&PCD', meta: 'Paris', why: 'Emballage premium (cosmétique, pharma), plusieurs fournisseurs éco-responsables.' },
    ],
    relance: 'Je peux filtrer sur les seuls exposants "emballage recyclé" si besoin.',
  },
];

const RechercheIAShowcase = () => {
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'answered'>('typing');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setPhase('typing');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPhase('answered'), 1000);
    return () => clearTimeout(timerRef.current);
  }, [active]);

  const current = TABS[active];

  return (
    <section aria-label="L'IA en action" className="mt-14 md:mt-16">
      {/* En-tête centré */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="mx-auto mb-4 h-[3px] w-11 rounded-full bg-accent" />
        <p className="text-accent font-semibold uppercase tracking-[0.15em] text-xs mb-3">
          L'IA en action
        </p>
        <h2 className="heading-display text-2xl md:text-3xl text-foreground">
          Voyez ce qu'elle sait répondre
        </h2>
        <p className="text-muted-foreground mt-3 text-base">
          Quatre questions typiques, quatre réponses qu'aucun humain ne pourrait compiler à la
          main. Choisissez un cas.
        </p>
      </div>

      {/* Onglets (centrés) */}
      <div className="flex flex-wrap gap-2 justify-center mb-5">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              i === active
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-secondary border border-border'
            }`}
          >
            {t.tab}
          </button>
        ))}
      </div>

      {/* Fenêtre de chat */}
      <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
        {/* En-tête de la fenêtre */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/40">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-display font-bold">
            L
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm leading-tight">Assistant Lotexpo</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'hsl(var(--success-green))' }}
              />
              en ligne
            </p>
          </div>
        </div>

        {/* Corps de la conversation */}
        <div className="px-5 py-5 min-h-[340px] space-y-4">
          {/* Question utilisateur */}
          <div className="flex justify-end animate-fade-in">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-[15px]">
              {current.question}
            </div>
          </div>

          {/* Indicateur de saisie */}
          {phase === 'typing' && (
            <div className="flex justify-start" key={`typing-${active}`}>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-secondary/60 border border-border px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
              </div>
            </div>
          )}

          {/* Réponse assistant */}
          {phase === 'answered' && (
            <div className="flex justify-start gap-3 animate-fade-in" key={`answer-${active}`}>
              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-accent/15 text-accent grid place-items-center font-display font-semibold">
                L
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-secondary/60 border border-border px-4 py-3 space-y-3">
                <p className="text-[15px] text-foreground">{current.intro}</p>
                <div className="space-y-2.5">
                  {current.cards.map((c) => (
                    <div key={c.name} className="border-l-[3px] border-accent pl-3.5 py-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        {c.name}
                        <span className="ml-2 font-normal text-muted-foreground">{c.meta}</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">{c.why}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-foreground/80">{current.relance}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground italic">
        Aperçu illustratif — posez votre question pour lancer une vraie recherche.
      </p>
    </section>
  );
};

export default RechercheIAShowcase;
