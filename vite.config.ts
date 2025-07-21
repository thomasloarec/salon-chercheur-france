
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/scrape': {
        target: 'http://localhost:54321/functions/v1/scrape',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/scrape/, ''),
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: ['cheerio', 'boolbase', 'css-select', 'css-what', 'domelementtype', 'domhandler', 'domutils'],
      output: {
        // Prevent automatic preloading of all chunks
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        }
      }
    },
    // Disable automatic modulePreload for better control
    modulePreload: {
      polyfill: false
    }
  },
  optimizeDeps: {
    exclude: ['cheerio', 'boolbase', 'css-select', 'css-what', 'domelementtype', 'domhandler', 'domutils']
  }
}));
