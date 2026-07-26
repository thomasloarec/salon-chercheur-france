import React, { useMemo, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Building, Check, Loader2, Lock, Plus, Search, X } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ExistingCompanyCard from '@/components/novelty/ExistingCompanyCard';
import { useExhibitorSelection, type DbExhibitor } from '@/hooks/useExhibitorSelection';
import type { Event } from '@/types/event';

function ExhibitorRow({
  exhibitor,
  selected,
  onSelect,
}: {
  exhibitor: DbExhibitor;
  selected: boolean;
  onSelect: (e: DbExhibitor) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(exhibitor)}
      className={cn(
        'w-full text-left rounded-xl border bg-card p-4 transition-all duration-200 hover:border-foreground/30 hover:shadow-sm flex items-center gap-3',
        selected ? 'border-foreground ring-1 ring-foreground/20 bg-muted/40' : 'border-border'
      )}
    >
      {exhibitor.logo_url ? (
        <img src={exhibitor.logo_url} alt="" className="h-10 w-10 rounded object-contain bg-background" />
      ) : (
        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
          <Building className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{exhibitor.name}</span>
          {exhibitor.approved && <Badge variant="secondary" className="text-[10px]">Vérifiée</Badge>}
        </div>
        {exhibitor.website && (
          <p className="text-xs text-muted-foreground truncate">{exhibitor.website}</p>
        )}
      </div>
      {selected && <Check className="h-4 w-4 text-foreground flex-shrink-0" />}
    </button>
  );
}

export default function SelectionExposant() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isRealUser, loading: authLoading } = useAuth() as any;

  const stateEvent = (location.state as any)?.event as Event | undefined;
  const eventId = params.get('event') || stateEvent?.id || '';

  const { data: fetchedEvent, isLoading: eventLoading } = useQuery({
    queryKey: ['selection-exposant-event', eventId],
    enabled: !!eventId && !stateEvent,
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
      if (error) throw error;
      return data as unknown as Event;
    },
  });

  const event = (stateEvent || fetchedEvent) as Event | undefined;

  const [isValid, setIsValid] = useState(false);
  const onValidationChange = useCallback((v: boolean) => setIsValid(v), []);
  const onChange = useCallback(() => {}, []);

  if (!authLoading && !isRealUser) {
    return (
      <MainLayout title="Publier une nouveauté">
        <div className="max-w-lg mx-auto py-24 text-center space-y-4">
          <h1 className="heading-display text-2xl">Connectez-vous pour publier</h1>
          <p className="text-muted-foreground">
            La publication d'une nouveauté nécessite un compte professionnel.
          </p>
          <Button asChild>
            <Link to="/auth">Se connecter</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (!eventId) {
    return (
      <MainLayout title="Choisir votre entreprise">
        <div className="max-w-lg mx-auto py-24 text-center space-y-4">
          <h1 className="heading-display text-2xl">Salon manquant</h1>
          <p className="text-muted-foreground">
            Ouvrez cette page avec l'adresse <code className="text-xs">/publier-nouveaute/exposant?event=…</code>
          </p>
          <Button variant="outline" asChild>
            <Link to="/salons">Voir les salons</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (!event) {
    return (
      <MainLayout title="Choisir votre entreprise">
        <div className="py-24 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Choisir votre entreprise">
      <SelectionInner
        event={event}
        eventId={eventId}
        isValid={isValid}
        onChange={onChange}
        onValidationChange={onValidationChange}
        navigate={navigate}
      />
    </MainLayout>
  );
}

function SelectionInner({
  event,
  eventId,
  isValid,
  onChange,
  onValidationChange,
  navigate,
}: {
  event: Event;
  eventId: string;
  isValid: boolean;
  onChange: (d: any) => void;
  onValidationChange: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const {
    user,
    exhibitors,
    globalExhibitors,
    loading,
    searchQuery,
    setSearchQuery,
    selectedExhibitor,
    handleExhibitorSelect,
    resetSelection,
    showNewExhibitorForm,
    setShowNewExhibitorForm,
    newExhibitorData,
    setNewExhibitorData,
    candidateMatch,
    resolveLoading,
    confirmedLegacyMatch,
    handleUseExistingMatch,
    blockedByAdminMatch,
    quota,
    userData,
    setUserData,
    isProfessionalEmail,
    noExhibitorsForEvent,
  } = useExhibitorSelection({ event, onChange, onValidationChange });

  const emailInvalid = !!userData.email && !isProfessionalEmail(userData.email);
  const quotaBlocked = !!(selectedExhibitor && quota && !quota.allowed);

  const eventName = (event as any)?.nom_event ?? (event as any)?.name ?? 'ce salon';

  const handleContinue = () => {
    if (selectedExhibitor?.id) {
      navigate(`/publier-nouveaute/atelier?event=${encodeURIComponent(eventId)}&exhibitor=${encodeURIComponent(selectedExhibitor.id)}`);
      return;
    }
    // Nouvel exposant : pas encore d'identifiant, la création arrive au 6d-3.
    console.log('[6d-2] Temps 1 complet — nouvel exposant à créer', {
      event_id: eventId,
      new_exhibitor: {
        name: newExhibitorData.name,
        website: newExhibitorData.website,
        description: newExhibitorData.description,
        logo: null,
        stand_info: null,
      },
      legacy_id_exposant: confirmedLegacyMatch?.legacy_id_exposant ?? null,
      user: user ? { id: user.id } : userData,
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-10">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Étape 1 sur 2</p>
        <h1 className="heading-display text-3xl md:text-4xl">Quelle entreprise publie cette nouveauté&nbsp;?</h1>
        <p className="text-muted-foreground">
          Cherchez votre entreprise parmi celles présentes sur {eventName} ou dans le catalogue Lotexpo.
        </p>
      </div>

      {/* ── Recherche & sélection ───────────────────────────── */}
      {!showNewExhibitorForm && (
        <section className="space-y-6 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une entreprise…"
              className="h-14 pl-12 text-base rounded-2xl"
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Recherche en cours…
            </div>
          )}

          {!loading && (
            <>
              <div className="space-y-3">
                <h2 className="heading-display text-lg">Exposants de ce salon</h2>
                {exhibitors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {noExhibitorsForEvent
                      ? "Aucun exposant n'est encore répertorié sur ce salon."
                      : 'Aucun exposant ne correspond à votre recherche.'}
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {exhibitors.map((ex) => (
                      <ExhibitorRow
                        key={ex.id}
                        exhibitor={ex}
                        selected={selectedExhibitor?.id === ex.id}
                        onSelect={handleExhibitorSelect}
                      />
                    ))}
                  </div>
                )}
              </div>

              {globalExhibitors.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <h2 className="heading-display text-lg">Autres entreprises connues de Lotexpo</h2>
                    <p className="text-sm text-muted-foreground">
                      Ces entreprises existent déjà sur Lotexpo mais ne sont pas encore rattachées à ce salon.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {globalExhibitors.map((ex) => (
                      <ExhibitorRow
                        key={ex.id}
                        exhibitor={ex}
                        selected={selectedExhibitor?.id === ex.id}
                        onSelect={handleExhibitorSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pt-2">
            <Button variant="outline" onClick={() => setShowNewExhibitorForm(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Mon entreprise n'est pas là, la créer
            </Button>
          </div>
        </section>
      )}

      {/* ── Création d'un nouvel exposant ───────────────────── */}
      {showNewExhibitorForm && (
        <section className="space-y-5 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="heading-display text-xl">Créer votre entreprise</h2>
              <p className="text-sm text-muted-foreground">
                Le logo et le numéro de stand se renseignent ensuite depuis votre fiche exposant.
              </p>
            </div>
            {!noExhibitorsForEvent && (
              <Button variant="ghost" size="sm" onClick={resetSelection}>
                <X className="h-4 w-4 mr-1" /> Revenir à la recherche
              </Button>
            )}
          </div>

          <div className="grid gap-4 rounded-2xl border bg-card p-5">
            <div className="space-y-2">
              <Label htmlFor="new-name">Nom de l'entreprise *</Label>
              <Input
                id="new-name"
                value={newExhibitorData.name}
                onChange={(e) => setNewExhibitorData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex. Atelier Dumas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-website">Site web *</Label>
              <Input
                id="new-website"
                value={newExhibitorData.website}
                onChange={(e) => setNewExhibitorData((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-desc">Description (facultatif)</Label>
              <Textarea
                id="new-desc"
                rows={3}
                value={newExhibitorData.description}
                onChange={(e) => setNewExhibitorData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ce que fait votre entreprise, en une ou deux phrases."
              />
            </div>

            {resolveLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Vérification des entreprises existantes…
              </div>
            )}

            {candidateMatch && (
              <ExistingCompanyCard match={candidateMatch} onUse={handleUseExistingMatch} />
            )}

            {confirmedLegacyMatch && (
              <Alert>
                <AlertDescription className="text-sm">
                  La fiche existante de{' '}
                  <span className="font-medium">{confirmedLegacyMatch.exhibitor_name}</span> sera réutilisée.
                  Complétez les informations ci-dessus puis continuez.
                </AlertDescription>
              </Alert>
            )}

            {blockedByAdminMatch && (
              <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Cette entreprise est déjà administrée sur Lotexpo. Pour publier en son nom, demandez à être
                  ajouté à son équipe.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </section>
      )}

      {/* ── Quota ───────────────────────────────────────────── */}
      {quotaBlocked && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">
            Cette entreprise a atteint son nombre maximum de nouveautés pour ce salon
            {typeof quota?.limit === 'number' ? ` (${quota.current}/${quota.limit})` : ''}.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Identification ──────────────────────────────────── */}
      {!user && (
        <section className="space-y-5">
          <div>
            <h2 className="heading-display text-xl">Vos coordonnées</h2>
            <p className="text-sm text-muted-foreground">
              Nous en avons besoin pour rattacher la nouveauté à votre entreprise.
            </p>
          </div>
          <div className="grid gap-4 rounded-2xl border bg-card p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="u-first">Prénom *</Label>
                <Input
                  id="u-first"
                  value={userData.first_name}
                  onChange={(e) => setUserData((p) => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-last">Nom *</Label>
                <Input
                  id="u-last"
                  value={userData.last_name}
                  onChange={(e) => setUserData((p) => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">Email professionnel *</Label>
              <Input
                id="u-email"
                type="email"
                value={userData.email}
                onChange={(e) => setUserData((p) => ({ ...p, email: e.target.value }))}
                placeholder="prenom.nom@entreprise.com"
              />
              {emailInvalid && (
                <p className="text-xs text-destructive">
                  Merci d'utiliser une adresse professionnelle (les adresses grand public ne sont pas acceptées).
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="u-phone">Téléphone *</Label>
                <Input
                  id="u-phone"
                  value={userData.phone}
                  onChange={(e) => setUserData((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-role">Fonction *</Label>
                <Input
                  id="u-role"
                  value={userData.role}
                  onChange={(e) => setUserData((p) => ({ ...p, role: e.target.value }))}
                  placeholder="Ex. Responsable marketing"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Continuer ───────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t py-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {isValid
            ? selectedExhibitor
              ? `${selectedExhibitor.name} — prêt à continuer`
              : 'Entreprise renseignée — prêt à continuer'
            : 'Choisissez ou créez votre entreprise pour continuer.'}
        </p>
        <Button size="lg" disabled={!isValid} onClick={handleContinue} className="rounded-full">
          Continuer <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
