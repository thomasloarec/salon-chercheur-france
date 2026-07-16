import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface ResolveCandidateMatch {
  match_found: boolean;
  match_type: 'domain' | 'normalized_name' | 'legacy' | null;
  confidence: 'high' | 'medium' | 'low' | null;
  exhibitor_id: string | null;
  exhibitor_name: string | null;
  website: string | null;
  logo_url: string | null;
  approved: boolean;
  already_participating_to_event: boolean;
  has_admin: boolean;
  current_user_can_create_novelty: boolean;
  current_user_is_admin?: boolean;
  block_reason: string | null;
  legacy_id_exposant?: string | null;
  message?: string;
}

interface Props {
  match: ResolveCandidateMatch;
  onUse: (m: ResolveCandidateMatch) => void;
}

export default function ExistingCompanyCard({ match, onUse }: Props) {
  const blocked = match.has_admin && !match.current_user_can_create_novelty;
  const isLegacy = match.match_type === 'legacy';

  return (
    <Card className={blocked ? 'border-destructive/50 bg-destructive/5' : 'border-primary bg-primary/5'}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {match.logo_url ? (
            <img src={match.logo_url} alt="" className="h-12 w-12 rounded object-contain bg-white" />
          ) : (
            <div className="p-2 bg-muted rounded-lg">
              {blocked ? <Lock className="h-5 w-5 text-destructive" /> : <Building className="h-5 w-5 text-foreground" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold">Entreprise déjà présente sur Lotexpo</h4>
              {match.approved && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Vérifiée
                </Badge>
              )}
              {isLegacy && (
                <Badge variant="secondary">Ancienne base</Badge>
              )}
            </div>
            <p className="text-sm mt-1">
              <span className="font-medium">{match.exhibitor_name}</span>
              {match.website && <span className="text-muted-foreground"> — {match.website}</span>}
            </p>
            {match.already_participating_to_event ? (
              <p className="text-xs text-muted-foreground mt-1">Déjà participante à cet événement.</p>
            ) : !isLegacy ? (
              <p className="text-xs text-muted-foreground mt-1">Sera rattachée à cet événement.</p>
            ) : null}
            {isLegacy && match.message && (
              <p className="text-xs text-muted-foreground mt-1">{match.message}</p>
            )}
          </div>
        </div>

        {blocked ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{match.block_reason || 'Vous ne pouvez pas publier de nouveauté pour cette entreprise car elle est déjà administrée.'}</p>
            </div>
            <Button variant="outline" size="sm" disabled className="w-full">
              Vous ne pouvez pas publier pour cette entreprise
            </Button>
            <a
              href="mailto:contact@lotexpo.com?subject=Demande%20d'acc%C3%A8s%20%C3%A0%20une%20fiche%20entreprise"
              className="block text-center text-xs text-muted-foreground hover:underline"
            >
              Contacter Lotexpo pour demander l'accès
            </a>
          </div>
        ) : (
          <Button onClick={() => onUse(match)} className="w-full">
            Utiliser cette entreprise
          </Button>
        )}
      </CardContent>
    </Card>
  );
}