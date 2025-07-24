
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const { user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user is admin using role-based system
  const [isAdmin, setIsAdmin] = React.useState(false);
  
  React.useEffect(() => {
    const checkAdminRole = async () => {
      if (user) {
        const { data, error } = await supabase
          .rpc('is_admin');
        
        if (!error) {
          setIsAdmin(data || false);
        }
      }
    };
    
    checkAdminRole();
  }, [user]);

  if (!user || !isAdmin) {
    // Redirect non-admin users to home page
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;
