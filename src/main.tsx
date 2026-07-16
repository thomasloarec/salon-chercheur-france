
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from 'react-helmet-async';
import { Buffer } from 'buffer';
// Google Sans Flex — point d'entrée `wght` : axe de graisse seul (1..1000).
// GRAD est arbitré à 0, soit sa valeur par défaut : l'axe est donc inutile.
// Chaque point d'entrée déclare tous les alphabets avec leur `unicode-range` :
// le navigateur ne télécharge que ce qu'il rencontre.
// NE JAMAIS importer `full.css` : 1 368,9 Ko.
import '@fontsource-variable/google-sans-flex/wght.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import App from "./App.tsx";
import "./index.css";
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';

// Make Buffer available globally BEFORE any other imports
globalThis.Buffer = Buffer;

// Also make it available as a global variable for older code
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </AppErrorBoundary>
  </StrictMode>
);
