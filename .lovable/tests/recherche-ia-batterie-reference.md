# Batterie de référence — Recherche IA visiteur

**Lotexpo · 23 juillet 2026 · À exécuter AVANT toute modification de `recherche-ia-visiteur`**

---

## 1. Pourquoi cette batterie

Le lot 3b ajoute deux outils (`match_novelties_semantic`, `nouveautes_d_un_salon`) aux cinq déjà déclarés à l'agent. Le risque n'est pas la panne, c'est la dégradation silencieuse : un agent à qui l'on donne deux outils supplémentaires peut se mettre à les appeler sur des questions qui ne les appellent pas.

Le risque le plus probable est nommable précisément : **`exposants_d_un_salon` et `nouveautes_d_un_salon` portent des noms voisins et prennent le même argument.** Une confusion produirait « voici ce qui est présenté » avec la liste des exposants, ou l'inverse.

Aucun jeu de référence n'existe dans le dépôt. Sans mesure avant, on ne saura pas distinguer une amélioration d'une régression.

## 2. Ce dont on part

**Douze requêtes réelles journalisées** entre le 13 et le 21 juillet, dont neuf distinctes. Deux intentions seulement : `decouverte_salon` et `recherche_exposant`.

**Une observation qui change la lecture** : trois des quatre chips `SUGGESTIONS` de l'interface apparaissent mot pour mot dans le journal. Le trafic mesuré est donc largement composé de clics sur les suggestions du produit, pas de questions spontanées.

**Un défaut à corriger indépendamment de ce projet** : la chip « À quels salons exposent mes concurrents ? » est affichée à l'écran d'accueil et échoue trois fois sur trois au premier tour. Elle n'aboutit que lorsque l'utilisateur nomme ses concurrents au tour suivant. Le produit propose une question à laquelle il ne sait pas répondre.

**Une bonne nouvelle** : `preparation_visite` figure déjà dans `VALID_INTENTS` et n'a jamais été attribuée. C'est la case des questions Nouveauté. Aucune modification de taxonomie n'est nécessaire, et les nouveaux appels resteront visibles dans les statistiques.

---

## 3. La batterie

Vingt-six questions, cinq groupes.

### Groupe A — Régression sur les questions réellement posées

| # | Question | Intention attendue | Outils Nouveauté |
|---|---|---|---|
| A1 | donne moi les salons pour l'agroalimentaire | `decouverte_salon` | Ne doivent pas se déclencher |
| A2 | Salon à Lille | `decouverte_salon` | Ne doivent pas se déclencher |
| A3 | je cherche des salons où pourraient exposer des fabricants de systèmes d'assainissement non collectifs | `decouverte_salon` | Ne doivent pas se déclencher |
| A4 | Les prochains salons de la mode et du textile | `decouverte_salon` | Ne doivent pas se déclencher |
| A5 | Salons de la tech à Paris en 2026 | `decouverte_salon` | Ne doivent pas se déclencher |
| A6 | Où expose Banque Populaire ? | `recherche_exposant` | Ne doivent pas se déclencher |
| A7 | d'autres banques exposent-elles à des salons en septembre 2026 ? | `recherche_exposant` | Ne doivent pas se déclencher |
| A8 | À quels salons exposent mes concurrents ? | `recherche_exposant` | Ne doivent pas se déclencher |
| A9 | mes concurrents sont Celduc, Litelfuse, ETN, IFM | `recherche_exposant` | Ne doivent pas se déclencher |

A2 et A8 échouent aujourd'hui. Ce sont des échecs de référence : ils doivent rester au pire identiques, jamais empirer.

### Groupe B — Promesses de l'interface jamais éprouvées

| # | Question | Point de vigilance |
|---|---|---|
| B1 | Je cherche un salon pour la restauration | |
| B2 | Sur quel salon exposer si je vends du logiciel RH ? | Intention exposant, pas visiteur |
| B3 | Quels salons de la santé cet automne ? | Contrainte temporelle |
| B4 | Où rencontrer des distributeurs en agroalimentaire ? | |
| B5 | Quels exposants sur le prochain salon de l'industrie ? | **Doit répondre par les exposants, jamais par les Nouveautés** |

### Groupe C — Capacité nouvelle, les outils Nouveauté doivent se déclencher

| # | Question | Outil attendu |
|---|---|---|
| C1 | Qu'est-ce qui sera présenté de nouveau sur EUROSATORY ? | `nouveautes_d_un_salon` |
| C2 | Y a-t-il des démonstrations prévues sur EUROSATORY ? | `nouveautes_d_un_salon` avec `p_type='Demo'` |
| C3 | Qu'est-ce qui vaut le déplacement à MAKEUP IN PARIS ? | `nouveautes_d_un_salon` |
| C4 | Des nouveautés annoncées sur PRÉVENTICA GRAND OUEST ? | `nouveautes_d_un_salon` |
| C5 | Quelqu'un présente-t-il une innovation en emballage recyclable ? | `match_novelties_semantic` |
| C6 | Qu'est-ce qui sera présenté sur GLOBAL INDUSTRIE ? | `nouveautes_d_un_salon`, **une seule annonce pour 1 471 exposants** : la réponse doit le dire sans généraliser |

### Groupe D — Tests négatifs, les outils Nouveauté ne doivent PAS se déclencher

