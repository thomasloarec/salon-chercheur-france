import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock, Lock, AlertCircle, Radar, Upload, Calendar, MapPin, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type EventGroup, type RadarView } from '@/types/radar';
import { formatDate, eventInitials } from './RadarShared';

/** Nudge cockpit : incite à compléter le profil d'offre (disparaît une fois rempli). */
export const OfferProfileNudge: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => (
  <Card className="border-primary/30 bg-muted shadow-none">
    <CardContent className="py-4 px-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Sparkles className="h-5 w-5 text-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">
          Complétez votre profil d'offre pour des questions de terrain personnalisées.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onOpenSettings} className="shrink-0 w-full sm:w-auto">
        Compléter mon profil
      </Button>
    </CardContent>
  </Card>
);

/**
 * Bandeau d'essai discret (modèle par siège). Invite douce à contacter l'admin.
 */
export const SeatTrialBanner: React.FC<{ daysLeft: number | null }> = ({ daysLeft }) => {
  const d = Math.max(0, daysLeft ?? 0);
  return (
    <div className="rounded-lg border border-primary/30 bg-muted px-4 py-3 flex items-start gap-3">
      <Clock className="h-5 w-5 mt-0.5 shrink-0 text-foreground" />
      <div className="text-sm text-foreground">
        <p>
          <span className="font-semibold">Essai</span> : {d} jour{d > 1 ? 's' : ''} restant{d > 1 ? 's' : ''}.
        </p>
        <p className="text-foreground/70 mt-0.5">
          Contactez l'administrateur de votre espace pour un accès continu.
        </p>
      </div>
    </div>
  );
};

/**
 * Écran de blocage propre quand l'accès par siège est refusé.
 * `none` = essai expiré sans siège ; `locked` = accès suspendu.
 * Ne rend jamais de données CRM.
 */
export const RadarAccessBlocked: React.FC<{ kind: 'none' | 'locked' }> = ({ kind }) => (
  <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
    <div className="max-w-2xl mx-auto px-4 py-16 md:py-24">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Lock className="h-7 w-7" />
          </div>
          <div className="max-w-md space-y-2">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {kind === 'locked' ? 'Accès suspendu' : "Votre accès d'essai a expiré"}
            </h1>
            <p className="text-sm text-foreground/70">
              {kind === 'locked'
                ? "Contactez l'administrateur de votre espace pour rétablir l'accès."
                : "Contactez l'administrateur pour obtenir un siège payant et retrouver l'accès à votre Radar CRM."}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/radar-crm">Retour</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
);

