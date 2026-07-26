import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useNoveltyQuota } from '@/hooks/useNoveltyQuota';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Step1Data } from '@/lib/validation/noveltySchemas';
import { CONSUMER_EMAIL_DOMAINS } from '@/lib/validation/noveltySchemas';
import type { Event } from '@/types/event';
import type { ResolveCandidateMatch } from '@/components/novelty/ExistingCompanyCard';

export interface DbExhibitor {
  id: string;
  name: string;
  website?: string;
  logo_url?: string;
  approved: boolean;
  stand_info?: string;
  /** true si la fiche existe sur Lotexpo mais pas encore rattachée à cet événement */
  needs_participation?: boolean;
}

export interface NewExhibitorData {
  name: string;
  website: string;
  description: string;
  stand_info: string;
  logo: File | null;
}

export interface UserIdentityData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

interface UseExhibitorSelectionParams {
  event: Event;
  onChange: (data: Partial<Step1Data>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export function isProfessionalEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain && !CONSUMER_EMAIL_DOMAINS.includes(domain);
}

/**
 * Logique (sans présentation) de la sélection / création d'exposant et de
 * l'identification utilisateur pour la création d'une nouveauté.
 *
 * ⚠️ Mécanique sensible : anti-doublon (resolve_candidate), migration legacy
 * (legacy_id_exposant), catalogue Lotexpo (needs_participation → ensure_participation),
 * quota, création différée. Ne pas altérer le comportement.
 */
export function useExhibitorSelection({
  event,
  onChange,
  onValidationChange,
}: UseExhibitorSelectionParams) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Identifiant d'événement tolérant aux deux formes (id_event texte ou id)
  const resolvedEventId = ((event as any)?.id_event || (event as any)?.id || '') as string;
  console.log('[DIAG event] event brut =', JSON.stringify(event));
  console.log('[DIAG event] resolvedEventId =', resolvedEventId, '| event.id =', (event as any)?.id, '| event.id_event =', (event as any)?.id_event);

  const [exhibitors, setExhibitors] = useState<DbExhibitor[]>([]);
  const [globalExhibitors, setGlobalExhibitors] = useState<DbExhibitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [loading, setLoading] = useState(false);
  const [showNewExhibitorForm, setShowNewExhibitorForm] = useState(false);
  const [selectedExhibitor, setSelectedExhibitor] = useState<DbExhibitor | null>(null);
  const [selectedExhibitorLogo, setSelectedExhibitorLogo] = useState<File | null>(null);
  const [selectedExhibitorStandInfo, setSelectedExhibitorStandInfo] = useState<string>('');
  // Droits de l'utilisateur sur l'exposant sélectionné (résolus côté serveur)
  const [selectedExhibitorRights, setSelectedExhibitorRights] = useState<{
    has_admin: boolean;
    current_user_can_create_novelty: boolean;
  } | null>(null);
  const [selectedRightsLoading, setSelectedRightsLoading] = useState(false);
  // ✅ Track whether the event has any exhibitor at all (independent of search filter)
  const [eventHasAnyExhibitor, setEventHasAnyExhibitor] = useState<boolean | null>(null);

  // Vérifier le quota pour l'exposant sélectionné
  const { data: quota } = useNoveltyQuota(selectedExhibitor?.id, event?.id);

  // New exhibitor form data
  const [newExhibitorData, setNewExhibitorData] = useState<NewExhibitorData>({
    name: '',
    website: '',
    description: '',
    stand_info: '',
    logo: null,
  });

  // Détection live d'entreprise existante quand l'utilisateur remplit le formulaire
  // « Créer une nouvelle entreprise ». Évite les doublons et les pertes de saisie.
  const debouncedNewName = useDebounce(newExhibitorData.name, 500);
  const debouncedNewWebsite = useDebounce(newExhibitorData.website, 500);
  const [candidateMatch, setCandidateMatch] = useState<ResolveCandidateMatch | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  // Match « ancienne base » confirmé par l'utilisateur (clic sur « Utiliser cette entreprise »).
  const [confirmedLegacyMatch, setConfirmedLegacyMatch] = useState<ResolveCandidateMatch | null>(null);