| # | Question | Ce qui serait une faute |
|---|---|---|
| D1 | Qui expose dans le domaine de la maintenance prédictive ? | Répondre par les seuls exposants ayant publié une annonce |
| D2 | Combien d'exposants sur GLOBAL INDUSTRIE ? | Confondre le nombre d'annonces et le nombre d'exposants |
| D3 | Quels sont les principaux thèmes de GLOBAL INDUSTRIE ? | Construire les thèmes sur l'unique annonce publiée |
| D4 | **Quelles sont les tendances du salon EUROSATORY ?** | **Le piège maximal**, voir ci-dessous |
| D5 | Où se trouve le salon SEPEM Toulouse ? | Appeler un outil Nouveauté sur une question pratique |
| D6 | Quels exposants en robotique sur JEC WORLD ? | Substituer les annonces au corpus exposants |

**D4 est le test décisif de tout le lot.** EUROSATORY porte sept Nouveautés pour sept participations indexées, alors que le salon en compte des milliers en réalité. Si l'agent généralise sur cette question, le lot 3b est à revoir, quels que soient les autres résultats.

### Groupe E — Robustesse

| # | Question | Attendu |
|---|---|---|
| E1 | Quelle est la recette de la tarte aux pommes ? | `hors_sujet`, refus poli |
| E2 | Salon des chatons mignons à Bordeaux | Aucun salon inventé |
| E3 | Qu'est-ce qui sera présenté sur un salon qui n'existe pas ? | `salon_introuvable` correctement restitué |
| E4 | Y a-t-il des conférences sur EUROSATORY ? | `Conference` n'existe pas dans l'enum : l'agent ne doit ni inventer un type, ni présenter des lancements comme des conférences |

---

## 4. Protocole d'exécution

### 4.1 Le plafond de crédits (révisé — 23/07/2026)

`check_ai_credits` accorde 999 999 crédits à tout compte portant le rôle `admin` (`has_role(p_user_id, 'admin')`), contre 6 en connecté simple et 3 en anonyme. Le passage s'exécute donc depuis `admin@lotexpo.com`, sans purge ni découpage en lots.

L'appel exige un jeton utilisateur valide : la fonction lit `Authorization` et appelle `getUser(jwt)`, avec un `401` si le jeton est absent ou invalide. Un `user_id` simulé côté `service_role` ne fonctionne pas. Le `service_role` frappe donc un jeton réel pour le compte admin via l'API d'administration (`auth.admin.generateLink` en `magiclink`, puis `verifyOtp` sur le `token_hash` pour obtenir une session), et la boucle l'utilise tel quel.

Ce chemin active `isAdmin`, qui contourne le rate-limit IP. D'après l'audit du 23/07, `isAdmin` n'influence ni le prompt système, ni la liste des outils, ni leurs paramètres : le comportement mesuré est celui d'une session navigateur. La contrepartie est que la batterie ne teste pas le limiteur de débit, ce qui est hors de son objet.

La même méthode devra être répliquée à l'identique après le lot 3b. Consigner en tête du fichier de résultats : compte utilisé, mode d'obtention du jeton, horodatages d'ouverture et de fermeture.

### 4.2 La pollution des analytics

`ai_search_events` ne contient que douze lignes réelles. Vingt-six questions de test y ajouteraient plus du double, et il n'existe pas de colonne permettant de les distinguer.

Plutôt que d'ajouter une colonne, relever l'horodatage d'ouverture et de fermeture de chaque passage et exclure la fenêtre dans les analyses ultérieures.

```sql
select now() as debut_batterie;   -- avant la première question
select now() as fin_batterie;     -- après la dernière
```

### 4.3 Relevé structuré

```sql
select question_rank, intent_type, answer_had_results,
       matched_exhibitor_count,
       coalesce(array_length(matched_event_ids, 1), 0) as nb_salons,
       left(query_sanitized, 80) as question,
       created_at
from ai_search_events
where created_at between '<debut_batterie>' and '<fin_batterie>'
order by created_at;
```

`ai_search_events` ne trace **pas les outils appelés** : consulter les logs de l'Edge Function `recherche-ia-visiteur` sur la fenêtre, ou juger sur le contenu de la réponse.

### 4.4 Archivage

Un fichier par passage, nommé par date, contenant pour chaque question : l'énoncé, la réponse **verbatim et intégrale**, l'intention classée, et l'aboutissement.

---

## 5. Grille de comparaison après 3b

| Constat | Verdict |
|---|---|
| Une question du groupe A ou B qui aboutissait n'aboutit plus | **Régression bloquante**, retour arrière |
| Une question du groupe D déclenche un outil Nouveauté | **Régression bloquante** |
| D4 produit un énoncé de tendance | **Échec du lot**, quels que soient les autres résultats |
| Une question du groupe C n'appelle aucun outil Nouveauté | Capacité non livrée, réglage des descriptions d'outils |
| C6 présente une annonce comme représentative de GLOBAL INDUSTRIE | La note de la RPC n'est pas suivie, renforcer la description d'outil |
| A2 ou A8, déjà en échec, restent en échec | Acceptable, hors périmètre |
| A2 ou A8 se mettent à aboutir | Amélioration, à noter mais non attendue |
| Une intention passe à `null` | La classification échoue, à investiguer |

---

## 6. Gain immédiat (appliqué le 23/07/2026)

La chip « À quels salons exposent mes concurrents ? » a été reformulée en « Mes concurrents sont X, Y et Z : à quels salons exposent-ils ? » dans `src/components/recherche-ia/RechercheIAChat.tsx` (option 1 du plan initial). Elle apprend désormais à l'utilisateur le format qui fonctionne dès le premier tour.
