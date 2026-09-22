import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Users,
  Layers,
  Building2,
  Lock,
  Upload,
  Clock,
  Info,
  ShieldCheck,
  Printer,
  ArrowUpRight,
} from 'lucide-react';
import { useMarketIntel, type MarketIntelComparable } from '@/hooks/useMarketIntel';

interface Props {
  eventId: string;
  eventName?: string;
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
 *
 * Mise en forme : une seule figure héros, puis des marques fines en une seule
 * teinte (violet de marque) contre le gris de désaccentuation. Le bloc entier
 * est imprimable en PDF brandé via `window.print()` (voir PRINT_CSS).
 */
export const OrganizerMarketIntel: React.FC<Props> = ({
  eventId,
  eventName,
  onSwitchToExposants,
  onSwitchToSalon,
}) => {
  const { data, isLoading, error } = useMarketIntel(eventId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
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
    return <p className="text-sm text-muted-foreground">Ce salon est introuvable.</p>;
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
    const n = data.synthese?.nb_exposants ?? 0;
    return (
      <EmptyState
        icon={Clock}
        title="Votre analyse est en cours de préparation"
        body={`Nous avons ${n} exposant${n > 1 ? 's' : ''} pour cette édition. Leur qualification se termine cette nuit : votre analyse sera disponible demain.`}
      />
    );
  }

  // ---------------------------------------------------------------- Rapport
  const s = data.synthese;
  const partielle = Boolean(data.analyse_partielle);
  const nbExposants = s?.nb_exposants ?? 0;
  const vivier = typeof s?.vivier_absent === 'number' ? s.vivier_absent : null;
  const ratio = vivier !== null && nbExposants > 0 ? vivier / nbExposants : null;

  // Barres triées par leur propre mesure : le graphique doit descendre.
  const comparables = [...(data.comparables ?? [])].sort(
    (a, b) => b.exposants_partages - a.exposants_partages,
  );
  const autresEditions = data.autres_editions ?? [];
  const pointsForts = data.points_forts ?? [];
  const anglesMorts = data.angles_morts ?? [];
  const masques = data.angles_morts_masques ?? 0;

  const maxPartages = Math.max(1, ...comparables.map((c) => c.exposants_partages));
  const maxPart = Math.max(
    1,
    ...anglesMorts.map((a) => Math.max(a.pct_salon ?? 0, a.pct_comparables ?? 0)),
  );

  const dateFr = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div id="market-intel-print" className="space-y-10">
        {/* Bandeau de marque : visible uniquement à l'impression */}
        <div className="mi-print-only mi-brand-head">
          <div className="mi-brand-wordmark">Lotexpo</div>
          <div className="mi-brand-title">{eventName || 'Votre salon'} — analyse de marché</div>
          <div className="mi-brand-meta">
            L'intelligence des salons professionnels français · lotexpo.com
            {data.genere_le && ` · données au ${dateFr(data.genere_le)}`}
          </div>
        </div>

        {/* ---------------------------------------------------------- HÉROS */}
        <section className="mi-block">
          <div className="rounded-lg bg-surface-inverse text-inverse p-6 md:p-8 mi-avoid-break">
            {ratio !== null ? (
              <>
                <p className="heading-display text-inverse text-5xl md:text-6xl leading-none">
                  {ratio.toFixed(1).replace('.', ',')}
                </p>
                <p className="mt-3 text-sm md:text-base text-inverse max-w-xl">
                  entreprise{ratio >= 2 ? 's' : ''} de votre marché expose{ratio >= 2 ? 'nt' : ''}{' '}
                  ailleurs pour chaque exposant présent chez vous.
                </p>
                <p className="mt-1.5 text-xs text-inverse-muted max-w-xl">
                  Soit {vivier} entreprises recensées sur les salons comparables au vôtre, et absentes
                  de votre édition.
                </p>
              </>
            ) : (
              <>
                <p className="heading-display text-inverse text-5xl md:text-6xl leading-none">
                  {nbExposants}
                </p>
                <p className="mt-3 text-sm md:text-base text-inverse max-w-xl">
                  exposant{nbExposants > 1 ? 's' : ''} référencé{nbExposants > 1 ? 's' : ''} sur votre
                  édition.
                </p>
              </>
            )}

            <div className="mt-6 pt-5 border-t border-inverse-muted/25 grid grid-cols-3 gap-4">
              <HeroStat icon={Users} label="Exposants référencés" value={nbExposants} />
              <HeroStat icon={Building2} label="Salons comparables" value={s?.nb_comparables ?? 0} />
              <HeroStat icon={Layers} label="Segments couverts" value={s?.nb_segments ?? 0} />
            </div>
          </div>

          {/* Donnant-donnant */}
          {partielle && (
            <Card className="mt-3 p-4 border-primary/30 bg-primary/5 mi-avoid-break">
              <div className="flex items-start gap-3">
                <Lock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Votre analyse est partielle</p>
                  <p className="text-sm text-muted-foreground">
                    Elle est calculée sur les exposants que nous avons pu recenser publiquement. En
                    nous transmettant votre liste officielle, vous débloquez l'analyse complète
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
                  <div className="mi-no-print">
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
              </div>
            </Card>
          )}
        </section>

        {/* -------------------------------------------- POSITION ÉCOSYSTÈME */}
        <section className="mi-block">
          <SectionHead
            title="Les salons qui partagent votre vivier"
            sub="Nombre d'exposants que vous avez en commun avec chaque salon comparable."
          />

          {comparables.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nous n'avons pas encore identifié de salon comparable au vôtre.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {comparables.map((c, i) => (
                <li key={`${c.slug ?? c.nom}-${i}`} className="mi-avoid-break">
                  <div className="flex items-baseline justify-between gap-3">
                    <SalonLink salon={c} emphasized={i === 0} />
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {c.exposants_partages}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-r-full bg-primary"
                      style={{
                        width: `${Math.max(2, (c.exposants_partages / maxPartages) * 100)}%`,
                      }}
                      title={`${c.exposants_partages} exposant(s) en commun`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {[dateFr(c.date_debut), c.ville].filter(Boolean).join(' · ')}
                    {i === 0 && c.exposants_partages > 0 && (
                      <span className="text-foreground"> · votre comparable le plus direct</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {autresEditions.length > 0 && (
            <div className="mt-5 pt-4 border-t mi-avoid-break">
              <p className="text-xs font-medium text-foreground/80 mb-2">Vos autres éditions</p>
              <ul className="space-y-1.5">
                {autresEditions.map((c, i) => (
                  <li
                    key={`${c.slug ?? c.nom}-ed-${i}`}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <SalonLink salon={c} small />
                    <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {c.exposants_partages} en commun
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------ COUVERTURE */}
        <section className="mi-block">
          <SectionHead
            title="Ce que votre plateau couvre le mieux"
            sub={
              s?.secteur_dominant
                ? `Secteur dominant : ${s.secteur_dominant}. Part de vos exposants par segment.`
                : 'Part de vos exposants par segment.'
            }
          />

          {pointsForts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pas encore assez de données pour décrire la composition de votre plateau.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {pointsForts.map((p, i) => (
                <li key={`${p.segment}-${i}`} className="mi-avoid-break">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-foreground">{p.segment}</span>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {p.pct ?? 0} %
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-r-full bg-primary"
                      style={{ width: `${Math.max(2, Math.min(100, p.pct ?? 0))}%` }}
                      title={`${p.nb ?? 0} exposant(s)`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.secteur} · {p.nb ?? 0} exposant{(p.nb ?? 0) > 1 ? 's' : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------------- ANGLES MORTS */}
        <section className="mi-block">
          <SectionHead
            title="Vos angles morts"
            sub="Segments bien représentés chez les salons comparables, clairsemés chez vous. L'écart est la distance entre les deux points."
          />

          {anglesMorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun angle mort significatif : votre plateau couvre bien les segments présents chez les
              salons comparables.
            </p>
          ) : (
            <>
              {/* Légende : deux séries, donc légende obligatoire */}
              <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Votre salon
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Salons comparables
                </span>
              </div>

              <ul className="space-y-5">
                {anglesMorts.map((a, i) => (
                  <li key={`${a.segment}-${i}`} className="mi-avoid-break">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-foreground">{a.segment}</span>
                      {typeof a.entreprises_absentes === 'number' && (
                        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap tabular-nums">
                          {a.entreprises_absentes} entreprises
                        </span>
                      )}
                    </div>
                    <Dumbbell
                      pctSalon={a.pct_salon ?? 0}
                      pctComparables={a.pct_comparables ?? 0}
                      max={maxPart}
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {a.secteur} · {String(a.pct_salon ?? 0).replace('.', ',')} % chez vous contre{' '}
                      {String(a.pct_comparables ?? 0).replace('.', ',')} % chez les comparables
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {masques > 0 && (
            <div className="mt-5 rounded-md border border-dashed p-3 flex items-start gap-2.5 mi-avoid-break">
              <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm text-foreground">
                  {masques} autre{masques > 1 ? 's' : ''} angle{masques > 1 ? 's' : ''} mort
                  {masques > 1 ? 's' : ''} identifié{masques > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ils apparaîtront dès que vous nous aurez transmis votre liste officielle d'exposants.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- RÉTENTION */}
        <section className="mi-block mi-avoid-break">
          <div className="rounded-lg border border-dashed p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Votre rétention d'une édition à l'autre
              </h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Combien de vos exposants reviennent d'une édition à la suivante, et parmi ceux qui ne
              reviennent pas, lesquels exposent désormais ailleurs. Cette lecture demande une donnée
              que vous seul détenez : la liste de votre édition précédente.
            </p>
          </div>
        </section>

        {/* -------------------------------------------- MÉTHODE & ENGAGEMENTS */}
        <section className="mi-block mi-avoid-break">
          <SectionHead title="Méthode et engagements" />
          <p className="text-xs text-muted-foreground mb-4 max-w-2xl">
            Lotexpo indexe les listes d'exposants publiées publiquement par les salons, puis qualifie
            l'activité de chaque entreprise par IA à partir de son site. Les salons comparables sont
            calculés automatiquement à partir de la composition des plateaux.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-md border p-3 space-y-1.5">
              <p className="text-xs font-medium text-foreground inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                Ce que nous faisons
              </p>
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
            <p className="mt-4 text-[11px] text-muted-foreground">
              Analyse recalculée chaque nuit · dernier calcul le{' '}
              {new Date(data.genere_le).toLocaleString('fr-FR')}
              {s?.confiance && ` · fiabilité ${s.confiance}`}
            </p>
          )}
        </section>

        {/* Pied de page : impression uniquement */}
        <div className="mi-print-only mi-brand-foot">
          Lotexpo — lotexpo.com · Document produit pour l'organisateur de {eventName || 'ce salon'}.
          Aucune entreprise n'est nommée dans cette analyse.
        </div>
      </div>

      {/* Export PDF : passe par l'impression navigateur, aucun service tiers */}
      <div className="mt-8 flex items-center gap-3 mi-no-print">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Exporter en PDF
        </Button>
        <p className="text-xs text-muted-foreground">
          Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF ».
        </p>
      </div>
    </>
  );
};

// ------------------------------------------------------------------ Sous-composants

const SectionHead: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div className="mb-4 mi-head">
    {/* Filet de section repris de la signature Lotexpo, mais peint en --primary :
        la classe .section-rule utilise --accent, qui est une surface de survol
        quasi invisible depuis la refonte des rôles. */}
    <div className="h-[3px] w-10 rounded-full bg-primary mb-3" />
    <h3 className="heading-display text-lg text-foreground">{title}</h3>
    {sub && <p className="mt-1 text-xs text-muted-foreground max-w-2xl">{sub}</p>}
  </div>
);

const HeroStat: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}> = ({ icon: Icon, label, value }) => (
  <div>
    <div className="flex items-center gap-1.5 text-inverse-muted text-[11px]">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="line-clamp-2">{label}</span>
    </div>
    <p className="mt-1 text-xl font-semibold text-inverse">{value}</p>
  </div>
);

const SalonLink: React.FC<{
  salon: MarketIntelComparable;
  emphasized?: boolean;
  small?: boolean;
}> = ({ salon, emphasized, small }) => {
  const cls = [
    small ? 'text-xs' : 'text-sm',
    emphasized ? 'font-medium' : '',
    'text-foreground truncate min-w-0',
  ]
    .filter(Boolean)
    .join(' ');

  if (!salon.slug) return <span className={cls}>{salon.nom}</span>;

  return (
    <Link
      to={`/events/${salon.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} inline-flex items-baseline gap-1 hover:text-primary hover:underline underline-offset-2 transition-colors`}
      title={`Ouvrir la page ${salon.nom} sur Lotexpo`}
    >
      <span className="truncate">{salon.nom}</span>
      <ArrowUpRight className="h-3 w-3 shrink-0 self-center mi-no-print" />
    </Link>
  );
};

/**
 * Haltère : deux points sur un même axe, reliés par le segment de l'écart.
 * Une seule teinte plus le gris de désaccentuation — la distance porte le sens.
 */
const Dumbbell: React.FC<{ pctSalon: number; pctComparables: number; max: number }> = ({
  pctSalon,
  pctComparables,
  max,
}) => {
  const pos = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  const a = pos(pctSalon);
  const b = pos(pctComparables);
  const left = Math.min(a, b);
  const width = Math.abs(b - a);

  return (
    <div className="mt-2 h-3.5 px-[7px]" aria-hidden="true">
      {/* La zone de tracé est retraite de 7px de chaque côté : un point placé à
          0 % ou à 100 % reste entier au lieu d'être coupé par le conteneur. */}
      <div className="relative h-full">
        {/* Axe */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />
        {/* Segment de l'écart */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-muted-foreground/40 rounded-full"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        {/* Point : salons comparables */}
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-muted-foreground ring-2 ring-background"
          style={{ left: `${b}%` }}
        />
        {/* Point : votre salon */}
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-primary ring-2 ring-background"
          style={{ left: `${a}%` }}
        />
      </div>
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

// ------------------------------------------------------------------ Impression

/**
 * Export PDF par impression navigateur. Motif classique « n'imprimer qu'un
 * élément » : tout est masqué, seul #market-intel-print reste visible et est
 * repositionné en haut de page.
 */
const PRINT_CSS = `
.mi-print-only { display: none; }

@media print {
  @page { size: A4; margin: 14mm; }

  body * { visibility: hidden !important; }
  #market-intel-print,
  #market-intel-print * { visibility: visible !important; }
  #market-intel-print {
    position: absolute !important;
    left: 0; top: 0; width: 100%;
    padding: 0; margin: 0;
  }

  .mi-no-print, .mi-no-print * { display: none !important; }
  .mi-print-only { display: block !important; }

  /* Les aplats de marque doivent réellement s'imprimer */
  #market-intel-print * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Les sections longues (listes de salons, de segments) PEUVENT se couper
     entre deux lignes : les rendre insécables en bloc laisserait des pages à
     moitié vides. Ce sont les lignes et les titres qui restent solidaires. */
  .mi-block { margin-bottom: 9mm; }
  .mi-avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .mi-head { break-after: avoid; page-break-after: avoid; }

  .mi-brand-head {
    border-bottom: 2px solid hsl(var(--primary));
    padding-bottom: 6mm;
    margin-bottom: 8mm;
  }
  .mi-brand-wordmark {
    font-family: "Playfair Display", Georgia, serif;
    font-size: 15pt; font-weight: 700; letter-spacing: -0.01em;
    color: hsl(var(--primary));
  }
  .mi-brand-title {
    font-size: 12pt; font-weight: 600; margin-top: 2mm;
    color: hsl(var(--foreground));
  }
  .mi-brand-meta {
    font-size: 8pt; margin-top: 1.5mm;
    color: hsl(var(--muted-foreground));
  }
  .mi-brand-foot {
    border-top: 1px solid hsl(var(--border));
    padding-top: 4mm; margin-top: 8mm;
    font-size: 8pt; color: hsl(var(--muted-foreground));
  }
}
`;

export default OrganizerMarketIntel;
