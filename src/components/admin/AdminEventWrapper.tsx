
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface AdminEventWrapperProps {
  children: React.ReactNode;
}

export const AdminEventWrapper: React.FC<AdminEventWrapperProps> = ({ children }) => {
  return (
    <div className="relative">
      {/* Badge "En attente" en surimpression */}
      <div className="fixed top-4 right-4 z-50">
        <Badge 
          variant="destructive" 
          className="bg-red-500/80 text-white border-red-600/50 shadow-lg backdrop-blur-sm px-4 py-2 text-sm font-medium"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Événement en attente
        </Badge>
      </div>
      
      {/* Contenu de la page normale */}
      {children}
    </div>
  );
};
