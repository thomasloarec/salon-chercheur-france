import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNoveltyQuota } from '@/hooks/useNoveltyQuota';
import { NoveltyLimitDialog } from './NoveltyLimitDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Event } from '@/types/event';
import type { Step1Data, Step2Data } from '@/lib/validation/noveltySchemas';
import { step1Schema, step2Schema, CONSUMER_EMAIL_DOMAINS } from '@/lib/validation/noveltySchemas';
import { uploadNoveltyImages, uploadNoveltyResource, cleanupFailedUploads } from '@/lib/novelty/uploads';
import Step1ExhibitorAndUser from './steps/Step1ExhibitorAndUser';
import Step2NoveltyDetails from './steps/Step2NoveltyDetails';

interface AddNoveltyStepperProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
}

type CurrentStep = 1 | 2;

interface StepperState {
  step1Data: Partial<Step1Data>;
  step2Data: Partial<Step2Data>;
  step1Valid: boolean;
  step2Valid: boolean;
}

export default function AddNoveltyStepper({ isOpen, onClose, event }: AddNoveltyStepperProps) {
  const { user, signIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState<CurrentStep>(1);
  const [loading, setLoading] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    message: string;
    noveltyId?: string;
  } | null>(null);

  // ✅ Ref pour capturer le logo avant qu'il soit perdu dans les mises à jour d'état
  const exhibitorLogoFileRef = useRef<File | null>(null);

  // Form state
  const [state, setState] = useState<StepperState>({
    step1Data: {},
    step2Data: {},
    step1Valid: false,
    step2Valid: false,
  });

  // Vérifier le quota pour l'exposant sélectionné
  const selectedExhibitorId = state.step1Data.exhibitor && 'id' in state.step1Data.exhibitor 
    ? state.step1Data.exhibitor.id 
    : undefined;
  const { data: quota } = useNoveltyQuota(selectedExhibitorId, event?.id);

  // ✅ ALWAYS reset to step 1 when modal opens
  useEffect(() => {
    if (isOpen) {
      // Toujours réinitialiser à l'étape 1 à l'ouverture
      setCurrentStep(1);
      
      // Réinitialiser l'état complet pour éviter les données stales
      setState({
        step1Data: {},
        step2Data: {},
        step1Valid: false,
        step2Valid: false,
      });
      
      // Nettoyer le localStorage pour éviter de reprendre un ancien état
      localStorage.removeItem('addNoveltyStepperState');
      
      // Réinitialiser les erreurs et résultats précédents
      setFieldErrors({});
      setSubmissionResult(null);
      exhibitorLogoFileRef.current = null;
    }
  }, [isOpen]);

  // Save state to localStorage
  const saveState = () => {
    localStorage.setItem('addNoveltyStepperState', JSON.stringify({
      step1Data: state.step1Data,
      step2Data: state.step2Data,
      step1Valid: state.step1Valid,
      step2Valid: state.step2Valid,
    }));
  };

  // Update step 1 data
  const handleStep1Change = (data: Partial<Step1Data>) => {
    console.log('🔄 Step1 update reçu:', {
      hasExhibitor: !!data.exhibitor,
      exhibitorKeys: data.exhibitor ? Object.keys(data.exhibitor) : [],
      hasLogoInData: !!(data.exhibitor as any)?.logo,
      logoType: (data.exhibitor as any)?.logo?.constructor?.name
    });

    // ✅ Capturer le logo dans le ref AVANT qu'il soit perdu
    if (data.exhibitor && 'logo' in data.exhibitor) {
      const logo = (data.exhibitor as any).logo;
      if (logo instanceof File) {
        console.log('✅ Logo capturé dans ref:', logo.name);
        exhibitorLogoFileRef.current = logo;
      }
    }

    setState(prev => ({ ...prev, step1Data: { ...prev.step1Data, ...data } }));
  };

  const handleStep1ValidationChange = (isValid: boolean) => {
    setState(prev => ({ ...prev, step1Valid: isValid }));
  };

  // Update step 2 data
  const handleStep2Change = (data: Partial<Step2Data>) => {
    setState(prev => ({ ...prev, step2Data: { ...prev.step2Data, ...data } }));
  };

  const handleStep2ValidationChange = (isValid: boolean) => {
    setState(prev => ({ ...prev, step2Valid: isValid }));
  };

  // Navigate to next step
  const handleNext = async () => {
    if (currentStep === 1) {
      // Clear any previous errors
      setFieldErrors({});
      
      // Vérifier le quota AVANT de passer à l'étape 2
      if (quota && !quota.allowed) {
        setShowLimitDialog(true);
        return;
      }
      
      // Handle authentication if needed
      if (!user && state.step1Data.user) {
        await handleAuthenticationFlow();
      } else {
        saveState();
        setCurrentStep(2);
      }
    }
  };

  // Handle authentication flow - inline signup
  const handleAuthenticationFlow = async () => {
    const userData = state.step1Data.user;
    if (!userData?.email) return;

    try {
      setLoading(true);
      
      // Sign up with temporary password and user metadata
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: Math.random().toString(36).slice(-12), // Random password
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone,
            role: userData.role,
          }
        }
      });
      
      if (error) {
        toast({
          title: 'Erreur d\'inscription',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      // Send password reset link for the user to set their password
      await supabase.auth.resetPasswordForEmail(userData.email, {
        redirectTo: `${window.location.origin}/`
      });

      // Create exhibitor if needed
      if (state.step1Data.exhibitor && 'name' in state.step1Data.exhibitor) {
        // Upload logo si présent
        let logoUrl: string | null = null;
        if ('logo' in state.step1Data.exhibitor && state.step1Data.exhibitor.logo instanceof File) {
          const logoFile = state.step1Data.exhibitor.logo;
          const fileName = `${Date.now()}-${sanitizeFileName(logoFile.name)}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, logoFile);
          
          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName);
            logoUrl = publicUrl.publicUrl;
          }
        }

        const { data: newExhibitor, error: exhibitorError } = await supabase.functions.invoke('exhibitors-manage', {
          body: {
            action: 'create',
            name: state.step1Data.exhibitor.name,
            website: state.step1Data.exhibitor.website,
            stand_info: 'stand_info' in state.step1Data.exhibitor ? state.step1Data.exhibitor.stand_info : undefined,
            logo_url: logoUrl,
            event_id: event.id
          }
        });

        if (!exhibitorError && newExhibitor) {
          // Update state with created exhibitor
          setState(prev => ({
            ...prev,
            step1Data: {
              ...prev.step1Data,
              exhibitor: { 
                id: newExhibitor.id, 
                name: newExhibitor.name, 
                website: newExhibitor.website,
                approved: newExhibitor.approved
              }
            }
          }));
        }
      }

      toast({
        title: 'Compte créé',
        description: 'Un email de vérification et de définition de mot de passe a été envoyé. Vous pouvez continuer l\'ajout de votre nouveauté.',
      });
      
      saveState();
      setCurrentStep(2);
      
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le compte.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to sanitize file names
  const sanitizeFileName = (fileName: string): string => {
    return fileName
      // Remplacer les accents
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Remplacer les espaces par des underscores
      .replace(/\s+/g, '_')
      // Supprimer les caractères spéciaux sauf . _ -
      .replace(/[^a-zA-Z0-9._-]/g, '')
      // Éviter les points multiples
      .replace(/\.+/g, '.')
      // Éviter les underscores multiples
      .replace(/_+/g, '_')
      // Supprimer les caractères en début/fin
      .replace(/^[._-]+|[._-]+$/g, '')
      // Limiter la longueur
      .substring(0, 100);
  };

  // Upload files utility
  const uploadFiles = async (files: File[], folder: 'images' | 'brochures'): Promise<string[]> => {
    const uploadPromises = files.map(async (file) => {
      const cleanFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${cleanFileName}`;
      const filePath = `${folder}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('novelties')
        .upload(filePath, file);
      
      if (error) {
        console.error(`Erreur upload ${file.name}:`, error);
        throw error;
      }
      
      const { data: publicUrl } = supabase.storage
        .from('novelties')
        .getPublicUrl(filePath);
        
      return publicUrl.publicUrl;
    });
    
    return Promise.all(uploadPromises);
  };

  // Submit the complete form
  const handleSubmit = async () => {
    if (!state.step1Valid || !state.step2Valid) {
      toast({
        title: 'Formulaire incomplet',
        description: 'Veuillez remplir tous les champs requis.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      console.group('🐛 DEBUG DÉTAILLÉ - Création nouveauté');
      
      // 1. Debug des données Step 1 et Step 2
      console.log('📋 Step 1 Data:', state.step1Data);
      console.log('📋 Step 2 Data RAW:', state.step2Data);
      console.log('📋 Current Event:', event ? {
        id: event.id,
        nom_event: event.nom_event,
        slug: event.slug
      } : null);
      console.log('📋 Current User:', user ? {
        id: user.id,
        email: user.email
      } : null);
      
      // Validate schemas
      const step1Result = step1Schema.safeParse(state.step1Data);
      const step2Result = step2Schema.safeParse(state.step2Data);

      if (!step1Result.success || !step2Result.success) {
        console.error('❌ Schema validation failed:');
        console.error('Step1 errors:', step1Result.success ? 'OK' : step1Result.error.issues);
        console.error('Step2 errors:', step2Result.success ? 'OK' : step2Result.error.issues);
        toast({
          title: 'Données invalides',
          description: 'Veuillez vérifier vos informations.',
          variant: 'destructive'
        });
        return;
      }

      const step1 = step1Result.data;
      const step2 = step2Result.data;

      // Helper to check if string is valid UUID
      const isValidUUID = (str: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // 2. Vérifications pré-upload
      console.log('🔍 Vérifications pre-upload:');
      console.log('- Images:', step2.images?.map(img => ({
        name: img instanceof File ? img.name : 'string',
        type: typeof img,
        size: img instanceof File ? img.size : 'N/A',
        isFile: img instanceof File
      })));
      console.log('- PDF:', step2.brochure ? {
        name: step2.brochure instanceof File ? step2.brochure.name : 'string',
        type: typeof step2.brochure,
        size: step2.brochure instanceof File ? step2.brochure.size : 'N/A',
        isFile: step2.brochure instanceof File
      } : 'Aucun PDF');

      // Get or create exhibitor
      let exhibitorId: string;
      let pendingExhibitorId: string | null = null; // Nouvel exposant en attente d'approbation

      if ('id' in step1.exhibitor && isValidUUID(step1.exhibitor.id)) {
        // Existing exhibitor with valid UUID
        exhibitorId = step1.exhibitor.id;
        console.log('📋 Exposant existant:', { id: exhibitorId });
      } else {
        // Create new exhibitor (either no ID or ID is not a valid UUID)
        // Extract properties safely - step1.exhibitor can be either type
        const exhibitorToCreate = step1.exhibitor as any;
        const exhibitorName = exhibitorToCreate.name || '';
        const exhibitorWebsite = exhibitorToCreate.website || null;
        const exhibitorStandInfo = exhibitorToCreate.stand_info || null;
        const exhibitorDescription = exhibitorToCreate.description || null;
        
        // ✅ DEBUG : Vérifier que la description est bien présente
        console.log('🔍 DEBUG Création exposant - Données reçues:', {
          name: exhibitorName,
          website: exhibitorWebsite,
          description: exhibitorDescription,
          description_length: exhibitorDescription?.length || 0,
          stand_info: exhibitorStandInfo,
          has_logo: exhibitorToCreate.logo instanceof File
        });
        
        // Upload logo si présent - ✅ UTILISER LE REF car File n'est pas sérialisable en localStorage
        let logoUrl: string | null = null;
        const logoFile = exhibitorLogoFileRef.current || (exhibitorToCreate.logo instanceof File ? exhibitorToCreate.logo : null);
        
        if (logoFile instanceof File) {
          console.log('📤 Upload logo exposant (nouvel exposant):', logoFile.name);
          const fileName = `${Date.now()}-${sanitizeFileName(logoFile.name)}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, logoFile);
          
          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName);
            logoUrl = publicUrl.publicUrl;
            console.log('✅ Logo uploadé:', logoUrl);
          } else {
            console.error('❌ Erreur upload logo:', uploadError);
          }
        } else {
          console.log('⚠️ Pas de logo à uploader pour le nouvel exposant');
        }
        
        console.log('🆕 Création nouvel exposant:', exhibitorName);
        const { data: newExhibitor, error: exhibitorError } = await supabase.functions.invoke('exhibitors-manage', {
          body: {
            action: 'create',
            name: exhibitorName,
            website: exhibitorWebsite,
            description: exhibitorDescription,
            stand_info: exhibitorStandInfo,
            logo_url: logoUrl,
            event_id: event.id,
            // ✅ Ne pas créer la participation maintenant - elle sera créée quand la nouveauté sera publiée
            defer_participation: true
          }
        });
        
        // ✅ DEBUG : Log complet de la requête
        console.log('📤 Requête exhibitors-manage:', {
          action: 'create',
          name: exhibitorName,
          website: exhibitorWebsite,
          description: exhibitorDescription,
          description_present: !!exhibitorDescription,
          description_length: exhibitorDescription?.length || 0,
          stand_info: exhibitorStandInfo,
          logo_url: logoUrl ? 'présent' : 'absent',
          event_id: event.id
        });

        if (exhibitorError || !newExhibitor) {
          console.error('❌ Erreur création exposant:', exhibitorError);
          throw new Error(exhibitorError?.message || 'Impossible de créer l\'exposant');
        }

        exhibitorId = newExhibitor.id;
        // ✅ IMPORTANT: Tracker que cet exposant est nouveau et en attente
        // Il sera approuvé uniquement quand la nouveauté sera publiée par l'admin
        pendingExhibitorId = newExhibitor.id;
        console.log('✅ Nouvel exposant créé (en attente):', { id: exhibitorId, pendingExhibitorId });
        
        // Note: On n'invalide PAS le cache ici car l'exposant n'est pas encore approuvé
        // Il sera visible après la validation de la nouveauté
      }

      // Mettre à jour le logo pour un exposant existant si fourni
      if ('id' in step1.exhibitor && isValidUUID(step1.exhibitor.id)) {
        const exhibitorIdForLogo = step1.exhibitor.id;
        
        // ✅ Récupérer le logo depuis le ref au lieu de l'objet
        const pendingLogo = exhibitorLogoFileRef.current;
        
        console.log('🔍 DEBUG Logo exposant existant:', {
          hasId: true,
          exhibitorId: exhibitorIdForLogo,
          hasLogoInRef: !!pendingLogo,
          logoType: pendingLogo?.constructor?.name,
          isFile: pendingLogo instanceof File,
          fileName: pendingLogo?.name,
          fileSize: pendingLogo?.size
        });
        
        if (pendingLogo instanceof File) {
          console.log('📤 Upload logo pour exposant existant:', step1.exhibitor.name);
          
          const fileName = `${exhibitorIdForLogo}/${Date.now()}-${sanitizeFileName(pendingLogo.name)}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, pendingLogo, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (uploadError) {
            console.error('❌ Erreur upload logo:', uploadError);
            toast({
              title: "Erreur d'upload",
              description: "Le logo n'a pas pu être uploadé.",
              variant: "destructive"
            });
          } else if (uploadData) {
            const { data: publicUrl } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            
            const logoUrl = publicUrl.publicUrl;
            console.log('✅ Logo uploadé:', logoUrl);
            
            // Mise à jour dans exhibitors
            const { error: updateError } = await supabase
              .from('exhibitors')
              .update({ 
                logo_url: logoUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', exhibitorIdForLogo);
            
            if (updateError) {
              console.error('❌ Erreur MAJ logo exhibitor:', updateError);
            } else {
              console.log('✅ Logo sauvegardé dans exhibitor:', exhibitorIdForLogo);
              
              // Invalider le cache React Query
              queryClient.invalidateQueries({ queryKey: ['exhibitors-by-event'] });
              queryClient.invalidateQueries({ queryKey: ['exhibitor', exhibitorIdForLogo] });
              
              toast({
                title: "Logo ajouté",
                description: `Le logo a été mis à jour avec succès.`,
              });
            }
            
            // ✅ Nettoyer le ref après usage
            exhibitorLogoFileRef.current = null;
          }
        } else {
          console.log('ℹ️ Aucun logo à uploader pour cet exposant existant');
        }
        
        // ✅ Mettre à jour le stand_info si fourni
        const standInfo = (step1.exhibitor as any).stand_info;
        if (standInfo && standInfo.trim()) {
          console.log('📍 Mise à jour stand_info pour exposant existant:', standInfo);
          
          const { error: standUpdateError } = await supabase
            .from('exhibitors')
            .update({ 
              stand_info: standInfo.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', exhibitorIdForLogo);
          
          if (standUpdateError) {
            console.error('❌ Erreur MAJ stand_info:', standUpdateError);
          } else {
            console.log('✅ Stand info sauvegardé:', standInfo);
          }
        }
      }

      // Check plan limits with proper UUID parameters
      console.log('🔍 Vérification limites plan...', { exhibitorId, eventId: event.id });
      const { data: quotaResponse, error: limitError } = await supabase.rpc('can_add_novelty', {
        p_exhibitor_id: exhibitorId,
        p_event_id: event.id
      });

      if (limitError) {
        console.error('❌ Erreur RPC can_add_novelty:', limitError);
        toast({
          title: 'Erreur',
          description: 'Impossible de vérifier le quota. Réessayez.',
          variant: 'destructive'
        });
        return;
      }

      // Parse JSON response
      const quota = quotaResponse as { allowed: boolean; reason: string; current_count: number; plan: string };
      console.log('📊 Quota response:', quota);

      if (!quota.allowed) {
        console.error('❌ Limite plan atteinte:', quota);
        toast({
          title: 'Limite atteinte',
          description: quota.reason || 'Quota dépassé pour cet événement.',
          variant: 'destructive'
        });
        return;
      }
      console.log('✅ Limites plan OK:', `${quota.current_count} / ${quota.plan === 'free' ? '1' : '∞'} nouveautés`);

      // 3. Upload des fichiers
      let imageUrls: string[] = [];
      let brochureUrl: string | null = null;
      
      console.log('📤 Début upload des fichiers...');
      
      // Upload images
      if (step2.images && step2.images.length > 0) {
        const imageFiles = step2.images.filter(img => img instanceof File) as File[];
        console.log(`📸 Uploading ${imageFiles.length} images...`);
        
        for (const [index, file] of imageFiles.entries()) {
          try {
            // ✅ CORRECTION : Nettoyer le nom de fichier
            const cleanFileName = sanitizeFileName(file.name);
            const fileName = `${Date.now()}-${index}-${cleanFileName}`;
            const filePath = `images/${fileName}`;
            
            console.log(`⬆️ Upload image ${index + 1}/${imageFiles.length}:`, {
              originalName: file.name,
              cleanName: cleanFileName,
              finalFileName: fileName,
              filePath: filePath
            });
            
            const { data, error } = await supabase.storage
              .from('novelties')
              .upload(filePath, file);
              
            if (error) {
              console.error(`❌ Erreur upload image ${file.name}:`, error);
              throw error;
            }
            
            console.log(`✅ Image ${index + 1} uploadée:`, data.path);
            
            // Récupérer l'URL publique
            const { data: publicUrl } = supabase.storage
              .from('novelties')
              .getPublicUrl(filePath);
              
            imageUrls.push(publicUrl.publicUrl);
            console.log(`🔗 URL publique image ${index + 1}:`, publicUrl.publicUrl);
            
          } catch (error) {
            console.error(`🚨 Erreur lors de l'upload de l'image ${file.name}:`, error);
            throw error;
          }
        }
      }
      
      // Upload PDF
      if (step2.brochure && step2.brochure instanceof File) {
        try {
          // ✅ CORRECTION : Nettoyer le nom de fichier PDF
          const cleanFileName = sanitizeFileName(step2.brochure.name);
          const fileName = `${Date.now()}-${cleanFileName}`;
          const filePath = `brochures/${fileName}`;
          
          console.log(`📄 Upload PDF:`, {
            originalName: step2.brochure.name,
            cleanName: cleanFileName,
            finalFileName: fileName,
            filePath: filePath
          });
          
          const { data, error } = await supabase.storage
            .from('novelties')
            .upload(filePath, step2.brochure);
            
          if (error) {
            console.error('❌ Erreur upload PDF:', error);
            throw error;
          }
          
          console.log('✅ PDF uploadé:', data.path);
          
          const { data: publicUrl } = supabase.storage
            .from('novelties')
            .getPublicUrl(filePath);
            
          brochureUrl = publicUrl.publicUrl;
          console.log('🔗 URL publique PDF:', brochureUrl);
          
        } catch (error) {
          console.error('🚨 Erreur lors de l\'upload du PDF:', error);
          throw error;
        }
      }

      // 4. Construction du payload final
      const payload: Record<string, unknown> = {
        event_id: event.id,
        exhibitor_id: exhibitorId,
        title: step2.title.trim(),
        novelty_type: step2.type,
        reason: step2.reason.trim(),
        images: imageUrls,
        brochure_pdf: brochureUrl,
        stand_info: 'stand_info' in step1.exhibitor ? step1.exhibitor.stand_info?.trim() || null : null,
        // created_by is now extracted from JWT server-side — no longer sent in payload
        // ✅ NOUVEAU: Tracker l'exposant en attente pour l'approuver à la publication
        pending_exhibitor_id: pendingExhibitorId
      };

      console.log('🚀 PAYLOAD FINAL:');
      console.log(JSON.stringify(payload, null, 2));
      
      // 5. Validation côté client avant envoi
      const validationErrors: string[] = [];
      const title = payload.title as string | undefined;
      const reason = payload.reason as string | undefined;
      const images = payload.images as string[] | undefined;
      
      if (!payload.event_id) validationErrors.push('event_id manquant');
      if (!payload.exhibitor_id) validationErrors.push('exhibitor_id manquant');
      if (!title || title.length < 3) validationErrors.push('title invalide');
      if (!payload.novelty_type) validationErrors.push('novelty_type manquant');
      if (!reason || reason.length < 10) validationErrors.push('reason invalide');
      if (!images || images.length === 0) validationErrors.push('images manquantes');
      
      if (validationErrors.length > 0) {
        console.error('❌ Erreurs de validation côté client:', validationErrors);
        throw new Error(`Validation client échouée: ${validationErrors.join(', ')}`);
      }
      
      console.log('✅ Validation côté client OK');

      // 6. Call Edge function (via fetch pour lire le JSON en cas de 400)
      console.log('📡 Appel Edge Function (via fetch pour lire le JSON en cas de 400)...');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || null;

      // Récupère l'URL du projet depuis l'env
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/novelties-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload),
      });

      // Essaie de parser le JSON même si 400
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // pas de JSON – on gère quand même
      }

      console.log('📡 Response status:', res.status);
      console.log('📡 Response JSON:', json);

      if (!res.ok) {
        console.group('🚨 ERREUR SERVEUR DÉTAILLÉE (fetch)');
        console.log('HTTP status:', res.status);
        console.log('JSON:', json);
        console.groupEnd();

        // ✅ Gestion spéciale de l'erreur de quota
        if (json?.code === 'QUOTA_EXCEEDED') {
          setShowLimitDialog(true);
          throw new Error(json.message || 'Quota dépassé');
        }

        const msg = json?.error || `HTTP ${res.status}`;
        const details = json?.details || json?.hint || json?.code || null;
        throw new Error(details ? `${msg}: ${typeof details === 'string' ? details : JSON.stringify(details)}` : msg);
      }

      // Succès
      const novelty = json;  // { id, title } d'après l'Edge
      if (!novelty) {
        throw new Error('Aucune nouveauté retournée');
      }

      console.log('✅ Nouveauté créée avec succès:', novelty);
      console.groupEnd();

      // ✅ Clean success - no additional PATCH/UPDATE operations
      toast({
        title: 'Nouveauté envoyée à la validation Lotexpo',
        description: 'Parfait ! Votre nouveauté a été transmise à l\'équipe Lotexpo pour vérification éditoriale. Comptez en général 24–48 h. Nous vous notifierons par e-mail dès sa mise en ligne.',
        variant: 'default'
      });

      // ✅ Invalider le cache pour rafraîchir la liste des exposants dans la sidebar
      queryClient.invalidateQueries({ queryKey: ['exhibitors-by-event', event.slug] });
      queryClient.invalidateQueries({ queryKey: ['exhibitors-by-event'] });

      // ✅ Success! Set result and clean localStorage
      // Message uniforme: toutes les nouveautés passent par la validation admin
      const isNewExhibitor = !!pendingExhibitorId;
      setSubmissionResult({
        success: true,
        message: isNewExhibitor 
          ? 'Votre nouveauté et votre fiche exposant ont été soumises et seront publiées après validation par l\'équipe LotExpo.'
          : 'Votre nouveauté a été soumise et sera publiée après validation par l\'équipe LotExpo.',
        noveltyId: novelty.id
      });
      
      // ✅ Clear saved state on success
      localStorage.removeItem('addNoveltyStepperState');
      
      // NOTE: Pour les nouveaux exposants, la participation sera créée automatiquement
      // par novelties-moderate lors de la publication de la nouveauté par l'admin.
      // Ne PAS créer la participation ici pour éviter que l'exposant apparaisse avant validation.

      // Invalider TOUS les caches liés aux exposants
      console.log('🔄 Invalidation des caches après création nouveauté');
      
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          if (typeof key === 'string') {
            return key.includes('exhibitor') || 
                   key.includes('novelty') || 
                   key.includes('novelties') ||
                   key.includes('participation');
          }
          return false;
        }
      });

      // Forcer un refetch immédiat de la sidebar
      if (event?.slug) {
        await queryClient.refetchQueries({ 
          queryKey: ['exhibitors-by-event', event.slug]
        });
      }

      console.log('✅ Caches invalidés');

    } catch (error: any) {
      console.groupEnd();
      console.error('🚨 ERREUR GLOBALE:', error);
      
      if (error.message.includes('validation')) {
        toast({
          title: 'Données invalides',
          description: 'Veuillez vérifier vos informations.',
          variant: 'destructive'
        });
      } else if (error.message.includes('upload')) {
        toast({
          title: 'Erreur d\'upload',
          description: 'Erreur lors de l\'upload des fichiers.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Erreur',
          description: error.message || 'Erreur lors de la création de la nouveauté.',
          variant: 'destructive'
        });
      }

      setSubmissionResult({
        success: false,
        message: error.message || 'Une erreur est survenue lors de la création de votre nouveauté.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!submissionResult) {
      // Save state before closing (unless submission was successful)
      saveState();
    } else {
      // Clear state after successful submission
      localStorage.removeItem('addNoveltyStepperState');
    }
    
    // Reset form
    setCurrentStep(1);
    setState({
      step1Data: {},
      step2Data: {},
      step1Valid: false,
      step2Valid: false,
    });
    setSubmissionResult(null);
    setFieldErrors({});
    onClose();
  };

  // Don't render if submission was successful (show simple success message)
  if (submissionResult) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {submissionResult.success ? '🎉 Nouveauté ajoutée !' : '❌ Erreur'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              {submissionResult.message}
            </p>
            
            <Button onClick={handleClose} className="w-full">
              Terminer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <NoveltyLimitDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        currentCount={quota?.current || 0}
        limit={quota?.limit || 1}
        eventName={event.nom_event}
      />

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="novelty-stepper-description">
          <DialogHeader>
            <DialogTitle>Ajouter une nouveauté</DialogTitle>
          </DialogHeader>
          <p id="novelty-stepper-description" className="sr-only">
            Formulaire en 2 étapes pour ajouter une nouveauté à un événement
          </p>

        {/* Progress indicator */}
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2">
              {currentStep >= 1 ? (
                <CheckCircle className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={`text-sm ${currentStep >= 1 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                1. Société & vous
              </span>
            </div>
            
            <div className="w-16 h-0.5 bg-muted">
              <div 
                className={`h-full bg-primary transition-all duration-300 ${currentStep >= 2 ? 'w-full' : 'w-0'}`} 
              />
            </div>
            
            <div className="flex items-center space-x-2">
              {currentStep >= 2 ? (
                <CheckCircle className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={`text-sm ${currentStep >= 2 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                2. Nouveauté
              </span>
            </div>
          </div>
          
          <Progress value={(currentStep / 2) * 100} className="w-full" />
        </div>

        {/* Step content */}
        <div className="mt-6">
          {currentStep === 1 && (
            <Step1ExhibitorAndUser
              event={event}
              data={state.step1Data}
              onChange={handleStep1Change}
              onValidationChange={handleStep1ValidationChange}
            />
          )}
          
          {currentStep === 2 && (
            <Step2NoveltyDetails
              data={state.step2Data}
              onChange={handleStep2Change}
              onValidationChange={handleStep2ValidationChange}
              fieldErrors={fieldErrors}
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          
          <div className="space-x-2">
            {currentStep === 2 && (
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(1)}
                disabled={loading}
              >
                Précédent
              </Button>
            )}
            
            {currentStep === 1 ? (
              <Button 
                onClick={handleNext}
                disabled={!state.step1Valid || loading}
              >
                {loading ? 'Vérification...' : 'Suivant'}
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={!state.step2Valid || loading}
              >
                {loading ? 'Publication...' : 'Publier la nouveauté'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
