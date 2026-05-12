# Plan — Radar CRM (MVP)

Fonctionnalité majeure : importer un CSV de comptes CRM et détecter automatiquement quels comptes exposent sur des salons Lotexpo.

## Vérifications préalables (avant code)

1. Lire la structure réelle des tables CRM déjà créées : `crm_imports`, `crm_companies`, `crm_company_event_matches`, `crm_event_alerts`, et la vue `crm_radar_participations_view`.
2. Confirmer que le trigger qui calcule `crm_companies.normalized_domain` existe bien.
3. Vérifier les RLS existantes sur ces tables.
4. Identifier la structure du menu utilisateur (Header / sidebar Profile) pour insérer "Radar CRM".
5. Identifier la structure des pages admin (`AdminLayout`, `AdminOverview`) pour ajouter une page Radar CRM + un bloc dans la vue d'ensemble.

## Périmètre MVP

- CSV uniquement (pas Excel — mention "bientôt disponible").
- Matching exact sur `normalized_domain`.
- Toutes les requêtes côté front via Supabase JS (RLS), matching dans une Edge Function.
- Limite : 5 000 lignes par import.

## Backend

### Migration SQL
- Table `crm_usage_events` (id, user_id nullable, event_type text, metadata jsonb, created_at) + RLS :
  - INSERT permis à tous (auth ou anonyme via anon key, user_id = auth.uid() ou null).
  - SELECT réservé aux admins via `is_admin()`.
- Index sur (event_type, created_at) et (user_id).
- Confirmer la contrainte unique sur `crm_company_event_matches (crm_company_id, id_exposant, event_id)` — la créer si absente (nécessaire pour le `ON CONFLICT` du matching).
- RPC `get_radar_crm_admin_stats()` (security definer, admin only) renvoyant les agrégats pour la page admin et le bloc vue d'ensemble.

### Edge Function `crm-import`
- `verify_jwt = false` + validation manuelle via `getClaims` (pattern projet).
- Dual-client : `authClient` (anon + Authorization) pour vérifier l'utilisateur, `serviceClient` (service role) pour les écritures.
- Validation Zod : `fileName`, `sourceType="csv"`, `mapping` (objet), `rows` (array, max 5000).
- Étapes :
  1. Auth → `user_id`.
  2. Insert `crm_imports` (status=`processing`, total_rows).
  3. Construire les lignes `crm_companies` à partir de `mapping` + `rows`. Insert par batch (chunks de 500). Le trigger calcule `normalized_domain`.
  4. Exécuter le SQL de matching (via `serviceClient.rpc` sur une fonction SQL dédiée OU via SQL paramétré). Je vais créer une fonction SQL `crm_run_matching(p_import_id uuid, p_user_id uuid)` qui fait le INSERT depuis `crm_companies` JOIN `crm_radar_participations_view`, et retourne les compteurs.
  5. Update `crm_imports` : `status=completed`, `matched_companies_count`, `unmatched_companies_count`.
  6. Renvoyer le résumé (totalRows, companiesImported, matchedCompaniesCount, unmatchedCompaniesCount, matchesCount, futureMatchesCount, pastMatchesCount, importId).
- Error handling : status=`failed` + `error_message`.
- CORS standard.

## Frontend

### Routes
- `/radar-crm` (publique) — landing + upload + preview + gate auth.
- `/radar-crm/results` (auth) — dashboard utilisateur (liste des imports + détail dernier import).
- `/admin/radar-crm` (admin) — page admin.

### Composants nouveaux
- `src/pages/RadarCrm.tsx` — page publique/connectée unifiée :
  - Hero, explication produit, bénéfices, garanties confidentialité.
  - `<RadarCsvUploader>` : upload + parsing local (papaparse).
  - `<RadarColumnMapper>` : auto-détection colonnes via dictionnaire de synonymes + édition manuelle.
  - `<RadarPreviewTable>` : 5 premières lignes.
  - Si non connecté : carte "auth gate" avec CTA Login/Signup ; sauvegarder le mapping + rows en `sessionStorage` clé `radarCrmPendingImport`.
  - Si connecté : bouton "Lancer l'analyse" → invoke edge function → redirect `/radar-crm/results`.
  - Si déjà connecté + données dans sessionStorage (retour de login) : auto-soumettre.
