import React, { useState, useEffect } from 'react';
import SiteLockPage from './SiteLockPage';

interface SiteGuardProps {
  children: React.ReactNode;
}

const SiteGuard = ({ children }: SiteGuardProps) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if site lock is enabled
  const isSiteLockEnabled = import.meta.env.VITE_SITE_LOCK_ENABLED === 'true';

  useEffect(() => {
    // If site lock is disabled, allow access immediately
    if (!isSiteLockEnabled) {
      setIsUnlocked(true);
      setIsChecking(false);
      return;
    }

    // Check if user has already unlocked the site in this session
    const unlocked = sessionStorage.getItem('site_unlocked') === 'true';
    setIsUnlocked(unlocked);
    setIsChecking(false);
  }, [isSiteLockEnabled]);

  const handleUnlock = (password: string): boolean => {
    const correctPassword = import.meta.env.VITE_SITE_PASSWORD;
    
    if (password === correctPassword) {
      sessionStorage.setItem('site_unlocked', 'true');
      setIsUnlocked(true);
      return true;
    }
    
    return false;
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If site is unlocked or lock is disabled, show the app
  if (isUnlocked) {
    return <>{children}</>;
  }

  // Show lock page
  return <SiteLockPage onUnlock={handleUnlock} />;
};

export default SiteGuard;