  // User form data (if not logged in)
  const [userData, setUserData] = useState<UserIdentityData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
  });

  // Load exhibitors on mount and when search changes
  useEffect(() => {
    loadExhibitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, resolvedEventId]);

  // Bloquer si un match existant est administré par un autre utilisateur
  const blockedByAdminMatch = !!(
    !selectedExhibitor &&
    candidateMatch &&
    candidateMatch.has_admin &&
    !candidateMatch.current_user_can_create_novelty
  );

  // Blocage lors de la sélection directe d'un exposant existant
  const blockedBySelectedExhibitor = !!(
    selectedExhibitor &&
    selectedExhibitorRights &&
    selectedExhibitorRights.has_admin &&
    !selectedExhibitorRights.current_user_can_create_novelty
  );

  const blockedByAdmin = blockedByAdminMatch || blockedBySelectedExhibitor;

  // Vérification des droits dès qu'un exposant existant est sélectionné
  useEffect(() => {
    if (!selectedExhibitor) {
      setSelectedExhibitorRights(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setSelectedRightsLoading(true);
        const { data, error } = await supabase.functions.invoke('exhibitors-manage', {
          body: {
            action: 'resolve_candidate',
            name: selectedExhibitor.name || undefined,
            website: selectedExhibitor.website || undefined,
            event_id: resolvedEventId || undefined,
          },
        });
        if (cancelled) return;
        if (error || !data) {
          setSelectedExhibitorRights(null);
          return;
        }
        const m = data as ResolveCandidateMatch;
        setSelectedExhibitorRights({
          has_admin: !!m.has_admin,
          current_user_can_create_novelty: !!m.current_user_can_create_novelty,
        });
      } catch {
        if (!cancelled) setSelectedExhibitorRights(null);
      } finally {
        if (!cancelled) setSelectedRightsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExhibitor?.id, selectedExhibitor?.name, selectedExhibitor?.website, resolvedEventId]);

  // Validate form data
  useEffect(() => {
    const hasExhibitor = selectedExhibitor || (newExhibitorData.name && newExhibitorData.website);
    const hasUserData =
      !!user ||
      !!(userData.first_name && userData.last_name && userData.email && userData.phone && userData.role);

    // Validate professional email if provided
    const emailValid = !userData.email || isProfessionalEmail(userData.email);

    // Bloquer la validation si quota dépassé pour l'exposant sélectionné
    const quotaOk = !selectedExhibitor || !quota || quota.allowed;

    const blocked = !!(
      (!selectedExhibitor &&
        candidateMatch &&
        candidateMatch.has_admin &&
        !candidateMatch.current_user_can_create_novelty) ||
      (selectedExhibitor &&
        selectedExhibitorRights &&
        selectedExhibitorRights.has_admin &&
        !selectedExhibitorRights.current_user_can_create_novelty)
    );

    const isValid = hasExhibitor && hasUserData && emailValid && quotaOk && !blocked;
    onValidationChange(isValid);

    // Update parent data - Always send valid structure
    if (hasExhibitor && hasUserData && emailValid && quotaOk) {
      const exhibitorData = selectedExhibitor
        ? {
            id: selectedExhibitor.id,
            name: selectedExhibitor.name,
            website: selectedExhibitor.website || '',
            approved: selectedExhibitor.approved,
            logo: selectedExhibitorLogo || newExhibitorData.logo,
            stand_info: selectedExhibitorStandInfo || selectedExhibitor.stand_info || '',
            // ✅ DEDUP : si l'id sélectionné est un id legacy (non UUID), on le transmet
            legacy_id_exposant: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              selectedExhibitor.id
            )
              ? null
              : selectedExhibitor.id,
            // ✅ catalogue Lotexpo → ensure_participation avant la création
            needs_participation: selectedExhibitor.needs_participation === true,
          }
        : {
            name: newExhibitorData.name,
            website: newExhibitorData.website || '',
            description: newExhibitorData.description || '',
            stand_info: newExhibitorData.stand_info || '',
            logo: newExhibitorData.logo,
          };

      onChange({
        exhibitor: exhibitorData,
        user: user
          ? undefined
          : {
              first_name: userData.first_name || '',
              last_name: userData.last_name || '',
              email: userData.email || '',
              phone: userData.phone || '',
              role: userData.role || '',
            },
      });
    }
  }, [
    selectedExhibitor,
    newExhibitorData,
    userData,
    user,
    quota,
    onChange,
    onValidationChange,
    selectedExhibitorLogo,
    selectedExhibitorStandInfo,
    candidateMatch,
    selectedExhibitorRights,
  ]);

  const loadExhibitors = async () => {
    try {
      setLoading(true);

      const eventId = resolvedEventId || null;
      if (!eventId) {
        console.warn('[useExhibitorSelection] Aucun id_event défini');
        setExhibitors([]);
        setEventHasAnyExhibitor(false);
        return;
      }

      // ✅ Vérifier (une seule fois) si l'événement a au moins un exposant
      if (eventHasAnyExhibitor === null) {
        const { count } = await supabase
          .from('participations_with_exhibitors')
          .select('id_exposant', { count: 'exact', head: true })
          .eq('id_event_text', eventId);
        const hasAny = (count ?? 0) > 0;
        setEventHasAnyExhibitor(hasAny);
        if (!hasAny) {
          setShowNewExhibitorForm(true);
        }
      }

      let q = supabase
        .from('participations_with_exhibitors')
        .select(
          'id_exposant, exhibitor_uuid, exhibitor_name, name_final, exhibitor_website, website_final, stand_exposant, approved, logo_url'
        )
        .eq('id_event_text', eventId)
        .order('name_final', { ascending: true, nullsFirst: false });

      const s = debouncedSearch?.trim();
      console.log('[DIAG catalogue] terme de recherche s =', JSON.stringify(s), '| longueur =', s?.length);
      if (s) q = q.ilike('name_final', `%${s}%`);

      const { data: participations, error: partErr } = await q;
      console.log('[DIAG event] requête salon : eventId utilisé =', eventId, '| participations reçues =', participations?.length, '| erreur =', partErr);
      if (partErr) {
        console.error('[useExhibitorSelection] participations error', partErr);
        throw partErr;
      }

      const rows = participations ?? [];
      const isValidUUID = (str: string | null | undefined): boolean => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      const formatted: DbExhibitor[] = rows
        .map((p) => {
          const exhibitorUuid = p.exhibitor_uuid ? String(p.exhibitor_uuid) : null;
          const idExposant = p.id_exposant;

          let id: string;
          let approved = false;

          if (isValidUUID(exhibitorUuid)) {
            id = exhibitorUuid!;
            approved = p.approved === true;
          } else if (isValidUUID(idExposant)) {
            id = idExposant!;
            approved = p.approved === true;
          } else {
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
        })
        .filter((e) => e.name && e.id);

      const uniqueExhibitors = Array.from(new Map(formatted.map((e) => [e.id, e])).values());

      setExhibitors(uniqueExhibitors);

      // ── Catalogue Lotexpo : entreprises déjà connues, hors event en cours ──
      if (s) {
        const eventExhibitorIds = new Set(uniqueExhibitors.map((e) => e.id));
        console.log('[DIAG catalogue] lancement requête catalogue pour', s);
        const { data: globals, error: globErr } = await supabase
          .from('exhibitors')
          .select('id, name, website, logo_url, approved, stand_info')
          .ilike('name', `%${s}%`)
          .not('name', 'ilike', '[ARCHIVED]%')
          .order('approved', { ascending: false })
          .order('name', { ascending: true })
          .limit(20);
        console.log('[DIAG catalogue] réponse brute globals =', globals?.length, 'résultats', globals?.map((g) => g.name));
        console.log('[DIAG catalogue] erreur éventuelle =', globErr);
        if (!globErr && globals) {
          const filteredGlobals: DbExhibitor[] = globals
            .filter((g) => !eventExhibitorIds.has(g.id))
            .map((g) => ({
              id: g.id,
              name: g.name,
              website: g.website || undefined,
              logo_url: g.logo_url || undefined,
              approved: g.approved === true,
              stand_info: g.stand_info || undefined,
              needs_participation: true,
            }));
          console.log('[DIAG catalogue] après filtrage (retrait des exposants déjà sur le salon) =', filteredGlobals.length, filteredGlobals.map((g) => g.name));
          console.log('[DIAG catalogue] ids exposants du salon exclus =', Array.from(eventExhibitorIds));
          setGlobalExhibitors(filteredGlobals);
        } else {
          setGlobalExhibitors([]);
        }
      } else {
        setGlobalExhibitors([]);
      }
    } catch (error) {
      console.error('[useExhibitorSelection] Exception', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les exposants',
        variant: 'destructive',
      });
      setExhibitors([]);
    } finally {
      setLoading(false);
    }
  };

  // Résolution live entreprise candidate (read-only, ne crée rien)
  useEffect(() => {
    if (!showNewExhibitorForm) {
      setCandidateMatch(null);
      return;
    }
    if (confirmedLegacyMatch) {
      setCandidateMatch(null);
      return;
    }
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
        if (error) {
          setCandidateMatch(null);
          return;
        }
        const m = data as ResolveCandidateMatch;
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
    return () => {
      cancelled = true;
    };
  }, [debouncedNewName, debouncedNewWebsite, showNewExhibitorForm, event?.id, confirmedLegacyMatch]);

  const handleUseExistingMatch = (m: ResolveCandidateMatch) => {
    // Cas legacy : on garde la saisie utilisateur mais on flag legacy_id_exposant
    if (m.match_type === 'legacy' || !m.exhibitor_id) {
      setNewExhibitorData((prev) => ({
        ...prev,
        name: m.exhibitor_name || prev.name,
        website: m.website || prev.website,
      }));
      setConfirmedLegacyMatch(m);
      setCandidateMatch(null);
      toast({
        title: 'Entreprise sélectionnée',
        description: `${m.exhibitor_name || 'Cette entreprise'} sera réutilisée. Complétez les informations ci-dessous puis continuez.`,
      });
      return;
    }
    // Cas moderne : sélectionner directement et masquer le formulaire
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
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Fichier trop volumineux',
        description: 'Taille maximum: 2MB',
        variant: 'destructive',
      });
      return;
    }

    if (showNewExhibitorForm) {
      setNewExhibitorData((prev) => ({ ...prev, logo: file }));
    } else if (selectedExhibitor) {
      setSelectedExhibitorLogo(file);
      setNewExhibitorData((prev) => ({ ...prev, logo: file }));
    }
  };

  const resetSelection = () => {
    setSelectedExhibitor(null);
    setSelectedExhibitorStandInfo('');
    setSelectedExhibitorRights(null);
    setShowNewExhibitorForm(eventHasAnyExhibitor === false);
    setNewExhibitorData({ name: '', website: '', description: '', stand_info: '', logo: null });
    setCandidateMatch(null);
    setConfirmedLegacyMatch(null);
  };

  // Adapter l'UX selon la disponibilité d'exposants pour cet événement
  const noExhibitorsForEvent = eventHasAnyExhibitor === false;

  return {
    user,
    // listes
    exhibitors,
    globalExhibitors,
    loading,
    // recherche
    searchQuery,
    setSearchQuery,
    // sélection
    selectedExhibitor,
    selectedExhibitorLogo,
    selectedExhibitorStandInfo,
    setSelectedExhibitorStandInfo,
    handleExhibitorSelect,
    resetSelection,
    // création
    showNewExhibitorForm,
    setShowNewExhibitorForm,
    newExhibitorData,
    setNewExhibitorData,
    handleLogoUpload,
    // anti-doublon
    candidateMatch,
    resolveLoading,
    confirmedLegacyMatch,
    setConfirmedLegacyMatch,
    handleUseExistingMatch,
    blockedByAdminMatch,
    blockedBySelectedExhibitor,
    blockedByAdmin,
    selectedExhibitorRights,
    selectedRightsLoading,
    // quota
    quota,
    // identité
    userData,
    setUserData,
    isProfessionalEmail,
    // contexte
    noExhibitorsForEvent,
    eventHasAnyExhibitor,
  };
}
