
# Plan de réconciliation des identités publiques exposants

100 % lecture seule. Aucune fusion, suppression, désactivation, remapping ni modification de `exposants`, `exhibitors`, `participation`, `novelties`, `exhibitor_public_identities`. Seules écritures proposées : créer une RPC de **preview/dry-run** + une **table de blacklist** (vide, non active). Rien n'est exécuté ni déclenché (Vercel/Airtable/N8N/cron intouchés).

---

## A. Modèle de données (rôles réels, vérifiés)

- **`exposants`** (16 791 lignes) : table source legacy. Alimentée par Airtable / scraping / participations. PK technique `id` (int) ; clé métier `id_exposant` (text). Porte nom, site, description, `normalized_domain`. **Ne jamais supprimer** : casse l'upsert Airtable et les participations.
- **`exhibitors`** (50 fiches « modernes ») : entreprises actives — owner, équipe, nouveautés, claims, leads, CRM, campagnes. UUID. **Ne jamais supprimer** une ligne portant owner / équipe / nouveauté / lead / donnée active.
- **`exhibitor_public_identities`** (16 795 lignes, 16 792 actives) : **la seule couche qui produit une fiche publique**. Chaque ligne pointe vers `legacy_exposant_id` (→ `exposants.id_exposant`) et/ou `exhibitor_id` (→ `exhibitors.id`). `source_type` ∈ `legacy` (16 782), `modern`, `linked` (50 au total côté exhibitor). Slug unique. `is_active` pilote la visibilité.
- **`public_exhibitor_profiles`** (vue) : **fiche publique réellement affichée**. Lit `exhibitor_public_identities WHERE is_active = true`, joint `exhibitors` (moderne) et `exposants` (legacy), agrège participations (events visibles, non-test), nouveautés publiées, owner/équipe.
- **`participation`** : lien exposant↔événement. Référence `id_exposant` (legacy) **et/ou** `exhibitor_id` (UUID).
- **`novelties`** : rattachées à `exhibitor_id` (UUID) uniquement.

**Réponses aux questions A–G**
- **A.** Une entreprise est *uniquement* dans `exposants` tant qu'elle n'a ni claim, ni owner, ni nouveauté (cas standard import Airtable).
- **B.** Elle apparaît dans `exhibitors` dès qu'un utilisateur revendique / publie une nouveauté / est créée via `exhibitors-manage`.
- **C.** Oui indirectement : la création d'un exhibitor (claim/nouveauté) crée un **miroir** dans `exposants` avec `id_exposant = UUID exhibitor` (STEP 2 de `exhibitors-manage`, l.571-597).
- **D.** Oui, c'est **légitime** : `exposants` = source, `exhibitors` = couche active. Deux lignes source ne sont PAS un bug.
- **E.** `exposants` porte les données d'import (site, description legacy) ; `exhibitors` porte owner/équipe/nouveautés/CRM ; `exhibitor_public_identities` porte le slug public et le lien.
- **F.** La vue `public_exhibitor_profiles`.
- **G.** En gardant **une seule `exhibitor_public_identities` active** par entreprise (désactivation ciblée du doublon), **sans toucher aux lignes source**.

**Le vrai problème** = deux identités publiques actives pour la même entreprise, pas l'existence de deux lignes source.

---

## B. Anti-récidive — origine du doublon (cause racine identifiée)

