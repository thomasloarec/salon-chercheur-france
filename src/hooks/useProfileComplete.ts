import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileCompleteness {
  isComplete: boolean;
  missingFields: string[];
  profile: {
    first_name?: string;
    last_name?: string;
    job_title?: string;
    company?: string;
    primary_sector?: string;
  } | null;
}

export function useProfileComplete() {
  const { user } = useAuth();

  return useQuery<ProfileCompleteness>({
    queryKey: ['profile-complete', user?.id],
    queryFn: async () => {
      if (!user) {
        return {
          isComplete: false,
          missingFields: ['Authentification requise'],
          profile: null
        };
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, job_title, company, primary_sector')
        .eq('user_id', user.id)
        .single();

      if (error || !profile) {
        return {
          isComplete: false,
          missingFields: ['Profil non trouvé'],
          profile: null
        };
      }

      const missingFields: string[] = [];
      if (!profile.first_name?.trim()) missingFields.push('Prénom');
      if (!profile.last_name?.trim()) missingFields.push('Nom');
      if (!profile.job_title?.trim()) missingFields.push('Fonction');
      if (!profile.company?.trim()) missingFields.push('Entreprise');
      if (!profile.primary_sector) missingFields.push('Secteur d\'activité');

      return {
        isComplete: missingFields.length === 0,
        missingFields,
        profile
      };
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });
}
