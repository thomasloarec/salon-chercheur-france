# Pilotage Admin des campagnes email exposants

Objectif: transformer la gestion des campagnes en interface opérationnelle, avec arrêt manuel, motifs structurés, blacklist email durable, et KPIs.

## 1. Modèle de données (migrations)

### 1a. Nouvelle table `outreach_campaigns` (si pas déjà existante en tant qu'entité campagne par event)
Vérifier d'abord la structure réelle. D'après le contexte, les champs campagne vivent aujourd'hui sur la table `exhibitors` (campaign_status, current_step, next_send_date, contact_email, etc.) — ce qui mélange "entité société" et "entité campagne par événement". Les anciennes itérations parlent aussi d'une table `outreach_campaigns` + `outreach_contacts`.

Action: vérifier l'existence et le schéma exact de `outreach_campaigns` / `outreach_contacts` avant migration. Si elles existent, on s'appuie dessus. Sinon on les crée:

```
outreach_campaigns
- id (uuid)
- exhibitor_id (uuid)
- event_id (uuid)
- contact_email, contact_first_name, contact_last_name, contact_role
- campaign_status: enum [not_started, active, paused, completed, stopped, opted_out, blocked_invalid_email, novelty_published]
- current_step (int 0..3)
- last_sent_at, next_send_at
- stop_reason (enum, voir 1c)
- stop_note (text)
- stopped_at, stopped_by (uuid)
- email_source, hunter_status
- created_at, updated_at
- UNIQUE(exhibitor_id, event_id)
```

### 1b. Nouvelle table `email_blacklist` (blocage global d'une adresse)
```
email_blacklist
- id uuid
- email_normalized text UNIQUE (lowercased + trimmed)
- reason enum [invalid_address, opt_out_global, manual]
- source: enum [admin_manual, bounce, hunter, user_request]
- created_by uuid
- created_at
- note text
```
+ trigger BEFORE INSERT pour normaliser email.
+ index sur email_normalized.

### 1c. Nouveau type `outreach_stop_reason`
```
ENUM ('email_not_found', 'not_attending_event', 'not_interested',
      'do_not_contact', 'irrelevant_contact', 'handled_offline',
      'novelty_published', 'other')
```
Règle: `email_not_found` et `do_not_contact` → ajout automatique à `email_blacklist` (via trigger ou logique edge function). Les autres raisons → arrêt local seulement.

### 1d. Trigger / fonction `block_email_if_invalid()`
Quand une campagne passe en statut `stopped` avec `stop_reason in ('email_not_found','do_not_contact')`, insérer la `contact_email` dans `email_blacklist` (ON CONFLICT DO NOTHING).

### 1e. Helper SQL `is_email_blacklisted(text)` (security definer)
Utilisé par les workflows d'envoi (WF1/WF3) pour exclure ces adresses avant tout nouvel envoi.

### 1f. RLS
- `outreach_campaigns` / `email_blacklist`: lecture/écriture admin uniquement; service_role full.

## 2. Edge function `outreach-campaign-action`

POST avec actions:
- `stop`: { campaign_id, reason, note? } → set status `stopped`, vide `next_send_at`, set `stopped_at/by`, appelle blacklist si motif terminal.
- `resume`: réservé admin (réactive si motif local).
- `mark_email_invalid`: action rapide depuis liste.
- `mark_not_interested`: idem.

Authentification: dual-client (authClient pour vérifier admin, serviceClient pour mutations). Validation Zod.

## 3. UI Admin

### 3a. Nouveau composant `ExhibitorOutreachPanel`
Affiché dans la fiche entreprise (`AdminExhibitorDetailPanel`) en nouvel onglet **"Prospection email"**.

Contenu par campagne:
- Carte par événement: nom, dates, lien vers fiche événement
- Bloc contact: email + badge (Actif / Blacklisté / Opt-out / Invalide), prénom/nom/poste
- Badge statut campagne (mappé en libellés FR humains)
- Stepper 3 étapes (Email 1 / 2 / 3) avec dates
- Dernière action / prochaine action prévue
- Motif d'arrêt + note interne si applicable
- Bouton **"Arrêter la campagne"** → ouvre `StopCampaignDialog`
- Bouton "Marquer email invalide" (raccourci)

