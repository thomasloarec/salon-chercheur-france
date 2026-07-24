# Jeu d'essai — novelty-ai-draft (C1 → C7)

Textes verbatim figés pour rejouer à l'identique le jeu d'essai des prompts
`analyser` / `generer` de l'Edge Function `novelty-ai-draft`.

À côté de la batterie Recherche IA (`.lovable/tests/recherche-ia-batterie-reference.md`),
ce document est la référence de non-régression : toute évolution des prompts
doit rejouer exactement ces sept textes, sur le même modèle, avant d'être
considérée comme validée.

## Modèle de référence — version 1

La version 1 des prompts a été validée avec :

- `ANTHROPIC_MODEL_STRONG` = `claude-opus-4-8` (surcharge d'environnement,
  le défaut du code étant `claude-sonnet-5`).

Un prompt calibré sur Opus ne se comporte pas nécessairement de la même façon
sur un modèle plus faible : si `ANTHROPIC_MODEL_STRONG` est un jour ramené à
`claude-sonnet-5` (ou plus bas) pour raison de coût, le jeu d'essai C1–C7 doit
être intégralement rejoué et le comportement narratif re-validé.

## Protocole

- `analyser` puis `generer` sur C1, C2, C3, C4, C5 et C7.
- `analyser` seul sur C6 (le système doit refuser de rédiger et poser une question).
- Couple `(exhibitor_id, event_id)` réel d'un salon à venir, identique pour tous
  les cas d'un même thème métier (industrie vs textile) pour garantir la
  cohérence texte / domaine exposant.

## Critères de rejet

- C1 à C5 produisant un temps `obstacle` ou toute évocation de difficulté
  alors qu'aucun obstacle n'est énoncé dans le texte source.
- C7 n'utilisant PAS le temps `obstacle` alors qu'un obstacle réel y est écrit.
- C6 produisant autre chose qu'une question (pas d'angles, pas de rédaction).
- `generer` produisant des angles alors que `analyser` a renvoyé
  `suffisant: false` (le serveur doit répondre HTTP 400 `matiere_insuffisante`
  avec la `question` de l'analyse).

---

## C1 — Dégustation · type déclaré : `Demo`

```
Nous ferons déguster notre nouvelle huile d'olive AOP Nyons millésime 2025 sur le stand, en continu pendant les trois jours du salon.
```

## C2 — Anniversaire · type déclaré : `Innovation`

```
Cette année, l'entreprise fête ses 50 ans. Nous présenterons une rétrospective de nos machines depuis 1976 et remettrons un livre retraçant cette histoire aux visiteurs du stand.
```

## C3 — Nouvelle gamme de coloris · type déclaré : `Launch`

```
Nous lançons la gamme Aurora, une déclinaison de notre collection Vento en douze nouveaux coloris pastel, disponible à partir de septembre pour la saison printemps-été.
```

## C4 — Partnership · type déclaré : `Partnership`

```
Nous annonçons un partenariat avec l'ADEME pour accompagner les industriels dans la mesure de l'empreinte carbone de leurs lignes de production. Les premiers audits conjoints démarrent en janvier.
```

## C5 — Conférence · type déclaré : `Demo`

```
Conférence le mercredi 14h sur le stand : « Réduire de 30 % la consommation d'air comprimé sans changer de compresseur ». Retour d'expérience de trois sites clients, questions-réponses ouvertes.
```

## C6 — Rien à annoncer · type déclaré : `Innovation`

```
Nous serons présents sur le salon et serons ravis de vous accueillir sur notre stand pour échanger sur vos projets.
```

Attendu : `analyser` renvoie `suffisant: false`, `ancres: []`, `question` non
nulle. Aucun appel `generer` ne doit être tenté (et s'il l'était, le serveur
doit répondre HTTP 400 `matiere_insuffisante`).

## C7 — Contre-épreuve, obstacle réel · type déclaré : `Launch`

```
Sur les lignes d'embouteillage, les micro-fuites d'air comprimé passent inaperçues et représentent jusqu'à 30 % de la facture énergétique. Nous lançons AirScan, un capteur ultrasonique autonome qui les localise en continu sans arrêter la ligne. Démonstration sur maquette en fonctionnement toutes les heures sur le stand.
```

Attendu : `analyser` extrait un `obstacle_source` réel (les micro-fuites),
et `generer` utilise le temps `obstacle` dans au moins un angle.