Mécanisme reproduit sur BNBxTECH :
1. `exhibitors-manage` (STEP 2) crée un **miroir** `exposants.id_exposant = UUID` ; la participation est créée sur ce UUID (l.616-626).
2. Airtable importe ensuite la **vraie** entreprise (`id_exposant = ExporecD3rJ5sf4jLHnLb`, même domaine) → nouvelle ligne `exposants` (upsert clé `id_exposant`).
3. La fonction batch **`sync_exhibitor_public_identities`** voit cette ligne legacy avec `link_count = 0` (aucune participation ne référence l'ExporecID) et **aucun match exact** `legacy_exposant_id`/`exhibitor_id::text` → **crée une 2ᵉ identité publique** `bnbxtech-2`. Elle ne compare **ni le domaine normalisé ni le nom**.

**Fichiers / fonctions concernés**
- `supabase/functions/exhibitors-manage/index.ts` (STEP 2, l.571-597) → crée le miroir UUID.
- RPC `public.sync_exhibitor_public_identities` + `ensure_exhibitor_public_identity` (migration `20260530125032`) → réconcilient seulement par match exact, jamais par domaine/nom.
- RPC `detect_exhibitor_duplicates` (migration `20260531093249`) : scoring domaine 60 / linkedin 80 / nom exact 50 / base_slug 40 / nom proche 45 / sources complémentaires +15 ; garde-fou existant : domaines partagés par >6 identités exclus.

**Volumes mesurés (lecture seule)**
- `exposants.id_exposant` au format UUID (miroirs) : **44** — tous (44/44) liés à une ligne `exhibitors`.
- Miroirs UUID ayant un doublon Airtable réel **même domaine** : **6**.
- Groupes de domaine avec ≥2 identités actives : **490** (inclut domaines événements/groupes = faux positifs).
- Groupes mixtes **legacy ↔ modern/linked** même domaine (motif Catégorie B) : **~14**.

**Recommandations anti-récidive (à coder AVANT toute correction de masse, hors de cette étape)**
1. Dans `ensure/sync_exhibitor_public_identity` : avant de créer une identité legacy, chercher une identité active existante par **domaine normalisé** ou **nom normalisé** ; si trouvée → rattacher (`linked`) au lieu de créer une 2ᵉ fiche.
2. Ne plus créer de miroir `exposants.id_exposant = UUID` qui casse l'upsert Airtable ; ou réconcilier le miroir avec l'ExporecID réel à l'arrivée de l'import.
3. En cas d'incertitude (domaine partagé, nom proche mais domaine différent) → **file de review** (`exhibitor_duplicate_reviews`), jamais de création/désactivation auto.

---

## C. Preview Catégorie B (legacy ↔ modern/linked) — dry-run uniquement

Critères : 1 identité `legacy` + 1 identité `linked`/`modern`, même domaine normalisé OU nom strictement identique/très proche, pas de conflit de site, **aucune** nouveauté/lead/owner/équipe/CRM sur l'identité candidate à la désactivation, aucune suppression de source.

- Groupes candidats estimés : **~14**, dont **BNBxTECH**.
- **Exemple BNBxTECH (état réel constaté)** :
  - `exposants` : `ExporecD3rJ5sf4jLHnLb` (Airtable réel, site `bnbxtech.com`, 0 participation) + miroir `90509172-…` (UUID, domaine `bnbxtech.com`, 1 participation).
  - `exhibitors` : `90509172-…` (owner présent, claimé).
  - identités : **`bnbxtech`** (`linked`, owner + participation + 1 nouveauté publiée → **à conserver**) et **`bnbxtech-2`** (`legacy`, ExporecID, 0 participation/0 dépendance → **désactivable plus tard**).
  - **Plan théorique** (non exécuté) : garder `bnbxtech` active ; rattacher l'ExporecID réel à cette identité (réconciliation legacy↔exhibitor) pour préserver les futurs imports Airtable ; désactiver `bnbxtech-2` ; **aucune** suppression de `exposants`/`exhibitors`. Préserve nouveauté, participation, ID Airtable réel, fiche unique.

---

## D. Preview Catégorie A_SAFE (même domaine + nom identique/proche) — dry-run uniquement

Inclus seulement si : même domaine **non partagé/générique** (hors blacklist, hors domaines partagés par >6 identités), nom identique ou très proche, aucun signal de danger, et **aucune** nouveauté/lead/owner/équipe/CRM sur la fiche à désactiver.

Exclus (→ validation manuelle, jamais auto) : **A2** (même domaine, noms différents), **D** (même nom, domaine différent), **E** (nom proche, domaine différent), **F** (présence nouveauté/lead/owner/CRM).

---

## E. Groupes manuels

- **A2 / D / E** : risque de faux positif élevé (domaines d'événements, groupes, marques distinctes, homonymes) → review humaine obligatoire.
- **F** : tout groupe touchant une donnée active (nouveauté/lead/owner/équipe/CRM des deux côtés) → review humaine, jamais d'automatisation.
- Volumes précis renvoyés par la RPC de preview au moment de l'exécution (calcul à la volée).

---

## F. Recommandation finale

- **Automatisable plus tard** : seulement Catégorie B + A_SAFE strictes (réconciliation = rattachement de lien + désactivation d'identité doublon, **sans** suppression de source).
- **Toujours manuel** : A2, D, E, F et tout domaine partagé.
- **À corriger d'abord dans le flux** : le miroir UUID + l'absence de réconciliation par domaine/nom dans `sync_exhibitor_public_identities` — sinon le doublon réapparaît au prochain import.

---

## Livrables techniques de cette étape (création seule, aucune exécution)

1. **Migration — RPC dry-run `admin_preview_exhibitor_identity_reconciliation()`**
   - `SECURITY DEFINER`, `is_admin()` requis, **lecture seule** (aucun INSERT/UPDATE/DELETE sur les tables métier).
   - Pour chaque groupe : identités publiques concernées, lignes `exposants`, lignes `exhibitors`, participations, nouveautés, leads, owner/équipe, CRM, ID Airtable réel si présent, ID UUID miroir si présent, et **statut** : `auto_reconcilable` / `manual_review` / `dangerous` / `likely_false_positive`.
   - Pour chaque groupe : identité à **garder active**, identité **désactivable plus tard**, données à conserver dans `exposants` vs `exhibitors`, lien à créer/corriger, remap participation éventuel — **en texte de plan, sans écriture**.
2. **Migration — table `public.exhibitor_duplicate_domain_blacklist`** (domaine, motif, créée vide) + GRANTs. **Non utilisée pour corriger** ; sert seulement à exclure les domaines partagés des futures previews. La RPC de preview la lira pour marquer `likely_false_positive`.

Rien d'autre n'est créé ni exécuté. Après approbation, je livre la RPC + la table, puis on lance la preview pour obtenir les volumes exacts (C/D/E) avant toute décision de correction réelle.
