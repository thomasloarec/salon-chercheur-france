import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Calendar, CalendarCheck, Star, Bell, ArrowRight, X, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    title: 'Bienvenue sur Lotexpo ! 🎉',
    description:
      'En 3 étapes rapides, découvrez comment tirer le meilleur parti de votre compte. C\'est parti !',
    icon: Sparkles,
    cta: 'Commencer la visite',
    route: '/',
    illustration: (
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
          <CalendarCheck className="h-6 w-6 text-accent" />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Star className="h-6 w-6 text-primary" />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <Bell className="h-6 w-6 text-green-600" />
        </div>
      </div>
    ),
  },
  {
    title: 'Ajoutez des salons à votre agenda',
    description:
      'Repérez un salon qui vous intéresse et cliquez sur l\'icône calendrier pour l\'ajouter à votre agenda personnel. Vous recevrez un rappel avant l\'événement !',
    icon: CalendarCheck,
    cta: 'Compris ! Étape suivante',
    route: '/',
    illustration: (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative">
          <div className="w-48 h-28 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Carte d'événement</span>
          </div>
          <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-green-500 flex items-center justify-center shadow-lg animate-bounce">
            <CalendarCheck className="h-5 w-5 text-white" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-[240px]">
          Cliquez sur ce bouton sur n'importe quelle carte d'événement
        </p>
      </div>
    ),
  },
  {
    title: 'Retrouvez tout dans Mon Agenda',
    description:
      'Tous les salons que vous avez ajoutés se retrouvent dans votre agenda personnel. Pratique pour planifier vos prochaines visites !',
    icon: Calendar,
    cta: 'Voir mon agenda',
    route: '/agenda',
    illustration: (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-56 rounded-xl bg-muted/50 border border-border p-3 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center flex-shrink-0">
                <CalendarCheck className="h-3 w-3 text-accent" />
              </div>
              <div className="flex-1 space-y-1">
                <div className={cn("h-2 rounded bg-muted-foreground/20", i === 1 ? "w-3/4" : i === 2 ? "w-1/2" : "w-2/3")} />
                <div className="h-1.5 rounded bg-muted-foreground/10 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Votre agenda avec vos événements favoris
        </p>
      </div>
    ),
  },
  {
    title: 'Restez informé chaque mois',
    description:
      'Rendez-vous dans votre profil pour sélectionner les secteurs qui vous intéressent. Vous recevrez une fois par mois les salons à venir dans ces secteurs.',
    icon: Bell,
    cta: 'Compléter mon profil',
    route: '/profile',
    illustration: (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-56 rounded-xl bg-muted/50 border border-border p-3 space-y-2">
          <div className="text-xs font-medium text-foreground mb-2">Newsletters sectorielles</div>
          {['Agroalimentaire', 'Industrie', 'Santé'].map((sector, i) => (
            <label key={sector} className="flex items-center gap-2 cursor-pointer">
              <div className={cn(
                "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                i < 2 ? "bg-accent border-accent" : "border-muted-foreground/30"
              )}>
                {i < 2 && <span className="text-white text-[10px]">✓</span>}
              </div>
              <span className="text-xs text-foreground">{sector}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-[240px]">
          Choisissez vos secteurs dans votre profil
        </p>
      </div>
    ),
  },
];

const OnboardingTour: React.FC = () => {
  const { isActive, step, nextStep, skipOnboarding, completeOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isActive) return null;

  const currentStep = STEPS[step];
  if (!currentStep) return null;

  const isLastStep = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding();
      navigate('/profile');
      return;
    }

    const nextStepData = STEPS[step + 1];
    if (nextStepData?.route && nextStepData.route !== location.pathname) {
      navigate(nextStepData.route);
    }

    nextStep();
  };

  const handleSkip = () => {
    skipOnboarding();
  };

  const Icon = currentStep.icon;

  return (
    <Dialog open={isActive} onOpenChange={(open) => { if (!open) handleSkip(); }}>
      <DialogContent className="sm:max-w-md max-sm:max-w-[calc(100%-2rem)] max-sm:rounded-2xl max-sm:top-auto max-sm:bottom-4 max-sm:translate-y-0 max-sm:h-auto max-sm:max-h-[85vh] p-0 gap-0 overflow-hidden">
        {/* Progress bar */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              Étape {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Passer la visite
            </button>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="px-6 pt-5 pb-2">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <DialogTitle className="text-lg leading-snug text-left">
                {currentStep.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed text-left">
              {currentStep.description}
            </DialogDescription>
          </DialogHeader>

          {/* Illustration */}
          <div className="mt-2">
            {currentStep.illustration}
          </div>
        </div>

        <DialogFooter className="px-6 pb-5 pt-2 flex-row gap-2 sm:flex-row">
          {step > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // We don't go back, just skip
                handleSkip();
              }}
              className="text-muted-foreground"
            >
              Plus tard
            </Button>
          )}
          <Button
            onClick={handleNext}
            className="flex-1 sm:flex-none"
            size="sm"
          >
            {currentStep.cta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTour;
