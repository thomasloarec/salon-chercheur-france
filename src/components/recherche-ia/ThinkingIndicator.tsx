import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

const STEP_INTERVAL = 4500;   // durée d'affichage de chaque texte (ms)
const FLASH_DURATION = 550;   // durée de la coche verte en fin d'étape (ms)
const SHOW_STEP_CHECK = true; // false = spinner seul, sans coche (encore plus épuré)

const HOLDING_MESSAGES = [
  'Recoupement des résultats',
  'Vérification des dernières informations',
  'Finalisation de la réponse',
];

const HOLDING_MESSAGES_DEEP = [
  'Analyse approfondie des salons',
  'Croisement des exposants sur plusieurs salons',
  'Consolidation de la réponse',
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

// Déduit des étapes plausibles à partir de la question (illustratif, non synchronisé au back).
function buildSteps(question: string): string[] {
  const q = (question || '').toLowerCase();
  const has = (...w: string[]) => w.some((x) => q.includes(x));

  const isEntite = has('où expose', 'ou expose', 'retrouver', 'présent sur', 'present sur', 'stand de');
  const isExposer = has('exposer', 'je fais du', 'je vends', 'je propose', 'je suis exposant', 'mon stand', 'notre stand');
  const isSourcing = has('fournisseur', 'distributeur', 'sourcer', 'rencontrer', 'prestataire');
  const hasLieu = has('paris', 'lyon', 'marseille', 'bordeaux', 'lille', 'nantes', 'toulouse', 'strasbourg', 'cannes', 'nice', 'grenoble', 'près de', 'pres de');
  const hasDate = has('2026', '2027', 'à venir', 'a venir', 'prochain', 'cette année', 'automne', 'printemps', 'été', 'hiver', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre');

  const steps: string[] = ['Analyse de votre demande'];

  if (isEntite) {
    steps.push("Recherche de l'entreprise dans le référentiel");
    steps.push('Lecture de ses participations aux salons');
    if (hasDate) steps.push('Tri des éditions à venir et passées');
  } else if (isExposer) {
    steps.push("Identification de votre secteur d'activité");
    steps.push('Recherche des salons les plus ciblés');
    steps.push("Analyse de l'audience de chaque salon");
  } else if (isSourcing) {
    steps.push('Repérage des salons du secteur');
    steps.push('Scan des exposants et fournisseurs');
    steps.push('Sélection des profils pertinents');
  } else {
    steps.push('Lecture des 350 salons référencés');
    steps.push('Filtrage par thématique');
    steps.push('Scan des exposants pertinents');
  }

  if (hasLieu || hasDate) steps.push('Filtrage par lieu et par date');

  return steps;
}

interface ThinkingIndicatorProps {
  question: string;
  deepSearch?: boolean;
}

export default function ThinkingIndicator({ question, deepSearch = false }: ThinkingIndicatorProps) {
  const reducedMotion = usePrefersReducedMotion();
  const steps = useMemo(() => buildSteps(question), [question]);
  const holdingMessages = deepSearch ? HOLDING_MESSAGES_DEEP : HOLDING_MESSAGES;

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [holding, setHolding] = useState(false);
  const [holdIndex, setHoldIndex] = useState(0);

  // Réinitialise à chaque nouvelle question.
  useEffect(() => {
    setStepIndex(0);
    setCompleted(false);
    setHolding(false);
    setHoldIndex(0);
  }, [steps]);

  // Étapes contextuelles : une ligne à la fois, puis passage à la suivante.
  useEffect(() => {
    if (holding) return;

    const advance = () => {
      if (stepIndex >= steps.length - 1) {
        setHolding(true);
      } else {
        setStepIndex((i) => i + 1);
      }
    };

    if (SHOW_STEP_CHECK) {
      let flashTimer: ReturnType<typeof setTimeout>;
      const workTimer = setTimeout(() => {
        setCompleted(true); // brève coche verte en fin d'étape
        flashTimer = setTimeout(() => {
          setCompleted(false);
          advance();
        }, FLASH_DURATION);
      }, Math.max(0, STEP_INTERVAL - FLASH_DURATION));
      return () => {
        clearTimeout(workTimer);
        clearTimeout(flashTimer);
      };
    }

    const workTimer = setTimeout(advance, STEP_INTERVAL);
    return () => clearTimeout(workTimer);
  }, [stepIndex, holding, steps.length]);

  // Phase d'attente : messages qui défilent (spinner uniquement).
  useEffect(() => {
    if (!holding) return;
    const id = setInterval(() => setHoldIndex((h) => h + 1), STEP_INTERVAL);
    return () => clearInterval(id);
  }, [holding]);

  const text = holding ? holdingMessages[holdIndex % holdingMessages.length] : steps[stepIndex];
  const showCheck = !holding && completed;
  const lineKey = holding ? `h-${holdIndex}` : `s-${stepIndex}`;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {showCheck ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      )}
      <span key={lineKey} className={reducedMotion ? '' : 'animate-fade-in'}>
        {text}
      </span>
    </div>
  );
}