import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Globe,
  Linkedin,
  Users,
  User,
  Rocket,
  Award,
  Lock,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExhibitorCompletion, ExhibitorTier } from '@/hooks/useExhibitorCompletion';

interface ChecklistItem {
  key: 'description' | 'logo' | 'website' | 'linkedin' | 'governance';
  label: string;
  points: number;
  icon: typeof FileText;
  done: boolean;
  /** Items à forte valeur manquants → mis en avant comme CTA principaux. */
  highValue: boolean;
}

const TIER_META: Record<ExhibitorTier, { label: string; className: string }> = {
  bronze: { label: 'Bronze', className: 'border-amber-700/30 bg-amber-700/10 text-amber-800' },
  argent: { label: 'Argent', className: 'border-slate-400/40 bg-slate-200/60 text-slate-700' },
  or: { label: 'Or', className: 'border-accent/40 bg-accent/10 text-accent' },
};

interface Props {
  exhibitorId: string;
  publicSlug: string | null;
  completion: ExhibitorCompletion | undefined;
  isLoading: boolean;
  isOwner: boolean;
  onGovernanceSolo: () => void;
  onGovernanceTeam: () => void;
  governanceSaving: boolean;
}

export default function ExhibitorCompletionCard({
  publicSlug,
  completion,
  isLoading,
  isOwner,
  onGovernanceSolo,
  onGovernanceTeam,
  governanceSaving,
}: Props) {
  const [open, setOpen] = useState(false);
  const [govChoiceOpen, setGovChoiceOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="border-t-[3px] border-t-accent rounded-md border bg-card p-3 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  if (!completion) return null;

  const score = completion.profile_score;
  const tier = completion.tier;
  const goalReached = score >= 100 && completion.has_upcoming_novelty;

  const editLink = publicSlug ? `/exposants/${publicSlug}?edit=1` : null;

  const items: ChecklistItem[] = [
    { key: 'description', label: 'Description (120 caractères min.)', points: 25, icon: FileText, done: completion.has_description, highValue: true },
    { key: 'logo', label: 'Logo', points: 20, icon: ImageIcon, done: completion.has_logo, highValue: false },
    { key: 'website', label: 'Site officiel', points: 15, icon: Globe, done: completion.has_website, highValue: false },
    { key: 'linkedin', label: 'Page LinkedIn', points: 15, icon: Linkedin, done: completion.has_linkedin, highValue: true },
    { key: 'governance', label: 'Gouvernance de la page', points: 25, icon: Users, done: completion.governance_confirmed, highValue: true },
  ];

  const missingHighValue = items.filter((i) => !i.done && i.highValue).length;
  const isTeamManaged = completion.governance_state === 'team' || completion.governance_confirmed;

  return (
    <div className="border-t-[3px] border-t-accent rounded-md border bg-card overflow-hidden">
      {/* Jauge + palier */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-primary">Profil complété</span>
            <span className="text-sm font-semibold tabular-nums">{score}/100</span>
            {tier && (
              <Badge variant="outline" className={`gap-1 ${TIER_META[tier].className}`}>
                <Award className="h-3 w-3" />
                {TIER_META[tier].label}
              </Badge>
            )}
            {completion.governance_state === 'team' && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                Équipe
              </Badge>
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        <Progress value={score} className="h-2" />
        {!open && missingHighValue > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {missingHighValue} action{missingHighValue > 1 ? 's' : ''} à fort impact pour activer votre fiche.
          </p>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t pt-3">
          {items.map((item) => {
            const Icon = item.icon;

            // Item complété → ligne discrète, cochée.
            if (item.done) {
              return (
                <div key={item.key} className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            }

            // Item gouvernance manquant → traitement spécial (solo / équipe).
            if (item.key === 'governance') {
              if (!isOwner) {
                return (
                  <div key={item.key} className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Gouvernance à confirmer par le propriétaire</span>
                  </div>
                );
              }
              return (
                <div key={item.key} className="rounded-md border border-accent/30 bg-accent/5 p-2.5">
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Confirmez la gouvernance de cette page</p>
                      <p className="text-xs text-muted-foreground">
                        Indiquez si vous gérez cette page seul(e) ou à plusieurs. Réversible à tout moment.
                      </p>
                      {!govChoiceOpen ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7"
                          onClick={() => setGovChoiceOpen(true)}
                        >
                          Configurer
                        </Button>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={onGovernanceSolo}
                            disabled={governanceSaving}
                          >
                            {governanceSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <User className="h-3.5 w-3.5 mr-1" />
                            )}
                            Je gère seul(e)
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onClick={onGovernanceTeam}
                            disabled={governanceSaving}
                          >
                            <Users className="h-3.5 w-3.5 mr-1" />
                            Inviter un collaborateur
                          </Button>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Vous pourrez inviter des collaborateurs à tout moment.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // Items éditoriaux manquants : LinkedIn/description mis en avant, logo/site standards.
            const highlight = item.highValue;
            return (
              <div
                key={item.key}
                className={
                  highlight
                    ? 'flex items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 p-2.5'
                    : 'flex items-center justify-between gap-2 py-1'
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${highlight ? 'text-accent' : 'text-muted-foreground'}`} />
                  <span className={`text-sm truncate ${highlight ? 'font-medium' : 'text-muted-foreground'}`}>
                    {item.label}
                  </span>
                </div>
                {editLink ? (
                  <Button asChild size="sm" variant={highlight ? 'default' : 'ghost'} className="h-7 flex-shrink-0">
                    <Link to={editLink}>Ajouter</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 flex-shrink-0" disabled>
                    Fiche en préparation
                  </Button>
                )}
              </div>
            );
          })}

          {/* Callout objectif Or */}
          {!goalReached && (
            <div className="rounded-md border border-accent/40 bg-accent/10 p-3 mt-2">
              <div className="flex items-start gap-2">
                <Rocket className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">Objectif Or</p>
                  <p className="text-xs text-muted-foreground">
                    Publiez une Nouveauté pour votre prochain salon → générez des leads avant l'événement.
                  </p>
                  {publicSlug ? (
                    <Button asChild size="sm" className="mt-2 h-7">
                      <Link to={`/exposants/${publicSlug}`}>Publier une Nouveauté</Link>
                    </Button>
                  ) : (
                    <Button size="sm" className="mt-2 h-7" disabled>
                      Fiche en préparation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
