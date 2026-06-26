import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Building, Upload, X, AlertCircle } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useNoveltyQuota } from '@/hooks/useNoveltyQuota';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Step1Data } from '@/lib/validation/noveltySchemas';
import { step1Schema, CONSUMER_EMAIL_DOMAINS } from '@/lib/validation/noveltySchemas';
import type { Event } from '@/types/event';
import { normalizeStandNumber } from '@/utils/standUtils';
import ExistingCompanyCard, { ResolveCandidateMatch } from '@/components/novelty/ExistingCompanyCard';

interface DbExhibitor {
  id: string;
  name: string;
  website?: string;
  logo_url?: string;
  approved: boolean;
  stand_info?: string;
  /** true si la fiche existe sur Lotexpo mais pas encore rattachée à cet événement */
  needs_participation?: boolean;
}

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
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [exhibitors, setExhibitors] = useState<DbExhibitor[]>([]);
  const [globalExhibitors, setGlobalExhibitors] = useState<DbExhibitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [loading, setLoading] = useState(false);
  const [showNewExhibitorForm, setShowNewExhibitorForm] = useState(false);
  const [selectedExhibitor, setSelectedExhibitor] = useState<DbExhibitor | null>(null);
  const [selectedExhibitorLogo, setSelectedExhibitorLogo] = useState<File | null>(null);
  const [selectedExhibitorStandInfo, setSelectedExhibitorStandInfo] = useState<string>('');
  // ✅ Track whether the event has any exhibitor at all (independent of search filter)
  const [eventHasAnyExhibitor, setEventHasAnyExhibitor] = useState<boolean | null>(null);
  
  // Vérifier le quota pour l'exposant sélectionné
  const { data: quota } = useNoveltyQuota(
    selectedExhibitor?.id,
    event?.id
  );
  
  // New exhibitor form data
  const [newExhibitorData, setNewExhibitorData] = useState({
    name: '',
    website: '',
    description: '',
    stand_info: '',
    logo: null as File | null
  });

  // Détection live d'entreprise existante quand l'utilisateur remplit le formulaire
  // « Créer une nouvelle entreprise ». Évite les doublons et les pertes de saisie.
  const debouncedNewName = useDebounce(newExhibitorData.name, 500);
  const debouncedNewWebsite = useDebounce(newExhibitorData.website, 500);
  const [candidateMatch, setCandidateMatch] = useState<ResolveCandidateMatch | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  // Match « ancienne base » confirmé par l'utilisateur (clic sur « Utiliser cette entreprise »).
  // Sert à afficher une confirmation claire + permettre de revenir en arrière.
  const [confirmedLegacyMatch, setConfirmedLegacyMatch] = useState<ResolveCandidateMatch | null>(null);

  // User form data (if not logged in)
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: ''
  });

  // Load exhibitors on mount and when search changes
  useEffect(() => {
    loadExhibitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, event?.id_event]);

  // Validate form data
  useEffect(() => {
    const hasExhibitor = selectedExhibitor || (newExhibitorData.name && newExhibitorData.website);
    const hasUserData = !!user || (!!(userData.first_name && userData.last_name && userData.email && userData.phone && userData.role));
    
    // Validate professional email if provided
    const emailValid = !userData.email || isProfessionalEmail(userData.email);
    
    // Bloquer la validation si quota dépassé pour l'exposant sélectionné
    const quotaOk = !selectedExhibitor || !quota || quota.allowed;

    // Bloquer si un match existant est administré par un autre utilisateur
    const blockedByAdminMatch = !!(
      !selectedExhibitor &&
      candidateMatch &&
      candidateMatch.has_admin &&
      !candidateMatch.current_user_can_create_novelty
    );

    const isValid = hasExhibitor && hasUserData && emailValid && quotaOk && !blockedByAdminMatch;
    onValidationChange(isValid);

    // Update parent data - Always send valid structure
    if (hasExhibitor && hasUserData && emailValid && quotaOk) {
      const exhibitorData = selectedExhibitor 
        ? { 
            id: selectedExhibitor.id, 
            name: selectedExhibitor.name, 
            website: selectedExhibitor.website || '',
            approved: selectedExhibitor.approved,
            logo: selectedExhibitorLogo || newExhibitorData.logo, // ✅ Prioriser selectedExhibitorLogo
            stand_info: selectedExhibitorStandInfo || selectedExhibitor.stand_info || '', // ✅ Inclure le stand modifié
            // ✅ DEDUP : si l'id sélectionné est un id legacy (non UUID), on le transmet
            // pour que le backend puisse migrer la fiche legacy au lieu d'en créer une copie.
            legacy_id_exposant: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedExhibitor.id)
              ? null
              : selectedExhibitor.id,
            // ✅ Si l'entreprise vient du catalogue Lotexpo (pas encore exposante sur l'event),
            //    AddNoveltyStepper appellera ensure_participation avant la création.
            needs_participation: selectedExhibitor.needs_participation === true,
          }
        : { 
            name: newExhibitorData.name, 
            website: newExhibitorData.website || '',
            description: newExhibitorData.description || '',
            stand_info: newExhibitorData.stand_info || '',
            logo: newExhibitorData.logo 
          };

      console.log('🔄 Step1 onUpdate appelé avec:', {
        hasSelectedExhibitor: !!selectedExhibitor,
        exhibitorData,
        exhibitor_has_description: 'description' in exhibitorData,
        description_value: (exhibitorData as any).description,
        description_length: (exhibitorData as any).description?.length || 0,
        selectedExhibitorLogo,
        hasLogoInData: !!exhibitorData.logo,
        logoFileName: exhibitorData.logo?.name,
        logoIsFile: exhibitorData.logo instanceof File
      });

      onChange({
        exhibitor: exhibitorData,
        user: user ? undefined : {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || ''
        }
      });
    }
  }, [selectedExhibitor, newExhibitorData, userData, user, quota, onChange, onValidationChange, selectedExhibitorLogo, selectedExhibitorStandInfo, candidateMatch]);

  // Check if email is professional
  const isProfessionalEmail = (email: string) => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain && !CONSUMER_EMAIL_DOMAINS.includes(domain);
  };

  const loadExhibitors = async () => {
    try {
      setLoading(true);

      const eventId = event?.id_event ?? null;
      if (!eventId) {
        console.warn('[Step1ExhibitorAndUser] Aucun id_event défini');
        setExhibitors([]);
        setEventHasAnyExhibitor(false);
        return;
      }

      // ✅ Vérifier (une seule fois) si l'événement a au moins un exposant,
      // indépendamment du filtre de recherche.
      if (eventHasAnyExhibitor === null) {
        const { count } = await supabase
          .from('participations_with_exhibitors')
          .select('id_exposant', { count: 'exact', head: true })
          .eq('id_event_text', eventId);
        const hasAny = (count ?? 0) > 0;
        setEventHasAnyExhibitor(hasAny);
        // Si aucun exposant n'existe sur cet événement, on passe directement
        // au formulaire de création (la recherche ne sert à rien).
        if (!hasAny) {
          setShowNewExhibitorForm(true);
        }
      }

      // Charger directement depuis la vue participations_with_exhibitors
      let q = supabase
        .from('participations_with_exhibitors')
        .select('id_exposant, exhibitor_uuid, exhibitor_name, name_final, exhibitor_website, website_final, stand_exposant, approved, logo_url')
        .eq('id_event_text', eventId)
        .order('name_final', { ascending: true, nullsFirst: false });

      const s = debouncedSearch?.trim();
      if (s) q = q.ilike('name_final', `%${s}%`);

      const { data: participations, error: partErr } = await q;
      if (partErr) {
        console.error('[Step1ExhibitorAndUser] participations error', partErr);
        throw partErr;
      }

      const rows = participations ?? [];
      if (rows.length === 0) {
        setExhibitors([]);
        return;
      }

      // ✅ AMÉLIORATION: Utiliser exhibitor_uuid directement s'il est présent (UUID valide)
      // Cela évite les duplications car on utilise l'ID réel de la table exhibitors
      const isValidUUID = (str: string | null | undefined): boolean => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // Mapper les résultats en utilisant exhibitor_uuid en priorité
      const formatted: DbExhibitor[] = rows.map(p => {
        // Priorité: exhibitor_uuid (si UUID valide) > id_exposant (si UUID valide) > id_exposant brut
        const exhibitorUuid = p.exhibitor_uuid ? String(p.exhibitor_uuid) : null;
        const idExposant = p.id_exposant;
        
        let id: string;
        let approved = false;
        
        if (isValidUUID(exhibitorUuid)) {
          // L'exposant a un UUID valide dans la table exhibitors
          id = exhibitorUuid!;
          approved = p.approved === true;
        } else if (isValidUUID(idExposant)) {
          // id_exposant est un UUID (exposant créé via exhibitors-manage)
          id = idExposant!;
          approved = p.approved === true;
        } else {
          // Legacy: id_exposant est un identifiant texte
          id = idExposant || '';
          approved = false;
        }
        
        return {
          id,
          name: p.name_final || p.exhibitor_name || idExposant || '',
          website: p.website_final || p.exhibitor_website || '',
          logo_url: p.logo_url || undefined,
          approved,
          stand_info: p.stand_exposant || undefined,
        };
      }).filter(e => e.name && e.id); // Filtrer ceux sans nom ou sans ID

      // ✅ Dédupliquer par ID pour éviter les doublons
      const uniqueExhibitors = Array.from(
        new Map(formatted.map(e => [e.id, e])).values()
      );

      console.log('[Step1ExhibitorAndUser] Loaded exhibitors:', uniqueExhibitors.length, 'unique from', formatted.length);
      setExhibitors(uniqueExhibitors);

      // ── Catalogue Lotexpo : entreprises déjà connues, hors event en cours ──
      //    Affichées si la recherche ne renvoie rien dans les exposants de l'événement.
      if (s) {
        const eventExhibitorIds = new Set(uniqueExhibitors.map(e => e.id));
        const { data: globals, error: globErr } = await supabase
          .from('exhibitors')
          .select('id, name, website, logo_url, approved, stand_info')
          .ilike('name', `%${s}%`)
          .not('name', 'ilike', '[ARCHIVED]%')
          .order('approved', { ascending: false })
          .order('name', { ascending: true })
          .limit(20);
        if (!globErr && globals) {
          const filteredGlobals: DbExhibitor[] = globals
            .filter(g => !eventExhibitorIds.has(g.id))
            .map(g => ({
              id: g.id,
              name: g.name,
              website: g.website || undefined,
              logo_url: g.logo_url || undefined,
              approved: g.approved === true,
              stand_info: g.stand_info || undefined,
              needs_participation: true,
            }));
          setGlobalExhibitors(filteredGlobals);
        } else {
          setGlobalExhibitors([]);
        }
      } else {
        setGlobalExhibitors([]);
      }
    } catch (error) {
      console.error('[Step1ExhibitorAndUser] Exception', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les exposants',
        variant: 'destructive'
      });
      setExhibitors([]);
    } finally {
      setLoading(false);
    }
  };

  // Résolution live entreprise candidate (read-only, ne crée rien)
  useEffect(() => {
    if (!showNewExhibitorForm) { setCandidateMatch(null); return; }
    // Une entreprise « ancienne base » a déjà été confirmée : on ne ré-affiche pas la suggestion.
    if (confirmedLegacyMatch) { setCandidateMatch(null); return; }
    const name = (debouncedNewName || '').trim();
    const website = (debouncedNewWebsite || '').trim();
    if (name.length < 2 && website.length < 4) {
      setCandidateMatch(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setResolveLoading(true);
        const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
          body: {
            action: 'resolve_candidate',
            name: name || undefined,
            website: website || undefined,
            event_id: event?.id ?? undefined,
          },
        });
        if (cancelled) return;
        if (error) { setCandidateMatch(null); return; }
        const m = data as ResolveCandidateMatch;
        // On n'affiche que les matchs fiables (high) ou legacy explicite
        if (m?.match_found && (m.confidence === 'high' || m.match_type === 'legacy')) {
          setCandidateMatch(m);
        } else {
          setCandidateMatch(null);
        }
      } catch {
        if (!cancelled) setCandidateMatch(null);
      } finally {
        if (!cancelled) setResolveLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedNewName, debouncedNewWebsite, showNewExhibitorForm, event?.id, confirmedLegacyMatch]);

  const handleUseExistingMatch = (m: ResolveCandidateMatch) => {
    // Cas legacy : on garde la saisie utilisateur mais on flag legacy_id_exposant
    if (m.match_type === 'legacy' || !m.exhibitor_id) {
      // L'utilisateur continue avec le formulaire ; au submit, l'edge function
      // promouvera la fiche legacy via legacy_id_exposant.
      setNewExhibitorData(prev => ({
        ...prev,
        name: m.exhibitor_name || prev.name,
        website: m.website || prev.website,
      }));
      // Confirmation visible + masquage de la suggestion
      setConfirmedLegacyMatch(m);
      setCandidateMatch(null);
      toast({
        title: 'Entreprise sélectionnée',
        description: `${m.exhibitor_name || 'Cette entreprise'} sera réutilisée. Complétez les informations ci-dessous puis continuez.`,
      });
      return;
    }
    // Cas moderne : sélectionner directement et masquer le formulaire (skip desc/logo)
    setSelectedExhibitor({
      id: m.exhibitor_id,
      name: m.exhibitor_name || '',
      website: m.website || undefined,
      logo_url: m.logo_url || undefined,
      approved: m.approved,
      needs_participation: !m.already_participating_to_event,
    });
    setShowNewExhibitorForm(false);
    setCandidateMatch(null);
    setNewExhibitorData({ name: '', website: '', description: '', stand_info: '', logo: null });
    toast({
      title: 'Entreprise sélectionnée',
      description: `${m.exhibitor_name || 'Cette entreprise'} a bien été sélectionnée.`,
    });
  };

  const handleExhibitorSelect = (exhibitor: DbExhibitor) => {
    setSelectedExhibitor(exhibitor);
    setSelectedExhibitorStandInfo(exhibitor.stand_info || '');
    setShowNewExhibitorForm(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Type de fichier invalide',
        description: 'Seules les images sont autorisées',
        variant: 'destructive'
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast({
        title: 'Fichier trop volumineux',
        description: 'Taille maximum: 2MB',
        variant: 'destructive'
      });
      return;
    }

    console.log('📸 Logo changé dans Step1:', {
      file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      isFile: file instanceof File,
      forNewExhibitor: showNewExhibitorForm,
      forExistingExhibitor: !!selectedExhibitor
    });

    if (showNewExhibitorForm) {
      setNewExhibitorData(prev => ({ ...prev, logo: file }));
    } else if (selectedExhibitor) {
      console.log('📁 Logo sélectionné pour exposant existant:', file.name);
      setSelectedExhibitorLogo(file);
      // ✅ IMPORTANT : Mettre à jour aussi newExhibitorData.logo
      setNewExhibitorData(prev => ({ ...prev, logo: file }));
    }
  };

  const resetSelection = () => {
    setSelectedExhibitor(null);
    setSelectedExhibitorStandInfo('');
    // Si l'événement n'a aucun exposant connu, on garde le formulaire de création ouvert
    // (sinon l'utilisateur tomberait sur une recherche vide).
    setShowNewExhibitorForm(eventHasAnyExhibitor === false);
    setNewExhibitorData({ name: '', website: '', description: '', stand_info: '', logo: null });
    setCandidateMatch(null);
  };

  // Adapter l'UX selon la disponibilité d'exposants pour cet événement
  const noExhibitorsForEvent = eventHasAnyExhibitor === false;

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
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building className="h-5 w-5 text-primary" />
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
                      className="flex items-center justify-center w-full h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent transition-colors"
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
              {resolveLoading && !candidateMatch && (
                <p className="text-xs text-muted-foreground">Recherche d'une entreprise existante…</p>
              )}
              {candidateMatch && (
                <ExistingCompanyCard match={candidateMatch} onUse={handleUseExistingMatch} />
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
                    className="flex items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-accent transition-colors"
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
                    className="cursor-pointer hover:bg-accent transition-colors"
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
                    className="cursor-pointer hover:bg-accent transition-colors border-dashed"
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