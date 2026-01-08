import React, { useState, useEffect } from 'react';
import SiteLockPage from './SiteLockPage';
import { supabase } from '@/integrations/supabase/client';

interface SiteGuardProps {
  children: React.ReactNode;
}

const SiteGuard = ({ children }: SiteGuardProps) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Site lock is now disabled - the site is publicly accessible
  const isSiteLockEnabled = false;

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

  const handleUnlock = async (password: string): Promise<boolean> => {
    try {
      // Server-side password validation with rate limiting
      const { data, error } = await supabase.functions.invoke('site-unlock', {
        body: { password }
      });

      if (error) {
        console.error('Site unlock error:', error);
        return false;
      }

      if (data?.success) {
        sessionStorage.setItem('site_unlocked', 'true');
        setIsUnlocked(true);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Site unlock failed:', err);
      return false;
    }
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
