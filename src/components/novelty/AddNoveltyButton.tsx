import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AddNoveltyStepper from './AddNoveltyStepper';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types/event';

interface AddNoveltyButtonProps {
  event: Event;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export default function AddNoveltyButton({ 
  event, 
  variant = 'default', 
  size = 'default',
  className 
}: AddNoveltyButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleClick = async () => {
    // Not logged in - redirect to auth
    if (!user) {
      navigate('/auth');
      return;
    }

    setIsChecking(true);

    try {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = profile?.role === 'admin';

      if (isAdmin) {
        // Admin can do everything
        setIsModalOpen(true);
        return;
      }

      // Check if user owns any exhibitor participating in this event
      const { data: userExhibitors } = await supabase
        .from('exhibitors')
        .select(`
          id,
          name,
          participation!inner(id)
        `)
        .eq('owner_user_id', user.id)
        .eq('participation.id_event', event.id);

      if (!userExhibitors || userExhibitors.length === 0) {
        // User doesn't own any participating exhibitor
        toast({
          title: 'Co-administration requise',
          description: 'Vous devez être co-administrateur d\'un exposant participant à cet événement.',
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Open claim modal or redirect to exhibitor claim flow
                toast({
                  title: 'Fonctionnalité à venir',
                  description: 'La demande de co-administration sera bientôt disponible.',
                });
              }}
            >
              Demander la co-administration
            </Button>
          ),
        });
        return;
      }

      // User has exhibitor(s) - open modal
      setIsModalOpen(true);

    } catch (error) {
      console.error('Error checking user permissions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de vérifier vos permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isChecking}
        variant={variant}
        size={size}
        className={className}
      >
        <Plus className="h-4 w-4 mr-2" />
        {isChecking ? 'Vérification...' : 'Ajouter ma nouveauté'}
      </Button>

      <AddNoveltyStepper
        event={event}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}