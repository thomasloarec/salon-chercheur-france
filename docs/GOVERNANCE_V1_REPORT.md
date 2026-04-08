# Gouvernance Entreprise V1 — Compte-rendu final

> Date de validation : 2026-04-08
> Périmètre : gestion multi-utilisateurs des fiches exposants, contrôle d'accès par équipe, vérification automatique

---

## 1. Migrations SQL appliquées

| Migration | Contenu |
|---|---|
| Phase 1 | Création table `exhibitor_team_members`, enum `exhibitor_team_role` (owner/admin/member), enum `exhibitor_team_status` (active/invited/revoked), trigger `sync_team_to_owner` |
| Phase 2 | `GRANT SELECT (verified_at)` sur `exhibitors` pour `anon` et `authenticated` |
| Phase 3 – Bloc C | Fonctions `is_team_member()` et `has_active_owner()`, migration de 4 policies RLS |

## 2. Table ajoutée

### `exhibitor_team_members`

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid PK | Identifiant unique |
| `exhibitor_id` | uuid FK → exhibitors | Entreprise concernée |
| `user_id` | uuid FK → auth.users | Membre de l'équipe |
| `role` | exhibitor_team_role | `owner` · `admin` · `member` |
| `status` | exhibitor_team_status | `active` · `invited` · `revoked` |
| `invited_by` | uuid | Qui a invité ce membre |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Contrainte unique** : `(exhibitor_id, user_id)` — un utilisateur ne peut apparaître qu'une fois par entreprise.

## 3. Colonnes modifiées sur tables existantes

| Table | Colonne | Changement |
|---|---|---|
| `exhibitors` | `verified_at` | Déjà existante, désormais alimentée automatiquement par les blocs A/B. `GRANT SELECT` accordé à `anon`/`authenticated` (colonne unique exposée). |

## 4. Triggers actifs

| Trigger | Table | Événement | Comportement |
|---|---|---|---|
| `sync_team_to_owner` | `exhibitor_team_members` | AFTER INSERT/UPDATE/DELETE | Synchronise `exhibitors.owner_user_id` avec le premier owner actif trouvé dans `exhibitor_team_members`. Assure la rétrocompatibilité avec le code legacy qui lit `owner_user_id`. |
| `protect_exhibitor_columns` | `exhibitors` | BEFORE UPDATE | Empêche les non-admins de modifier `verified_at`, `approved`, `plan`, `owner_user_id` et ~20 colonnes CRM (inchangé, Phase 0). |

## 5. Fonctions SQL de sécurité

| Fonction | Type | Rôle |
|---|---|---|
| `is_team_member(_exhibitor_id)` | SECURITY DEFINER, STABLE | Retourne `true` si `auth.uid()` est membre actif (owner/admin) de l'équipe. Utilisée dans les policies RLS. |
| `has_active_owner(_exhibitor_id)` | SECURITY DEFINER, STABLE | Retourne `true` si l'exposant a déjà un owner actif. Garde anti-doublon utilisée dans les edge functions. |

## 6. Policies RLS modifiées (Phase 3 – Bloc C)

### `novelties` — UPDATE

| Avant | Après |
|---|---|
| `exhibitors.owner_user_id = auth.uid()` | `is_team_member(exhibitor_id)` |

- USING + WITH CHECK symétriques
- Rôle : `authenticated`

### `leads` — SELECT

| Avant | Après |
|---|---|
| Subquery `exhibitors WHERE owner_user_id = auth.uid()` + policy séparée `created_by` | `is_team_member(exhibitor_id) OR novelty_id IN (SELECT ... WHERE created_by = auth.uid())` |

- Fusion de deux anciennes policies en une seule
- Rôle : `authenticated`

### `leads` — UPDATE

| Avant | Après |
|---|---|
| Subquery `exhibitors WHERE owner_user_id = auth.uid()` | `is_team_member(exhibitor_id) OR is_admin()` |

- **USING + WITH CHECK symétriques** (demande explicite)
- Rôle : `authenticated`

### `novelty_images` — ALL

| Avant | Après |
|---|---|
| JOIN `novelties → exhibitors WHERE owner_user_id = auth.uid()` | `EXISTS (SELECT 1 FROM novelties WHERE is_team_member(exhibitor_id) OR is_admin())` |

- **USING + WITH CHECK symétriques** (demande explicite)
- Rôle : `authenticated`

### Policies inchangées

