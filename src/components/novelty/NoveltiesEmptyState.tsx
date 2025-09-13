import React from 'react';

interface NoveltiesEmptyStateProps {
  hasActiveFilters?: boolean;
}

export default function NoveltiesEmptyState({ hasActiveFilters = false }: NoveltiesEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold mb-2">Aucune nouveauté trouvée</h2>
      <p className="text-muted-foreground">
        {hasActiveFilters
          ? 'Essayez de modifier vos filtres pour voir plus de résultats.'
          : 'Les nouveautés seront bientôt disponibles.'
        }
      </p>
    </div>
  );
}