/** Trial banner shown to users on an active trial. Tone intensifies near expiry. */
export const TrialBanner: React.FC<{ daysLeft: number | null; detected: number }> = ({ daysLeft, detected }) => {
  const urgent = daysLeft != null && daysLeft <= 2;
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 flex items-start gap-3',
        urgent
          ? 'border-primary/50 bg-primary/10 text-foreground'
          : 'border-primary/30 bg-primary/5 text-foreground',
      )}
    >
      <Clock className={cn('h-5 w-5 mt-0.5 shrink-0', urgent ? 'text-primary' : 'text-primary')} />
      <div className="text-sm">
        {urgent ? (
          <p>
            <span className="font-semibold">Votre essai se termine bientôt</span> — vous perdrez l'accès à
            vos <strong>{detected}</strong> détection{detected > 1 ? 's' : ''}
            {daysLeft != null && daysLeft > 0 ? ` dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : " aujourd'hui"}.
          </p>
        ) : (
          <p>
            <span className="font-semibold">Essai gratuit</span> — il vous reste{' '}
            <strong>{daysLeft ?? 0}</strong> jour{(daysLeft ?? 0) > 1 ? 's' : ''}.
          </p>
        )}
      </div>
    </div>
  );
};

/** Visible error state instead of a silent empty render. */
export const RadarErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <Card className="border-destructive/30 bg-destructive/5">
    <CardContent className="pt-8 pb-8 text-center">
      <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
      <h3 className="text-lg font-semibold mb-1 text-foreground">Impossible de charger votre Radar CRM</h3>
      <p className="text-sm text-foreground/70 max-w-md mx-auto mb-4">
        Une erreur est survenue lors de la récupération de vos données. Réessayez dans un instant.
      </p>
      <Button onClick={onRetry}>Réessayer</Button>
    </CardContent>
  </Card>
);

/**
 * Locked teaser for a single event — strictly generic.
 * Aucun compteur, aucune identité d'entreprise : juste le salon + 2 pastilles
 * floutées génériques identiques pour tous (ne représentent pas un nombre réel).
 */
export const LockedEventTeaser: React.FC<{ group: EventGroup }> = ({ group }) => {
  return (
    <Card className="overflow-hidden bg-card">
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-[180px] sm:min-w-[180px] h-[140px] sm:h-auto bg-muted overflow-hidden">
          {group.url_image ? (
            <img
              src={group.url_image}
              alt={group.nom_event}
              className="w-full h-full object-cover opacity-80"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            >
              <span className="text-2xl font-bold text-primary-foreground tracking-wider opacity-90">
                {eventInitials(group.nom_event)}
              </span>
            </div>
          )}
          {group.days_until != null && (
            <Badge className="absolute top-2 left-2 bg-foreground text-background border-none">
              J-{Math.max(0, group.days_until)}
            </Badge>
          )}
        </div>

        <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
          <div className="min-w-0">
            <h3 className="font-bold text-lg leading-tight text-foreground line-clamp-2">{group.nom_event}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-foreground/70 mt-1">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(group.date_debut)}</span>
              {(group.ville || group.nom_lieu) && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[group.nom_lieu, group.ville].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </div>

          <div className="bg-muted/50 border rounded-lg p-3">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Des entreprises de votre CRM exposent ici
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-7 w-24 rounded-full bg-muted-foreground/20 blur-[2px]"
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

/**
 * Paywall dur façon média : bandeau de stats agrégées + au plus 3 salons teaser
 * (renvoyés par le serveur), puis un blocage net. Aucun onglet passé/entreprises,
 * aucune liste complète, aucun compteur par salon : tout est verrouillé côté serveur.
 */
export const LockedView: React.FC<{
  teaserGroups: EventGroup[];
  summary?: RadarView['summary'];
  onRequestAccess: () => void;
}> = ({ teaserGroups, summary, onRequestAccess }) => {
  const analyzed = summary?.companies_analyzed ?? 0;
  const futureCompanies = summary?.future_companies ?? 0;
  const futureSalons = summary?.future_salons ?? 0;
  // Serveur : 3 salons max en verrouillé. Sécurité front si la liste enflait.
  const teaser = teaserGroups.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Bandeau de stats agrégées (aucune fuite d'identité) */}
      <Card className="bg-card">
        <CardContent className="py-4">
          <p className="text-sm text-foreground/80">
            <strong className="text-foreground">{analyzed}</strong> compte{analyzed > 1 ? 's' : ''} analysé{analyzed > 1 ? 's' : ''}
            {' · '}
            <strong className="text-foreground">{futureCompanies}</strong> exposeront sur{' '}
            <strong className="text-foreground">{futureSalons}</strong> salon{futureSalons > 1 ? 's' : ''} à venir
          </p>
        </CardContent>
      </Card>

      {/* Teaser : aperçu de quelques salons puis fondu de masquage */}
      {teaser.length > 0 && (
        <div className="relative">
          <div className="space-y-3">
            {teaser.map((g) => (
              <LockedEventTeaser key={g.event_id} group={g} />
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-muted/20"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Blocage dur */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Lock className="h-6 w-6" />
          </div>
          <div className="max-w-lg space-y-1.5">
            <h3 className="text-lg font-bold text-foreground">La suite est réservée</h3>
            <p className="text-sm text-foreground/70">
              <strong className="text-foreground">{futureCompanies}</strong> entreprise{futureCompanies > 1 ? 's' : ''} de votre CRM
              {futureCompanies > 1 ? ' exposeront' : ' exposera'} sur{' '}
              <strong className="text-foreground">{futureSalons}</strong> salon{futureSalons > 1 ? 's' : ''} à venir.
              Débloquez Radar CRM pour découvrir lesquelles, où et quand.
            </p>
          </div>
          <Button onClick={onRequestAccess} size="lg" className="w-full sm:w-auto">
            Demander l'accès
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

/** Minimal "request access" modal with a direct contact fallback. */
export const NoFutureMatches: React.FC<{ companiesCount: number; matchedCount: number }> = ({ companiesCount, matchedCount }) => (
  <Card>
    <CardContent className="pt-8 pb-8 text-center">
      <Radar className="h-10 w-10 mx-auto text-foreground mb-3" />
      <h3 className="text-lg font-semibold mb-1 text-foreground">
        Aucun mouvement détecté pour l'instant
      </h3>
      <p className="text-sm text-foreground/70 max-w-md mx-auto mb-4">
        {matchedCount === 0
          ? `Radar continue de surveiller vos comptes. Aucune correspondance pour l'instant entre les ${companiesCount} domaines de votre fichier et les exposants Lotexpo.`
          : "Radar continue de surveiller vos comptes. Dès qu'un de vos comptes s'inscrit à un salon à venir, vous le verrez ici et serez alerté par email."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/radar-crm"><Upload className="h-4 w-4 mr-2" /> Importer un autre fichier</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Voir les événements Lotexpo</Link>
        </Button>
      </div>
    </CardContent>
  </Card>
);

export const RadarEmptyState: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 py-12 text-center">
    <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground mx-auto flex items-center justify-center mb-4">
      <Radar className="h-7 w-7" />
    </div>
    <h1 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">Votre Radar CRM est vide</h1>
    <p className="text-foreground/70 mb-6 max-w-xl mx-auto">
      Importez votre liste de prospects et découvrez en quelques secondes ceux qui exposent
      sur des salons dans les 60 prochains jours.
    </p>
    <Button asChild size="lg">
      <Link to="/radar-crm"><Upload className="h-4 w-4 mr-2" /> Importer mon fichier CSV</Link>
    </Button>
  </div>
);
