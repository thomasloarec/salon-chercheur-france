import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  
  const [currentStep, setCurrentStep] = useState<CurrentStep>(1);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    message: string;
    noveltyId?: string;
  } | null>(null);

  // Form state
  const [state, setState] = useState<StepperState>({
    step1Data: {},
    step2Data: {},
    step1Valid: false,
    step2Valid: false,
  });

  // Load saved state from localStorage on open
  useEffect(() => {
    if (isOpen) {
      const savedState = localStorage.getItem('addNoveltyStepperState');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          setState(prev => ({ ...prev, ...parsed }));
          
          // If user is now logged in and step 1 was completed, go to step 2
          if (user && parsed.step1Valid) {
            setCurrentStep(2);
          }
        } catch (error) {
          console.error('Error loading saved state:', error);
        }
      }
    }
  }, [isOpen, user]);

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
    setState(prev => ({ ...prev, step1Data: data }));
  };

  const handleStep1ValidationChange = (isValid: boolean) => {
    setState(prev => ({ ...prev, step1Valid: isValid }));
  };

  // Update step 2 data
  const handleStep2Change = (data: Partial<Step2Data>) => {
    setState(prev => ({ ...prev, step2Data: data }));
  };

  const handleStep2ValidationChange = (isValid: boolean) => {
    setState(prev => ({ ...prev, step2Valid: isValid }));
  };

  // Navigate to next step
  const handleNext = async () => {
    if (currentStep === 1) {
      // Clear any previous errors
      setFieldErrors({});
      
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
        const { data: newExhibitor, error: exhibitorError } = await supabase.functions.invoke('exhibitors-manage', {
          body: {
            action: 'create',
            name: state.step1Data.exhibitor.name,
            website: state.step1Data.exhibitor.website,
            stand_info: 'stand_info' in state.step1Data.exhibitor ? state.step1Data.exhibitor.stand_info : undefined,
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
      // Validate schemas
      const step1Result = step1Schema.safeParse(state.step1Data);
      const step2Result = step2Schema.safeParse(state.step2Data);

      if (!step1Result.success || !step2Result.success) {
        toast({
          title: 'Données invalides',
          description: 'Veuillez vérifier vos informations.',
          variant: 'destructive'
        });
        return;
      }

      const step1 = step1Result.data;
      const step2 = step2Result.data;

      // Get or create exhibitor
      let exhibitorId: string;
      let exhibitorApproved = false;

      if ('id' in step1.exhibitor) {
        // Existing exhibitor
        exhibitorId = step1.exhibitor.id;
        exhibitorApproved = step1.exhibitor.approved;
      } else {
        // Create new exhibitor
        const { data: newExhibitor, error: exhibitorError } = await supabase.functions.invoke('exhibitors-manage', {
          body: {
            action: 'create',
            name: step1.exhibitor.name,
            website: step1.exhibitor.website || null,
            stand_info: 'stand_info' in step1.exhibitor ? step1.exhibitor.stand_info || null : null,
            event_id: event.id
          }
        });

        if (exhibitorError || !newExhibitor) {
          throw new Error(exhibitorError?.message || 'Impossible de créer l\'exposant');
        }

        exhibitorId = newExhibitor.id;
        exhibitorApproved = false; // New exhibitors need approval
      }

      // Check plan limits
      const { data: canAdd, error: limitError } = await supabase.rpc('can_add_novelty', {
        p_exhibitor_id: exhibitorId,
        p_user_id: user!.id
      });

      if (limitError || !canAdd) {
        toast({
          title: 'Limite atteinte',
          description: 'Plan gratuit: 1 nouveauté maximum par exposant. Passez au plan payant pour plus.',
          variant: 'destructive'
        });
        return;
      }

      const { data: novelty, error: noveltyError } = await supabase.functions.invoke('novelties-create', {
        body: {
          event_id: event.id,
          exhibitor_id: exhibitorId,
          title: step2.title,
          type: step2.type,
          reason: step2.reason, // Updated from reason_1
          images: [], // Will be filled after upload
          brochure_pdf_url: null, // Will be filled after upload
          stand_info: 'stand_info' in step1.exhibitor ? step1.exhibitor.stand_info || null : null,
          created_by: user!.id
        }
      });

      if (noveltyError) {
        // Check for validation errors (422)
        if (noveltyError.message && typeof noveltyError.message === 'string') {
          try {
            const errorData = JSON.parse(noveltyError.message);
            if (errorData.error === 'validation_failed' && errorData.fields) {
              setFieldErrors(errorData.fields);
              toast({
                title: 'Formulaire incomplet',
                description: 'Veuillez corriger les erreurs indiquées dans le formulaire.',
                variant: 'destructive'
              });
              return;
            }
          } catch (parseError) {
            // Not a JSON error, continue with generic error handling
          }
        }
        throw new Error('Impossible de créer la nouveauté');
      }

      if (!novelty) {
        throw new Error('Impossible de créer la nouveauté');
      }

      const uploadedFiles: string[] = [];

      try {
      // Upload images
      if (step2.images.length > 0) {
        const imageFiles = step2.images.filter((img): img is File => img instanceof File);
        if (imageFiles.length > 0) {
          const { successes, failures } = await uploadNoveltyImages(novelty.id, imageFiles);
          
          if (failures.length > 0) {
            console.warn('Some image uploads failed:', failures);
          }

          // Record successful uploads
          for (const success of successes) {
            if (success.url) {
              await supabase
                .from('novelty_images')
                .insert({
                  novelty_id: novelty.id,
                  url: success.url,
                  position: successes.indexOf(success)
                });
              
              uploadedFiles.push(success.url);
            }
          }
        }
      }

        // Upload brochure
        if (step2.brochure) {
          const brochureResult = await uploadNoveltyResource(novelty.id, step2.brochure);
          
          if (brochureResult.success && brochureResult.url) {
            await supabase
              .from('novelties')
              .update({ resource_url: brochureResult.url })
              .eq('id', novelty.id);
            
            uploadedFiles.push(brochureResult.url);
          }
        }

        // Initialize stats
        await supabase
          .from('novelty_stats')
          .insert({
            novelty_id: novelty.id,
            likes: 0,
            saves: 0,
            resource_downloads: 0,
            meeting_requests: 0
          });

        // Success!
        setSubmissionResult({
          success: true,
          message: exhibitorApproved 
            ? 'Votre nouveauté est publiée ! 🎉'
            : 'Votre nouveauté a été soumise et sera publiée après validation de l\'exposant.',
          noveltyId: novelty.id
        });

        // Clear saved state
        localStorage.removeItem('addNoveltyStepperState');

      } catch (uploadError) {
        // Cleanup failed uploads
        await cleanupFailedUploads(uploadedFiles);
        
        // Delete the novelty record since uploads failed
        await supabase.from('novelties').delete().eq('id', novelty.id);
        
        throw uploadError;
      }

    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de soumettre la nouveauté',
        variant: 'destructive'
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
  );
}
