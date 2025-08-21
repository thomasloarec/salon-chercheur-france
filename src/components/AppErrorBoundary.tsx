import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 shadow-lg">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Oups, un problème est survenu
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Une erreur inattendue s'est produite. Vous pouvez essayer de recharger la page.
          </p>
        </div>
        
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Détails techniques
          </summary>
          <pre className="mt-2 text-xs bg-muted p-3 rounded border text-muted-foreground whitespace-pre-wrap overflow-auto max-h-32">
            {String(error?.message || error)}
          </pre>
        </details>
        
        <div className="flex gap-2">
          <button
            onClick={resetErrorBoundary}
            className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Recharger
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors text-sm font-medium"
          >
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Application Error Boundary caught an error:', error);
        console.error('Error Info:', errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}