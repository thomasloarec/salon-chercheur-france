import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Mic, Plus, Check, Star, MapPin, Calendar, UserPlus, RotateCcw, ArrowRight } from 'lucide-react';

type Step = {
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: 'Vos comptes, triés par stand',
    body: "Radar liste les entreprises de votre CRM présentes sur le salon, dans l'ordre des stands. Les comptes prioritaires portent une étoile, leur statut relationnel est rappelé d'un point coloré. Vous savez qui aller voir.",
  },
  {
    title: 'Dictez une note, sans écrire',
    body: "Devant le stand, un appui sur Dicter et vous parlez. Radar transcrit et range la note sur le bon compte. Sur un salon, c'est plus rapide que de taper. Le champ Écrire reste là si vous préférez.",
  },
  {
    title: 'Marquez le stand comme vu',
    body: "Un appui sur Visité, le compte bascule en bas de liste, la barre de progression avance. Vous gardez le fil sans chercher où vous en étiez.",
  },
  {
    title: 'Un prospect hors CRM ? Ajoutez-le',
    body: "Vous croisez un exposant absent de votre CRM ? Ajoutez-le d'un nom, notez dans la foulée. Il reste privé à votre espace et se retrouve dans le débrief.",
  },
];

/** Aperçu mobile factice du Mode Salon. Aucune donnée réelle, aucun appel réseau. */
const DemoPreview: React.FC<{ step: number }> = ({ step }) => {
  const visited = step >= 2;
  const seen = visited ? 13 : 12;
  const toSee = visited ? 8 : 9;
  const rate = seen / (seen + toSee);

  return (
    <div className="mx-auto w-full max-w-[320px] rounded-[1.75rem] border-8 border-foreground/10 bg-card shadow-lg overflow-hidden">
      {/* Barre supérieure */}
      <div className="border-b bg-card px-3 py-2.5">
        <p className="font-display text-sm font-semibold text-foreground leading-tight truncate">Food Hotel Tech</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" /> 14 – 15 novembre
        </p>
      </div>

      <div className="px-3 py-3 space-y-3 bg-muted/10">
        {/* Progression */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground">
            <Check className="h-3.5 w-3.5 text-info" />
            <span>{seen} vus</span>
            <span className="text-muted-foreground font-normal">·</span>
            <span>{toSee} à voir</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${rate * 100}%` }}
            />
          </div>
        </div>

        {/* Carte entreprise */}
        <Card
          className={cn(
            'p-3 space-y-2.5 transition-all duration-500',
            visited && 'opacity-60',
            step === 0 && 'ring-2 ring-primary/40',
          )}
        >
          <div className="flex items-start gap-2">
            <Star className="h-4 w-4 shrink-0 fill-primary text-primary mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold text-foreground truncate', visited && 'line-through')}>
                Student Pop
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Stand B14
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full bg-info" /> Client actif
              </p>
            </div>
          </div>

          {/* Rangée d'actions — la dictée est primaire, comme dans l'outil réel */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              className={cn(
                'flex-[1.25] inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground',
                'text-xs font-medium h-9 px-2 transition-all duration-500',
                step === 1 && 'ring-2 ring-primary ring-offset-2 scale-[1.03]',
              )}
            >
              <Mic className="h-3.5 w-3.5" /> Dicter
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background text-xs font-medium h-9 px-2"
            >
              <Plus className="h-3.5 w-3.5" /> Écrire
            </button>
            <button
              type="button"
              tabIndex={-1}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background text-xs font-medium h-9 px-2 transition-all duration-500',
                step === 2 && 'ring-2 ring-primary ring-offset-2',
                visited && 'bg-primary/10 border-primary/40',
              )}
            >
              <Check className="h-3.5 w-3.5" /> Visité
            </button>
          </div>
        </Card>

        {/* Ajout hors CRM */}
        <button
          type="button"
          tabIndex={-1}
          className={cn(
            'w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-input bg-background text-xs font-medium h-9 transition-all duration-500',
            step === 3 && 'ring-2 ring-primary ring-offset-2 border-primary text-primary',
          )}
        >
          <UserPlus className="h-3.5 w-3.5" /> Ajouter une rencontre
        </button>
      </div>
    </div>
  );
};

const RadarModeSalonDemo: React.FC = () => {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  return (
    <section id="mode-salon-demo" className="scroll-mt-20">
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mb-1">
        Comment ça marche sur un salon
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Une démonstration, sans données réelles, du geste à faire devant un stand.
      </p>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <DemoPreview step={step} />

        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-500',
                  i <= step ? 'bg-primary' : 'bg-secondary',
                )}
              />
            ))}
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Étape {step + 1} sur {STEPS.length}
          </p>
          <h3 className="font-display text-lg font-semibold text-foreground">{STEPS[step].title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{STEPS[step].body}</p>

          <div className="flex flex-wrap gap-2 pt-1">
            {isLast ? (
              <Button variant="outline" onClick={() => setStep(0)} className="gap-2 min-h-[44px]">
                <RotateCcw className="h-4 w-4" /> Recommencer
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} className="gap-2 min-h-[44px]">
                Étape suivante <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RadarModeSalonDemo;
