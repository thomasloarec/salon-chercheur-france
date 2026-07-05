import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import PreviewRelBadge from './PreviewRelBadge';
import { RELATIONSHIP_META } from '@/lib/radarCrm/relationship';

/**
 * Miroir présentationnel de RadarMissionSheet (corps de la mission) — garder synchronisé.
 * Rendu statique, données de démo, mêmes classes/tokens que le vrai composant :
 *  - Label « font-semibold », pastilles TOP 3 « bg-primary/10 text-primary »,
 *  - zones de texte reproduisant le <Textarea> shadcn (border-input / bg-background),
 *  - badge relation via PreviewRelBadge (couleurs RELATIONSHIP_META).
 * Le vrai composant étant un Sheet piloté par auth + RPC, il ne peut pas être posé
 * tel quel sur une page publique : ce miroir en copie le rendu exact.
 */

// Zone de texte en lecture seule mimant le <Textarea> shadcn du vrai composant.
const ReadonlyField: React.FC<{ children: React.ReactNode; big?: boolean; className?: string }> = ({
  children, big, className,
}) => (
  <div
    className={cn(
      'rounded-md border border-input bg-background px-3 py-2 text-foreground',
      big ? 'text-lg leading-relaxed' : 'text-base',
      className,
    )}
  >
    {children}
  </div>
);

const TOP3 = [
  'Le projet de bornes de recharge dont on avait parlé, il en est où aujourd’hui ?',
  'Qui pilote ce sujet chez vous en ce moment ?',
  'Quels autres projets sont en train de démarrer de votre côté ?',
];

const MissionCardPreview: React.FC<{ big?: boolean; className?: string }> = ({ big = false, className }) => (
  <Card className={cn('shadow-xl border-primary/10', className)}>
    <CardContent className="pt-6 space-y-4">
      {/* Contexte + entreprise */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mission · SEPEM Brest
          </p>
          <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mt-0.5 truncate">
            Legrand
          </h3>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">Dans 9 j</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PreviewRelBadge status="prospect_froid" label={RELATIONSHIP_META.prospect_froid.label} />
        <span className="shrink-0 text-xs font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">
          Stand E35
        </span>
      </div>

      {/* Objectif */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Objectif de la visite</Label>
        <ReadonlyField big={big} className="font-medium">
          Savoir si le projet de bornes de recharge est encore actif ou abandonné — et, sinon, identifier un nouveau projet à adresser.
        </ReadonlyField>
      </div>

      {/* Phrase d'ouverture */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Phrase d’ouverture</Label>
        <ReadonlyField big={big}>
          « On avait déjà échangé sur vos bornes de recharge. Je suis d’assez près ce que vous développez, et j’étais curieux de savoir où ça en est aujourd’hui. »
        </ReadonlyField>
      </div>

      {/* TOP 3 */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">TOP 3 — questions à poser</Label>
        {TOP3.map((t, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span
              className={cn(
                'mt-2.5 shrink-0 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center',
                big ? 'h-7 w-7 text-sm' : 'h-6 w-6 text-xs',
              )}
            >
              {i + 1}
            </span>
            <div className="flex-1">
              <ReadonlyField big={big}>{t}</ReadonlyField>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground pt-1">Généré pour vous · ajusté à votre offre</p>
    </CardContent>
  </Card>
);

export default MissionCardPreview;
