import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Compass,
  Users,
  Layers,
  Building2,
  Lock,
  Upload,
  Clock,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useMarketIntel } from '@/hooks/useMarketIntel';

interface Props {
  eventId: string;
  /** Renvoie l'organisateur vers l'onglet "Mes exposants" (import de liste). */
  onSwitchToExposants?: () => void;
  /** Renvoie l'organisateur vers l'onglet "Mon salon" (réglage exposants). */
  onSwitchToSalon?: () => void;
}

/**
 * Onglet "Mon marché" de l'espace organisateur.
 *
 * Règle non négociable : aucune entreprise n'est jamais nommée. La RPC
 * `get_market_intel` ne renvoie que des salons (information publique), des
 * segments et des comptages agrégés (seuil minimum de 5 entreprises).
 */
export const OrganizerMarketIntel: React.FC<Props> = ({
  eventId,
  onSwitchToExposants,
  onSwitchToSalon,
}) => {
  const { data, isLoading, error } = useMarketIntel(eventId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Impossible de charger votre analyse de marché pour le moment.
      </p>
    );
  }

  // ---------------------------------------------------------------- États dégradés
  if (data.statut === 'evenement_sans_exposants') {
    return (
      <EmptyState
        icon={Info}
        title="Réservé aux événements qui accueillent des exposants"
        body="Cette analyse compare votre plateau d'exposants à celui des salons du même marché. Votre événement est actuellement déclaré comme n'accueillant pas d'exposants, il n'y a donc rien à comparer."
        action={
          onSwitchToSalon && (
            <Button variant="outline" size="sm" onClick={onSwitchToSalon}>
              Modifier ce réglage dans « Mon salon »
            </Button>
          )
        }
      />
    );
  }

  if (data.statut === 'salon_introuvable') {
    return (
      <p className="text-sm text-muted-foreground">Ce salon est introuvable.</p>
    );
  }

  if (data.statut === 'aucun_exposant_reference') {
    return (
      <EmptyState
        icon={Upload}
        title="Nous n'avons encore aucun exposant pour cette édition"
        body="L'analyse se construit à partir de votre plateau d'exposants. Dès que votre liste nous parvient, vous verrez ici les salons qui partagent votre vivier, la couverture sectorielle de votre plateau et vos angles morts."
        action={
          data.liste?.en_attente ? (
            <Badge variant="secondary" className="gap-1.5">
              <Clock className="h-3 w-3" />
              Votre liste est en cours d'intégration
            </Badge>
          ) : (
            onSwitchToExposants && (
              <Button variant="outline" size="sm" onClick={onSwitchToExposants}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Transmettre ma liste d'exposants
              </Button>
            )
          )
        }
      />
    );
  }

  if (data.statut === 'analyse_en_preparation') {
    return (
      <EmptyState
        icon={Clock}
        title="Votre analyse est en cours de préparation"
        body={`Nous avons ${data.synthese?.nb_exposants ?? 0} exposant${
          (data.synthese?.nb_exposants ?? 0) > 1 ? 's' : ''
        } pour cette édition. Leur qualification se termine cette nuit : votre analyse sera disponible demain.`}
      />
    );
  }

  // ---------------------------------------------------------------- Rapport
  const s = data.synthese;
  const partielle = Boolean(data.analyse_partielle);
  const comparables = data.comparables ?? [];
  const autresEditions = data.autres_editions ?? [];
  const pointsForts = data.points_forts ?? [];
  const anglesMorts = data.angles_morts ?? [];
  const masques = data.angles_morts_masques ?? 0;

  return (
    <div className="space-y-4">
      {/* Donnant-donnant : rendre le manque visible et désirable */}
      {partielle && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Votre analyse est partielle
              </p>
              <p className="text-sm text-muted-foreground">
                Elle est calculée sur les exposants que nous avons pu recenser publiquement.
                En nous transmettant votre liste officielle, vous débloquez l'analyse complète
                {masques > 0 && (
                  <>
                    {' '}
                    — dont{' '}
                    <span className="font-medium text-foreground">
                      {masques} angle{masques > 1 ? 's' : ''} mort{masques > 1 ? 's' : ''}
                    </span>{' '}
                    actuellement masqué{masques > 1 ? 's' : ''}
                  </>
                )}
                , ainsi que le suivi de rétention d'une édition à l'autre.
              </p>
              {data.liste?.en_attente ? (
                <Badge variant="secondary" className="gap-1.5">
                  <Clock className="h-3 w-3" />
                  Votre liste est en cours d'intégration
                </Badge>
              ) : (
                onSwitchToExposants && (
                  <Button variant="outline" size="sm" onClick={onSwitchToExposants}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Transmettre ma liste d'exposants
                  </Button>
                )
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Synthèse */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">Votre salon en chiffres</h3>
          {s?.secteur_dominant && (
            <Badge variant="secondary">{s.secteur_dominant}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Exposants référencés"
            value={s?.nb_exposants ?? 0}
          />
          <Metric
            icon={<Layers className="h-4 w-4" />}
            label="Segments représentés"
            value={s?.nb_segments ?? 0}
          />
          <Metric
            icon={<Building2 className="h-4 w-4" />}
            label="Salons comparables"
            value={s?.nb_comparables ?? 0}
          />
          <Metric
            icon={<Compass className="h-4 w-4" />}
            label="Entreprises de votre marché absentes de votre salon"
            value={s?.vivier_absent ?? null}
          />
        </div>
        {typeof s?.vivier_absent === 'number' && (s?.nb_exposants ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            Soit environ{' '}
            <span className="font-medium text-foreground">
              {(s.vivier_absent / s.nb_exposants).toFixed(1)}
            </span>{' '}
            entreprise{s.vivier_absent / s.nb_exposants >= 2 ? 's' : ''} de votre marché qui
            exposent ailleurs pour chaque exposant présent chez vous.
          </p>
        )}
      </Card>

      {/* Positionnement dans l'écosystème */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Votre position dans l'écosystème</h3>
        {comparables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nous n'avons pas encore identifié de salon comparable au vôtre.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Salons dont le plateau ressemble au vôtre, classés par proximité.
            </p>
            <ul className="divide-y rounded-md border">
              {comparables.map((c, i) => (
                <li key={`${c.slug ?? c.nom}-${i}`} className="flex items-center justify-between gap-3 p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.ville, c.date_debut ? new Date(c.date_debut).toLocaleDateString('fr-FR') : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.exposants_partages > 0 && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {c.exposants_partages} exposant{c.exposants_partages > 1 ? 's' : ''} en commun
                      </span>
                    )}
                    {c.proximite && (
                      <Badge
                        variant={c.proximite === 'très forte' ? 'default' : 'secondary'}
                        className="whitespace-nowrap"
                      >
                        {c.proximite}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {autresEditions.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs font-medium text-foreground/80">Vos autres éditions</p>
            <ul className="space-y-1">
              {autresEditions.map((c, i) => (
                <li
                  key={`${c.slug ?? c.nom}-ed-${i}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate text-foreground">{c.nom}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {c.exposants_partages} exposant{c.exposants_partages > 1 ? 's' : ''} en commun
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Couverture sectorielle */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">La couverture de votre plateau</h3>
        {pointsForts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pas encore assez de données pour décrire la composition de votre plateau.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Les segments les mieux représentés chez vous, ceux qui font votre identité.
            </p>
            <div className="space-y-2.5">
              {pointsForts.map((p, i) => (
                <SegmentBar
                  key={`${p.segment}-${i}`}
                  label={p.segment}
                  secteur={p.secteur}
                  pct={p.pct ?? 0}
                  suffix={`${p.nb ?? 0} exposant${(p.nb ?? 0) > 1 ? 's' : ''}`}
                />
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Angles morts */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Vos angles morts</h3>
        {anglesMorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun angle mort significatif : votre plateau couvre bien les segments présents chez
            les salons comparables.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Segments bien représentés chez les salons comparables, mais clairsemés chez vous.
            </p>
            <ul className="space-y-3">
              {anglesMorts.map((a, i) => (
                <li key={`${a.segment}-${i}`} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{a.segment}</p>
                      <p className="text-xs text-muted-foreground">{a.secteur}</p>
                    </div>
                    {typeof a.entreprises_absentes === 'number' && (
                      <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
                        {a.entreprises_absentes} entreprises
                      </Badge>
                    )}
                  </div>
                  <ComparisonBars
                    pctSalon={a.pct_salon ?? 0}
                    pctComparables={a.pct_comparables ?? 0}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {masques > 0 && (
          <div className="rounded-md border border-dashed p-3 flex items-start gap-2.5">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                {masques} autre{masques > 1 ? 's' : ''} angle{masques > 1 ? 's' : ''} mort
                {masques > 1 ? 's' : ''} identifié{masques > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Ils apparaîtront dès que vous nous aurez transmis votre liste officielle
                d'exposants.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Rétention */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Votre rétention d'une édition à l'autre</h3>
          {!data.retention?.disponible && (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              À débloquer
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Combien de vos exposants reviennent d'une édition à la suivante, et parmi ceux qui ne
          reviennent pas, lesquels exposent désormais ailleurs. Cette lecture demande une donnée
          que vous seul détenez : la liste de votre édition précédente.
        </p>
      </Card>

      {/* Méthodologie et engagements */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Méthode et engagements</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Lotexpo indexe les listes d'exposants publiées publiquement par les salons, puis qualifie
          l'activité de chaque entreprise par IA à partir de son site. Les salons comparables sont
          calculés automatiquement à partir de la composition des plateaux.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">Ce que nous faisons</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Comparer votre plateau à celui des salons de votre marché</li>
              <li>Mesurer la couverture par segment d'activité</li>
              <li>Signaler les segments où votre plateau est clairsemé</li>
            </ul>
          </div>
          <div className="rounded-md border p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">Ce que nous ne faisons jamais</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Vous livrer une liste d'entreprises à démarcher</li>
              <li>Nommer les exposants d'un autre salon</li>
              <li>Transmettre à un tiers la liste que vous nous confiez</li>
            </ul>
          </div>
        </div>
        {data.genere_le && (
          <p className="text-[11px] text-muted-foreground">
            Analyse recalculée chaque nuit · dernier calcul le{' '}
            {new Date(data.genere_le).toLocaleString('fr-FR')}
            {data.synthese?.confiance && ` · fiabilité ${data.synthese.confiance}`}
          </p>
        )}
      </Card>
    </div>
  );
};

// ------------------------------------------------------------------ Sous-composants

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | null;
}> = ({ icon, label, value }) => (
  <div className="rounded-md border p-2.5">
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
      {icon}
      <span className="line-clamp-2">{label}</span>
    </div>
    <div className="mt-1">
      <span className="text-lg font-semibold">
        {value === null || value === undefined ? '—' : value}
      </span>
    </div>
  </div>
);

const SegmentBar: React.FC<{
  label: string;
  secteur: string;
  pct: number;
  suffix?: string;
}> = ({ label, secteur, pct, suffix }) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-foreground truncate">{label}</span>
      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
        {pct}%{suffix ? ` · ${suffix}` : ''}
      </span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
    <p className="text-[11px] text-muted-foreground">{secteur}</p>
  </div>
);

const ComparisonBars: React.FC<{ pctSalon: number; pctComparables: number }> = ({
  pctSalon,
  pctComparables,
}) => {
  const max = Math.max(pctSalon, pctComparables, 1);
  const row = (label: string, pct: number, tone: string) => (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.max(2, (pct / max) * 100)}%` }}
        />
      </div>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {row('Votre salon', pctSalon, 'bg-primary')}
      {row('Salons comparables', pctComparables, 'bg-muted-foreground/50')}
    </div>
  );
};

const EmptyState: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, body, action }) => (
  <Card className="p-6">
    <div className="flex flex-col items-start gap-3 max-w-xl">
      <div className="rounded-md bg-muted p-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  </Card>
);

export default OrganizerMarketIntel;
