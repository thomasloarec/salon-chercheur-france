// Single source of truth for SEO indexability thresholds.
// Imported by BOTH the React hooks (useSectorHub / useCityHub) and the build
// scripts (prerender-seo.mjs / generateSitemap.mjs) so the static HTML, the
// sitemap and the React render can never diverge.
//
// Plain ESM .js so it is runnable by `node` directly (build scripts) AND
// bundleable by Vite (React). Same value as before (3).
export const SECTOR_YEAR_INDEX_THRESHOLD = 3;
export const CITY_YEAR_INDEX_THRESHOLD = 3;