- `novelties` SELECT (publique)
- `novelties` ALL admin
- `leads` ALL admin, INSERT service_role
- `exhibitor_team_members` (4 policies Phase 1)

## 7. Edge Functions modifiées

### `exhibitors-manage` — Bloc A (claim → team auto)

**Action `approve_claim`** :
1. Vérifie que le claim est `pending`
2. Met à jour `exhibitor_claim_requests.status = 'approved'`
3. Met à jour `exhibitors.owner_user_id` et `approved = true`
4. **Garde** : vérifie `has_active_owner` avant toute promotion
5. Si pas d'owner actif → insère dans `exhibitor_team_members` (role=owner, status=active)
6. Si promotion réussie → `exhibitors.verified_at = now()`
7. Si owner déjà existant → skip, log explicite

**Action `create` avec auto-approve par domaine** :
- Même garde `has_active_owner` appliquée
- Même logique de promotion conditionnelle

### `novelties-moderate` — Bloc B (novelty → vérification auto)

Lors de la publication (`next_status = 'published'`) d'une nouveauté avec `pending_exhibitor_id` :
1. Approuve l'exposant (`approved = true`)
2. **Garde** : vérifie `has_active_owner` sur l'exposant
3. Si pas d'owner actif → promeut `created_by` comme owner dans `exhibitor_team_members`
4. Si promotion réussie → `exhibitors.verified_at = now()`
5. Si owner déjà existant → skip, log explicite
6. Crée la participation si nécessaire
7. Nettoie `pending_exhibitor_id`

### `novelties-create` — Guard de membership

Après validation de l'exposant, avant la création atomique :
1. Vérifie si un owner actif existe pour l'exposant
2. **Entreprise non gérée** → accès ouvert (flux historique préservé)
3. **Entreprise gérée + non-membre** → rejet 403 `TEAM_MEMBERSHIP_REQUIRED`
4. **Admin plateforme** → toujours autorisé

## 8. Comportements métier couverts

| Scénario | Comportement |
|---|---|
| Claim approuvé, entreprise sans owner | Owner créé + verified_at |
| Claim approuvé, entreprise déjà gérée | Claim approuvé, pas de doublon owner |
| Création exposant auto-approve par domaine | Owner créé + verified_at (si pas de doublon) |
| Première nouveauté publiée pour entreprise non gérée | Créateur promu owner + verified_at |
| Nouveauté publiée pour entreprise déjà gérée | Pas de promotion, ownership inchangée |
| Soumission nouveauté par non-membre (entreprise gérée) | Rejet 403 |
| Soumission nouveauté (entreprise non gérée) | Autorisé |
| Admin plateforme | Bypass total |
| Modification novelty/leads/images | Via `is_team_member()` dans RLS |
| Badge "Profil vérifié" | Lecture publique de `verified_at` (GRANT SELECT) |

## 9. Éléments hors périmètre V1 (phase suivante)

| Élément | Raison |
|---|---|
| `premium_entitlements` RLS | Surface périphérique, pas critique pour la gouvernance V1 |
| `storage.objects` policies | Complexité supplémentaire, flux de pré-upload à préserver |
| Invitation d'admin par un owner | Fonctionnalité d'équipe avancée |
| UI "Inviter un collaborateur" | Dépend de l'invitation ci-dessus |
| Badge vérifié sur `NoveltyCard` | Décision de ne pas l'afficher en V1 |
| Migration `exhibitor_admin_claims` → suppression | Table legacy conservée, redirection vers `exhibitor_claim_requests` uniquement |
| RLS `exhibitors` UPDATE | Conserve `owner_user_id = auth.uid()` + trigger sync comme bridge |

## 10. Tests exécutés

| Fonction | Tests | Résultat |
|---|---|---|
| `exhibitors-manage` | 13 | ✅ 13/13 |
| `novelties-moderate` | 4 | ✅ 4/4 |
| `novelties-create` | 5 | ✅ 5/5 |
| **Total** | **22** | **✅ 22/22** |

## 11. Sécurité — Points clés

- `is_team_member()` et `has_active_owner()` sont `SECURITY DEFINER` avec `search_path = public` fixe
- Aucune colonne sensible d'`exhibitors` n'est exposée au-delà de `verified_at`
- `sync_team_to_owner` maintient la rétrocompatibilité `owner_user_id` sans exposer de surface d'attaque
- Les edge functions utilisent `service_role` uniquement pour les écritures, jamais le token client
- `created_by` est toujours extrait du JWT vérifié, jamais du payload client