- `src/pages/RadarCrmResults.tsx` — dashboard :
  - Sélecteur d'import (par défaut le plus récent).
  - Cards de résumé.
  - Onglets : Opportunités à venir, Événements passés, Entreprises matchées, Non matchées, Historique.
  - Données : `crm_imports`, `crm_companies` (par import), `crm_company_event_matches` joint avec la vue `crm_radar_participations_view` (récupérer la vue puis enrichir côté JS, ou faire deux requêtes et merger par `event_id`+`id_exposant`).
- `src/pages/admin/AdminRadarCrm.tsx` — stats globales + table des derniers imports (via RPC admin).
- État vide pédagogique (faux résultat de démo) si aucun import.
- Hook `useCrmImports`, `useCrmImportDetail`, `useRadarTracking` (insert dans `crm_usage_events`).

### Librairie
- Ajouter `papaparse` + `@types/papaparse`.

### Mapping auto colonnes
- Dictionnaire de synonymes (français + anglais) pour : company_name, website_raw, crm_status, owner_name, owner_email, notes.
- Normalisation : trim + lower + remove accents pour la détection.

### Menu
- Ajouter entrée "Radar CRM" dans le menu utilisateur connecté (Header / dropdown profil).
- Ajouter lien admin dans `AdminLayout` (ou la sidebar admin).

### Onboarding
- Ajouter une 5e étape "Radar CRM" dans `STEPS` de `OnboardingTour.tsx` avec CTA `Tester Radar CRM` qui navigue vers `/radar-crm`.

### Admin Overview
- Ajouter un bloc Radar CRM dans `AdminOverview.tsx` consommant la RPC.

### Tracking
- Helper `trackRadarEvent(event_type, metadata?)` qui insert dans `crm_usage_events`.
- Appels aux moments clés indiqués (page view, upload, parse, auth required, import start/complete/fail, results viewed, event clicked).

## Sécurité / Confidentialité

- Aucune écriture Supabase avant authentification.
- Edge function utilise toujours `auth.getClaims()` pour `user_id` (jamais le payload client).
- Inserts dans `crm_companies` forcent `user_id = auth user`.
- Tables CRM déjà protégées par RLS (à vérifier — sinon ajouter les policies user-isolation).
- `crm_usage_events.user_id` peut être NULL (visiteurs anonymes), pas d'info sensible dans `metadata`.

## Texte UI (FR)

- Reprendre les copies fournies dans le brief.
- Mention "Excel bientôt disponible".
- Disclaimer matching exact sur le domaine, dans la section non-matchées.

## Étapes d'implémentation (ordre)

1. Inspecter schéma réel + RLS existantes (`supabase--read_query`).
2. Migration : table `crm_usage_events`, RPC admin stats, fonction `crm_run_matching`, contrainte unique si manquante.
3. Edge function `crm-import`.
4. Dépendance `papaparse`.
5. Composants upload/mapper/preview + page publique `/radar-crm`.
6. Page résultats `/radar-crm/results`.
7. Hook tracking + appels.
8. Menu utilisateur + onboarding step.
9. Page admin + bloc overview.
10. Tests manuels via preview.

## Hors périmètre MVP

- Excel.
- Matching fuzzy / sous-domaines.
- Alertes email (`crm_event_alerts` reste vide pour le moment).
- Monétisation / paywall.
- Vue dédiée user-safe pour le join — on enrichira côté JS (deux requêtes : matches puis vue filtrée par les `(event_id, id_exposant)` collectés).
