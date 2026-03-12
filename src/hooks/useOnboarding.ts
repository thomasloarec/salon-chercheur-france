import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const ONBOARDING_KEY = 'lotexpo_onboarding_completed';
const ONBOARDING_STEP_KEY = 'lotexpo_onboarding_step';

export type OnboardingStep = 0 | 1 | 2 | 3;

export function useOnboarding() {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState<OnboardingStep>(0);

  useEffect(() => {
    if (!user) {
      setIsActive(false);
      return;
    }

    const completed = localStorage.getItem(`${ONBOARDING_KEY}_${user.id}`);
    const savedStep = localStorage.getItem(`${ONBOARDING_STEP_KEY}_${user.id}`);

    if (!completed) {
      setIsActive(true);
      setStep((savedStep ? parseInt(savedStep, 10) : 0) as OnboardingStep);
    }
  }, [user]);

  const nextStep = useCallback(() => {
    setStep(prev => {
      const next = (prev + 1) as OnboardingStep;
      if (user) {
        localStorage.setItem(`${ONBOARDING_STEP_KEY}_${user.id}`, String(next));
      }
      return next;
    });
  }, [user]);

  const skipOnboarding = useCallback(() => {
    if (user) {
      localStorage.setItem(`${ONBOARDING_KEY}_${user.id}`, 'true');
      localStorage.removeItem(`${ONBOARDING_STEP_KEY}_${user.id}`);
    }
    setIsActive(false);
  }, [user]);

  const completeOnboarding = useCallback(() => {
    if (user) {
      localStorage.setItem(`${ONBOARDING_KEY}_${user.id}`, 'true');
      localStorage.removeItem(`${ONBOARDING_STEP_KEY}_${user.id}`);
    }
    setIsActive(false);
  }, [user]);

  return { isActive, step, nextStep, skipOnboarding, completeOnboarding };
}
