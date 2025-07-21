
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from 'react-helmet-async';
import { Buffer } from 'buffer';
import App from "./App.tsx";
import "./index.css";

// Make Buffer available globally for packages that expect it
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer;
}

// Also make it available as a global variable for older code
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);
