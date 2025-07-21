
import React from 'react';

interface AdminEventWrapperProps {
  children: React.ReactNode;
}

export const AdminEventWrapper: React.FC<AdminEventWrapperProps> = ({ children }) => {
  return (
    <div className="relative">
      {/* Contenu de la page normale - suppression du badge "En attente" */}
      {children}
    </div>
  );
};
