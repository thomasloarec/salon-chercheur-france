import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Building, Upload, X, AlertCircle } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Step1Data } from '@/lib/validation/noveltySchemas';
import type { Event } from '@/types/event';
import ExistingCompanyCard from '@/components/novelty/ExistingCompanyCard';
import { useExhibitorSelection } from '@/hooks/useExhibitorSelection';

interface Step1ExhibitorAndUserProps {
  event: Event;
  data: Partial<Step1Data>;
  onChange: (data: Partial<Step1Data>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function Step1ExhibitorAndUser({
  event,
  data,
  onChange,
  onValidationChange
}: Step1ExhibitorAndUserProps) {
  const {
    user,
    exhibitors,
    globalExhibitors,
    loading,
    searchQuery,
    setSearchQuery,
    selectedExhibitor,
    selectedExhibitorLogo,
    selectedExhibitorStandInfo,
    setSelectedExhibitorStandInfo,
    handleExhibitorSelect,
    resetSelection,
    showNewExhibitorForm,
    setShowNewExhibitorForm,
    newExhibitorData,
    setNewExhibitorData,
    handleLogoUpload,
    candidateMatch,
    resolveLoading,
    confirmedLegacyMatch,
    setConfirmedLegacyMatch,
    handleUseExistingMatch,
    quota,
    userData,
    setUserData,
    isProfessionalEmail,
    noExhibitorsForEvent,
  } = useExhibitorSelection({ event, onChange, onValidationChange });

  return (
    <div className="space-y-8">
      {/* Step header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Société et utilisateur</h2>
        <p className="text-muted-foreground">
          Sélectionnez l'exposant et renseignez vos informations
        </p>
      </div>

      {/* Exhibitor Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {noExhibitorsForEvent ? 'Ajouter votre entreprise' : "Sélectionner l'exposant"}
          </h3>
          {/* Bouton « Changer » : inutile s'il n'y a pas d'exposant à choisir */}
          {(selectedExhibitor || (showNewExhibitorForm && !noExhibitorsForEvent)) && (
            <Button variant="outline" size="sm" onClick={resetSelection}>
              <X className="h-4 w-4 mr-1" />
              Changer
            </Button>
          )}
        </div>

        {selectedExhibitor ? (
          /* Selected exhibitor display */
          <div className="space-y-3">
            <Card className="border-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Building className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">{selectedExhibitor.name}</h4>
                      {selectedExhibitor.website && (
                        <p className="text-sm text-muted-foreground">{selectedExhibitor.website}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Badge variant={selectedExhibitor.approved ? "default" : "secondary"}>
                      {selectedExhibitor.approved ? 'Approuvé' : 'En validation'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Informations du stand - toujours éditable */}
            <Card>
              <CardContent className="p-4">
                <Label htmlFor="selected-exhibitor-stand">Informations du stand</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {selectedExhibitor.stand_info 
                    ? "Vous pouvez modifier le numéro de stand si nécessaire"
                    : "Le numéro de stand n'est pas renseigné, vous pouvez l'ajouter maintenant"
                  }
                </p>
                <Input
                  id="selected-exhibitor-stand"
                  value={selectedExhibitorStandInfo}
                  onChange={(e) => setSelectedExhibitorStandInfo(e.target.value)}
                  placeholder="Numéro de stand, emplacement..."
                />
              </CardContent>
            </Card>
            
            {/* Ajout optionnel du logo pour l'exposant sélectionné - uniquement si pas de logo existant */}
            {!selectedExhibitor.logo_url && (
              <Card>
                <CardContent className="p-4">
                  <Label htmlFor="selected-exhibitor-logo">Ajouter un logo (optionnel)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    L'entreprise n'a pas encore de logo, vous pouvez en ajouter un maintenant
                  </p>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="selected-exhibitor-logo"
                    />
                    <label
                      htmlFor="selected-exhibitor-logo"
                      className="flex items-center justify-center w-full h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-primary transition-colors"
                    >
                      {(newExhibitorData.logo || selectedExhibitorLogo) ? (
                        <div className="text-center">
                          <p className="text-sm font-medium">✅ {(newExhibitorData.logo || selectedExhibitorLogo)?.name}</p>
                          <p className="text-xs text-muted-foreground">Cliquez pour changer</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Ajouter un logo</p>
                        </div>
                      )}
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Afficher un avertissement si le quota est atteint */}
            {quota && !quota.allowed && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <p className="font-semibold mb-1">Limite atteinte pour cet exposant</p>
                  <p className="text-sm">
                    {selectedExhibitor.name} a déjà publié {quota.current} nouveauté{quota.current > 1 ? 's' : ''} sur cet événement.
                    Le plan gratuit limite à {quota.limit} nouveauté par exposant et par événement.
                  </p>
                  <p className="text-sm mt-2">
                    <a 
                      href="/exposants" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-destructive-foreground/80 transition-colors"
                    >
                      Passer au plan Pro
                    </a>
                    {' '}pour publier davantage de nouveautés.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : showNewExhibitorForm ? (
          /* New exhibitor form */
          <Card>
            <CardContent className="p-6 space-y-4">
              <h4 className="font-medium">
                {noExhibitorsForEvent
                  ? 'Renseignez votre entreprise'
                  : 'Créer une nouvelle entreprise'}
              </h4>
              {noExhibitorsForEvent && (
                <p className="text-sm text-muted-foreground -mt-2">
                  Aucun exposant n'est encore référencé sur cet événement. Renseignez votre entreprise pour publier votre nouveauté. Si une entreprise existe déjà sur Lotexpo avec ce site web, elle sera automatiquement réutilisée (pas de doublon).
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company-name">Nom de l'entreprise *</Label>
                  <Input
                    id="company-name"
                    value={newExhibitorData.name}
                    onChange={(e) => setNewExhibitorData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nom de votre entreprise"
                  />
                </div>

                <div>
                  <Label htmlFor="company-website">Site web</Label>
                  <Input
                    id="company-website"
                    type="url"
                    value={newExhibitorData.website}
                    onChange={(e) => setNewExhibitorData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://votresite.com"
                  />
                </div>
              </div>

              {/* Détection live : entreprise déjà présente sur Lotexpo */}
              {confirmedLegacyMatch ? (
                <div className="rounded-lg border border-primary bg-muted p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Entreprise sélectionnée</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">{confirmedLegacyMatch.exhibitor_name}</span>
                        {confirmedLegacyMatch.website && (
                          <span> — {confirmedLegacyMatch.website}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cette entreprise déjà connue de Lotexpo sera réutilisée (aucun doublon ne sera créé). Complétez les informations ci-dessous, puis continuez.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmedLegacyMatch(null)}
                    className="w-full sm:w-auto"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Choisir une autre entreprise
                  </Button>
                </div>
              ) : (
                <>
                  {resolveLoading && !candidateMatch && (
                    <p className="text-xs text-muted-foreground">Recherche d'une entreprise existante…</p>
                  )}
                  {candidateMatch && (
                    <ExistingCompanyCard match={candidateMatch} onUse={handleUseExistingMatch} />
                  )}
                </>
              )}

              {/* Si une entreprise bloquée est détectée, on masque description / logo
                  pour éviter toute saisie inutile. */}
              {!(candidateMatch && candidateMatch.has_admin && !candidateMatch.current_user_can_create_novelty) && (
              <>
              <div>
                <Label htmlFor="company-description">Description de l'entreprise</Label>
                <textarea
                  id="company-description"
                  value={newExhibitorData.description}
                  onChange={(e) => setNewExhibitorData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Présentez votre entreprise en quelques lignes..."
                  className="w-full min-h-[100px] px-3 py-2 border border-input rounded-md resize-y"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="stand-info">Informations du stand</Label>
                <Input
                  id="stand-info"
                  value={newExhibitorData.stand_info}
                  onChange={(e) => setNewExhibitorData(prev => ({ ...prev, stand_info: e.target.value }))}
                  placeholder="Numéro de stand, emplacement..."
                />
              </div>

              <div>
                <Label htmlFor="company-logo">Logo (optionnel)</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="company-logo"
                  />
                  <label
                    htmlFor="company-logo"
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-primary transition-colors"
                  >
                    {newExhibitorData.logo ? (
                      <div className="text-center">
                        <p className="text-sm font-medium">{newExhibitorData.logo.name}</p>
                        <p className="text-xs text-muted-foreground">Cliquez pour changer</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Ajouter un logo</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Exhibitor search and list */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une entreprise..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {exhibitors.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground px-1">
                    Exposants déjà listés sur cet événement
                  </p>
                )}
                {exhibitors.map((exhibitor) => (
                  <Card 
                    key={exhibitor.id} 
                    className="cursor-pointer hover:bg-primary transition-colors"
                    onClick={() => handleExhibitorSelect(exhibitor)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{exhibitor.name}</h4>
                        <Button size="sm">Sélectionner</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {globalExhibitors.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground px-1 pt-2">
                    Entreprises déjà présentes sur Lotexpo (pas encore listées sur cet événement)
                  </p>
                )}
                {globalExhibitors.map((exhibitor) => (
                  <Card
                    key={`global-${exhibitor.id}`}
                    className="cursor-pointer hover:bg-primary transition-colors border-dashed"
                    onClick={() => handleExhibitorSelect(exhibitor)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{exhibitor.name}</h4>
                          {exhibitor.website && (
                            <p className="text-xs text-muted-foreground">{exhibitor.website}</p>
                          )}
                        </div>
                        <Button size="sm" variant="outline">Sélectionner</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => setShowNewExhibitorForm(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Mon entreprise n'est pas dans la liste
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User Information (if not logged in) */}
      {!user && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Vos informations</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first-name">Prénom *</Label>
              <Input
                id="first-name"
                value={userData.first_name}
                onChange={(e) => setUserData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Votre prénom"
              />
            </div>

            <div>
              <Label htmlFor="last-name">Nom *</Label>
              <Input
                id="last-name"
                value={userData.last_name}
                onChange={(e) => setUserData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Votre nom"
              />
            </div>

            <div>
              <Label htmlFor="email">Email professionnel *</Label>
              <Input
                id="email"
                type="email"
                value={userData.email}
                onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="votre.email@entreprise.com"
                className={userData.email && !isProfessionalEmail(userData.email) ? 'border-destructive' : ''}
              />
              {userData.email && !isProfessionalEmail(userData.email) && (
                <p className="text-xs text-destructive mt-1">
                  Utilisez votre email professionnel d'entreprise
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                value={userData.phone}
                onChange={(e) => setUserData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="01 23 45 67 89"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="role">Rôle/Fonction *</Label>
              <Input
                id="role"
                value={userData.role}
                onChange={(e) => setUserData(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Directeur commercial, Chef de produit..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}