import React from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Radar, Settings } from 'lucide-react';
import RadarActionCard from '@/components/radar-crm/RadarActionCard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRadarActionStats, useSetEventsGoal } from '@/hooks/useRadarActionStats';
import RadarOnboardingPanel from '@/components/radar-crm/RadarOnboardingPanel';
import RadarActiveBanner from '@/components/radar-crm/RadarActiveBanner';
import RadarPageGate from '@/components/radar-crm/RadarPageGate';
import { SeatTrialBanner, TrialBanner, OfferProfileNudge } from '@/components/radar-crm/RadarStates';
import { formatDate } from '@/components/radar-crm/RadarShared';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';
import { type RadarStatus } from '@/types/radar';

const RadarOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    imports, activeImportId, setActiveImportId,
    radarView, loading,
    onboarding, onboardingLoading,
    access, orgName, isSpaceOwner,
    getPref, offerEmpty,
    futureGroups,
    nextEvent, featured, starredCount, ongoingEvents,
    enterTerrain, onClickEvent,
  } = useRadarWorkspace();

  const { data: actionStats } = useRadarActionStats(access?.account_id ?? null);
  const setGoal = useSetEventsGoal();
  const [goalEditing, setGoalEditing] = React.useState(false);
  const [goalInput, setGoalInput] = React.useState('');

  // Compatibilité des anciens liens à paramètres.
  const tab = searchParams.get('tab');
  const eventId = searchParams.get('eventId');
  const redirectTo = (path: string, drop: string[]) => {
    const next = new URLSearchParams(searchParams);
    drop.forEach((k) => next.delete(k));
    const qs = next.toString();
    return <Navigate to={`${path}${qs ? `?${qs}` : ''}`} replace />;
  };
  if (tab === 'companies') return redirectTo('/radar-crm/comptes', ['tab']);
  if (tab === 'future') return redirectTo('/radar-crm/salons', ['tab']);
  if (tab === 'past') return redirectTo('/radar-crm/passes', ['tab']);
  if (eventId) return redirectTo('/radar-crm/salons', ['tab']);
  if (searchParams.get('panel') === 'settings') return redirectTo('/radar-crm/equipe', ['panel']);

  const status: RadarStatus = radarView?.status ?? 'none';
  const isLocked = status === 'trial_expired' || status === 'free';
  const isTrial = status === 'trial_active';
  const daysLeft = radarView?.days_left ?? null;
  const summary = radarView?.summary;

  const accessKind = access?.access_kind ?? null;
  const isSeatTrial = accessKind === 'trial' && (access?.has_access ?? false);

  // CTA onboarding « Préparer » : cible directement la page des salons à venir.
  const onPrepareEvent = (id: string) => {
    navigate(`/radar-crm/salons?eventId=${encodeURIComponent(id)}`);
  };

  const onboardingCaptureEventId =
    onboarding?.prepare_next?.event_id ?? nextEvent?.event_id ?? null;

  const analyzedCount = summary?.companies_analyzed ?? 0;
  const detectedCount = summary?.companies_detected ?? 0;
  const futureSalonsCount = summary?.future_salons ?? futureGroups.length;

  const goalIsSet = actionStats?.chosen_events.goal_is_set ?? false;
  const submitGoal = () => {
    const n = parseInt(goalInput, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    setGoal.mutate(n, { onSuccess: () => setGoalEditing(false) });
  };

  return (
    <div className="font-body bg-muted/10 min-h-[calc(100vh-200px)]">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-10 md:space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Radar className="h-5 w-5" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Votre Radar CRM</h1>
            </div>
            <p className="text-muted-foreground text-sm md:text-base max-w-xl">
              {loading ? 'Analyse en cours…' : isLocked ? (
                <>Votre Radar CRM est prêt — débloquez l'accès pour découvrir vos détections</>
              ) : (
                <>Pendant que vous travaillez, Radar surveille vos comptes CRM et vous alerte avant chaque salon.</>
              )}
            </p>
            {!isLocked && !loading && (() => {
              const activeImport = imports?.find((i) => i.id === activeImportId) ?? null;
              const fileName = activeImport?.file_name ?? null;
              if (!orgName && !fileName && !isSpaceOwner) return null;
              return (
                <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  {orgName ? (
                    <span>Espace : <span className="font-medium text-foreground">{orgName}</span></span>
                  ) : isSpaceOwner ? (
                    <button
                      type="button"
                      onClick={() => navigate('/radar-crm/equipe')}
                      className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      Nommez cet espace
                    </button>
                  ) : null}
                  {fileName && (orgName || isSpaceOwner) && <span aria-hidden>·</span>}
                  {fileName && <span>Fichier : <span className="font-medium text-foreground">{fileName}</span></span>}
                </p>
              );
            })()}
          </div>
          {!isLocked && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/radar-crm/equipe')}
                className="w-full sm:w-auto"
              >
                <Settings className="h-4 w-4 mr-2" /> Paramètres Radar CRM
              </Button>
              {imports && imports.length > 1 && (
                <Select value={activeImportId ?? ''} onValueChange={setActiveImportId}>
                  <SelectTrigger className="w-full sm:w-[240px] max-w-full bg-card">
                    <SelectValue placeholder="Choisir un import" />
                  </SelectTrigger>
                  <SelectContent>
                    {imports.map((imp) => (
                      <SelectItem key={imp.id} value={imp.id}>
                        {imp.file_name ?? 'Sans nom'} — {formatDate(imp.created_at)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button asChild className="w-full sm:w-auto">
                <Link to="/radar-crm#radar-upload">
                  <RefreshCw className="h-4 w-4 mr-2" /> Reconnecter mon CRM
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Panneau d'onboarding gamifié — 4 missions */}
        {!isLocked && (
          <RadarOnboardingPanel
            progress={onboarding}
            loading={onboardingLoading}
            captureEventId={onboardingCaptureEventId}
            onGoCompanies={() => navigate('/radar-crm/comptes')}
            onPrepareEvent={onPrepareEvent}
            onEnterTerrain={enterTerrain}
            onOpenCollaboration={() => navigate('/radar-crm/equipe')}
          />
        )}

        {/* Bandeau d'essai par siège (modèle par-membre) — source: my_radar_access */}
        {isSeatTrial && !loading && (
          <SeatTrialBanner daysLeft={access?.trial_days_left ?? null} />
        )}

        {/* Ancien bandeau d'essai (statut get_my_radar_view) — fallback */}
        {isTrial && !loading && !access && (
          <TrialBanner daysLeft={daysLeft} detected={detectedCount} />
        )}

        {/* Compteurs d'action — masqués en état verrouillé */}
        {!isLocked && actionStats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              {actionStats.chosen_events.value === 0 ? (
                <Card className="shadow-none bg-secondary/40 border-primary/30">
                  <CardContent className="px-5 pt-6 pb-5">
                    <p className="font-display text-base font-semibold text-foreground">Aucun salon prévu</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {actionStats.chosen_events.available} salons où vos comptes exposent vous attendent
                    </p>
                    <Button size="sm" className="mt-3" onClick={() => navigate('/radar-crm/salons')}>
                      Choisir mes salons
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <RadarActionCard
                  value={actionStats.chosen_events.value}
                  target={actionStats.chosen_events.target}
                  label="Salons prévus, 90 prochains jours"
                  hint={goalIsSet ? (
                    <span className="text-muted-foreground">
                      objectif {actionStats.goal} · {actionStats.chosen_events.available} salons possibles
                    </span>
                  ) : undefined}
                  onClick={() => navigate('/radar-crm/salons')}
                />
              )}
              <RadarActionCard
                value={actionStats.prepared_accounts.value}
                target={actionStats.prepared_accounts.target}
                label="Comptes préparés"
                onClick={() => navigate('/radar-crm/salons')}
              />
              <RadarActionCard
                value={actionStats.met_accounts.value}
                target={actionStats.met_accounts.target}
                label="Comptes rencontrés, 90 derniers jours"
                onClick={() => navigate('/radar-crm/passes')}
              />
              <RadarActionCard
                value={actionStats.pending_followups.open}
                label="Suivis à traiter"
                showBar={false}
                hint={actionStats.pending_followups.overdue > 0 ? (
                  <span className="text-destructive">dont {actionStats.pending_followups.overdue} en retard</span>
                ) : undefined}
                onClick={() => navigate('/radar-crm/passes')}
              />
              {actionStats.active_member_count > 1 && (
                <RadarActionCard
                  value={actionStats.members_engaged.value}
                  target={actionStats.members_engaged.target}
                  label="Membres engagés"
                  onClick={() => navigate('/radar-crm/equipe')}
                />
              )}
            </div>

            {/* Objectif de salons par trimestre — owner uniquement */}
            {actionStats.is_owner && (
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                {goalEditing ? (
                  <>
                    <Input
                      type="number"
                      min={1}
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="h-8 w-24"
                      placeholder="4"
                    />
                    <Button size="sm" onClick={submitGoal} disabled={setGoal.isPending}>Enregistrer</Button>
                    <button type="button" className="underline underline-offset-2" onClick={() => setGoalEditing(false)}>
                      Annuler
                    </button>
                  </>
                ) : goalIsSet ? (
                  <>
                    <span>Objectif : {actionStats.goal} salons par trimestre</span>
                    <span aria-hidden>·</span>
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2"
                      onClick={() => { setGoalInput(String(actionStats.goal ?? '')); setGoalEditing(true); }}
                    >
                      Modifier
                    </button>
                    <span aria-hidden>·</span>
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => setGoal.mutate(null)}
                    >
                      Retirer
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => { setGoalInput(''); setGoalEditing(true); }}
                  >
                    Fixer un objectif de salons par trimestre
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <RadarPageGate>
          <>
            {/* Bandeau « radar actif » — cadrage veille/surveillance */}
            <RadarActiveBanner
              analyzed={analyzedCount}
              futureCompanies={summary?.future_companies ?? 0}
              futureSalons={futureSalonsCount}
              featured={featured}
              starredCount={starredCount}
              ongoing={ongoingEvents}
              getPref={getPref}
              onEnterTerrain={enterTerrain}
              onClickEvent={onClickEvent}
              onOpenSettings={() => navigate('/radar-crm/equipe')}
            />

            {/* Nudge profil d'offre — discret, disparaît une fois le profil rempli */}
            {offerEmpty === true && (
              <div className="mt-6">
                <OfferProfileNudge onOpenSettings={() => navigate('/radar-crm/equipe')} />
              </div>
            )}
          </>
        </RadarPageGate>
      </div>
    </div>
  );
};

export default RadarOverviewPage;
