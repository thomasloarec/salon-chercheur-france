
import React from 'react';

interface AdminEventWrapperProps {
  children: React.ReactNode;
}

export const AdminEventWrapper: React.FC<AdminEventWrapperProps> = ({ children }) => {
  return (
    <div className="relative">
      {children}
    </div>
  );
};
