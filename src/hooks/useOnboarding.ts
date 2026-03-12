import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const ONBOARDING_KEY = 'lotexpo_onboarding_completed';
const ONBOARDING_STEP_KEY = 'lotexpo_onboarding_step';
const ONBOARDING_TRIGGER_KEY = 'lotexpo_onboarding_pending';

export type OnboardingStep = 0 | 1 | 2 | 3;

/**
 * Call this right after a successful signup to flag onboarding for the new user.
 */
export function triggerOnboarding() {
  localStorage.setItem(ONBOARDING_TRIGGER_KEY, 'true');
}

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
    const pending = localStorage.getItem(ONBOARDING_TRIGGER_KEY);

    // Only show onboarding if it was explicitly triggered by signup
    if (!completed && pending === 'true') {
      localStorage.removeItem(ONBOARDING_TRIGGER_KEY);
      const savedStep = localStorage.getItem(`${ONBOARDING_STEP_KEY}_${user.id}`);
      setIsActive(true);
      setStep((savedStep ? parseInt(savedStep, 10) : 0) as OnboardingStep);
    } else if (!completed && !pending) {
      // Existing user visiting for the first time since feature launch — skip
      localStorage.setItem(`${ONBOARDING_KEY}_${user.id}`, 'true');
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