### 3b. Composant `StopCampaignDialog`
- Select obligatoire: motif (liste 1c, libellés FR)
- Textarea: note interne facultative
- Avertissement si motif = email_not_found ou do_not_contact: "Cette adresse sera blacklistée pour tous les futurs événements."
- Confirmation → appel edge function

### 3c. Liste exposants (`AdminExhibitorsList`)
Ajout colonnes compactes (responsive):
- Statut campagne (badge)
- Étape (1/3, 2/3, 3/3)
- Prochain envoi
- Badge "Email blacklisté" si applicable
+ Filtres rapides (chips): "À surveiller", "Stoppées", "Emails invalides", "Séquence active"
+ Actions rapides via menu kebab: Voir campagne / Arrêter / Marquer invalide / Pas intéressé

### 3d. Dashboard KPI (`AdminOutreachDashboard`)
Ajouter cartes KPI:
- Pilotage: en cours, terminées, stoppées manuellement, terminées via nouveauté, opt-out, email invalide, "société ne participe pas", "pas intéressé"
- Qualité base email: emails invalides détectés, emails blacklistés globalement, contacts non pertinents
- Conversion: campagnes → nouveauté publiée, taux de transformation, taux d'arrêt avant fin séquence, répartition par motif (mini bar chart)

## 4. Sécurité workflows automatiques (WF1/WF3)

Avant d'enrôler/relancer un contact, les edge functions d'envoi doivent:
1. Exclure si `campaign_status` terminal (`stopped`, `opted_out`, `completed`, `blocked_invalid_email`, `novelty_published`)
2. Exclure si `is_email_blacklisted(contact_email)` = true
3. Ne jamais réécrire `next_send_at` sur campagne stoppée

À auditer/patcher: fonctions existantes qui traitent les relances.

## 5. Mapping libellés FR (constants front)

```ts
const STOP_REASON_LABELS = {
  email_not_found: "Adresse email introuvable",
  not_attending_event: "Société ne participe pas à l'événement",
  not_interested: "Pas intéressé",
  do_not_contact: "Demande de ne plus être contacté",
  irrelevant_contact: "Contact non pertinent",
  handled_offline: "Déjà traité hors plateforme",
  novelty_published: "Nouveauté publiée",
  other: "Autre",
};
const CAMPAIGN_STATUS_LABELS = {
  not_started: "Non démarrée",
  active: "En cours",
  paused: "En pause",
  completed: "Terminée",
  stopped: "Arrêtée manuellement",
  novelty_published: "Terminée (nouveauté publiée)",
  opted_out: "Opt-out / ne plus contacter",
  blocked_invalid_email: "Email invalide",
};
```

## 6. Ordre de livraison

1. Lecture du schéma réel (`outreach_campaigns`, `outreach_contacts`) pour adapter
2. Migration DB (table blacklist + colonnes/enum stop_reason + trigger + helper + RLS)
3. Edge function `outreach-campaign-action`
4. Patch des edge functions d'envoi pour respecter blacklist + statuts terminaux
5. UI: `ExhibitorOutreachPanel` + `StopCampaignDialog` dans la fiche
6. UI: colonnes/filtres/actions rapides dans `AdminExhibitorsList`
7. UI: nouvelles KPI dans `AdminOutreachDashboard`
8. QA manuelle: arrêt → blacklist → tentative re-enrôlement bloquée

## Détails techniques

- Les enums Postgres seront créés via `CREATE TYPE`. Si `campaign_status` est aujourd'hui un `text` libre sur `exhibitors`, on garde `text` côté `outreach_campaigns` pour éviter une migration destructive et on contraint via CHECK.
- Normalisation email: `lower(trim(email))` côté trigger + côté edge function.
- Tous les écrans utilisent les tokens du design system (badges via `Badge` variants existants, pas de couleurs en dur).
- `@tanstack/react-query` pour fetch + invalidation après mutation.

## Hors scope (mentionné mais à plus tard)

- Catégorisation IA des réponses, sync Outlook, scoring qualité contacts: structure laissée extensible (champs `metadata jsonb` sur campagne, table `email_blacklist` réutilisable).

Validation finale: build TS OK + un test manuel d'arrêt avec motif `email_not_found` doit créer une ligne `email_blacklist`.
