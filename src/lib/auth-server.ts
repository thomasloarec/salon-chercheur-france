
import { supabase } from '@/integrations/supabase/client';

export async function getServerUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}
