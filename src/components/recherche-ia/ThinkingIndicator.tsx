import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

// Cadence d'apparition des étapes (ms). Baisser vers 3000 pour plus d'étapes visibles
// sur des recherches courtes, monter vers 5000 pour un rythme plus posé.
const STEP_INTERVAL = 4500;

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
  const lastIndex = steps.length - 1;

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'steps' | 'holding'>('steps');
  const [hold, setHold] = useState(0);

  // Avance d'une étape toutes les STEP_INTERVAL, puis bascule en phase d'attente.
  useEffect(() => {
    setStep(0);
    setPhase('steps');
    setHold(0);
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= lastIndex) {
          setPhase('holding');
          return s;
        }
        return s + 1;
      });
    }, STEP_INTERVAL);
    return () => clearInterval(id);
  }, [steps, lastIndex]);

  // En phase d'attente, fait défiler un message pour garder du mouvement.
  useEffect(() => {
    if (phase !== 'holding') return;
    const id = setInterval(() => setHold((h) => h + 1), STEP_INTERVAL);
    return () => clearInterval(id);
  }, [phase]);

  const revealClass = reducedMotion ? '' : 'animate-fade-in';
  const holdingMessages = deepSearch ? HOLDING_MESSAGES_DEEP : HOLDING_MESSAGES;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-background/80 backdrop-blur border border-border px-4 py-3 shadow-sm space-y-2">
        {steps.map((label, i) => {
          const visible = phase === 'holding' || i <= step;
          if (!visible) return null;
          const done = phase === 'holding' || i < step;
          return (
            <div key={label} className={`flex items-center gap-2 text-sm ${done ? 'text-muted-foreground' : 'text-foreground'} ${revealClass}`}>
              {done ? (
                <Check className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              )}
              <span>{label}</span>
            </div>
          );
        })}

        {phase === 'holding' && (
          <div className={`flex items-center gap-2 text-sm text-foreground ${revealClass}`}>
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span>{holdingMessages[hold % holdingMessages.length]}</span>
          </div>
        )}
      </div>
    </div>
  );
}