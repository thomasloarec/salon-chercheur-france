# Rejeu de validation — prompt `generer` v2 (novelty-ai-draft)

- Date : 2026-07-25
- Fonction : `novelty-ai-draft` (avec `prompt_version_override: 2`)
- Modèle : `claude-opus-4-8`
- Analyse : prompt actif (v1), sans override
- Couple réel : exposant `473efac5-99e8-469f-9250-3aadeaf5ef85` / salon SEPEM Toulouse `af60b54c-ef23-44e9-b6f7-68b70e787897`
- Cas rejoués : C1, C3, C4, C5, C7 (C2 et C6 exclus : analyse insuffisante, refus serveur attendu `matiere_insuffisante`)

Note : `note_expert` a été ajouté au normaliseur d'angles de la fonction ; il est désormais restitué dans les réponses.

---

## C1 — type déclaré `Demo`

Texte figé :

```
Nous ferons déguster notre nouvelle huile d'olive AOP Nyons millésime 2025 sur le stand, en continu pendant les trois jours du salon.
```

HTTP 200 — `prompt_version`: 2 — `model`: claude-opus-4-8

Notes d'expert par angle :

- **a1 — Dégustation en continu sur le stand** : On ouvre sur le fait qu'une huile se juge au goût, ce qui justifie naturellement la dégustation et met le visiteur en position d'évaluateur. Le seul fait fort de votre message est la dégustation en continu : je l'ai mis au centre plutôt que de meubler avec des promesses absentes de votre texte.
- **a2 — L'appellation AOP Nyons comme repère** : Cet angle ouvre sur l'appellation, seul élément de preuve dont vous disposez, pour les acheteurs qui raisonnent d'abord en termes de références et de garanties d'origine. À privilégier si votre cible est plutôt achats et référencement plutôt que découverte sensorielle.

Réponse JSON intégrale :

```json
{
  "angles": [
    {
      "id": "a1",
      "libelle": "Dégustation en continu sur le stand",
      "ouverture": "possibilite",
      "temps_utilises": [
        "hero",
        "mission",
        "experience"
      ],
      "temps_ecartes": [],
      "title": "Dégustation de l'huile d'olive AOP Nyons millésime 2025 sur le stand",
      "type": "Demo",
      "reason_1": "Une huile d'olive AOP Nyons se juge au goût, pas sur une fiche. Le millésime 2025 sera proposé à la dégustation sur le stand, en continu pendant les trois jours du salon. Vous pouvez passer quand votre visite vous en laisse le temps, sans créneau à réserver, pour évaluer par vous-même le profil de ce nouveau millésime.",
      "reason_2": "L'appellation AOP Nyons encadre l'origine et le mode de production. La dégustation vous permet de confronter cette garantie à votre propre appréciation, avant toute décision.",
      "reason_3": null,
      "summary": "Dégustation en continu du nouveau millésime 2025 de l'huile d'olive AOP Nyons, sur le stand pendant les trois jours du salon.",
      "audience_tags": [
        "achats",
        "restauration",
        "épicerie fine",
        "distribution"
      ],
      "note_expert": "On ouvre sur le fait qu'une huile se juge au goût, ce qui justifie naturellement la dégustation et met le visiteur en position d'évaluateur. Le seul fait fort de votre message est la dégustation en continu : je l'ai mis au centre plutôt que de meubler avec des promesses absentes de votre texte."
    },
    {
      "id": "a2",
      "libelle": "L'appellation AOP Nyons comme repère",
      "ouverture": "fait",
      "temps_utilises": [
        "hero",
        "preuve",
        "experience"
      ],
      "temps_ecartes": [],
      "title": "Huile d'olive AOP Nyons millésime 2025 à découvrir en dégustation",
      "type": "Demo",
      "reason_1": "L'AOP Nyons est une appellation d'origine protégée qui encadre l'origine et le mode de production de l'huile. Le millésime 2025 sera proposé à la dégustation sur le stand, en continu pendant les trois jours du salon. De quoi rattacher un nom d'appellation à un goût précis avant de le référencer.",
      "reason_2": "Passez au moment qui vous convient : la dégustation est ouverte en continu sur les trois jours, sans rendez-vous.",
      "reason_3": null,
      "summary": "Le millésime 2025 de l'huile d'olive AOP Nyons proposé à la dégustation, appellation d'origine protégée à découvrir sur le stand.",
      "audience_tags": [
        "achats",
        "épicerie fine",
        "restauration",
        "distribution"
      ],
      "note_expert": "Cet angle ouvre sur l'appellation, seul élément de preuve dont vous disposez, pour les acheteurs qui raisonnent d'abord en termes de références et de garanties d'origine. À privilégier si votre cible est plutôt achats et référencement plutôt que découverte sensorielle."
    }
  ],
  "faits_utilises": [
    "huile d'olive AOP Nyons millésime 2025",
    "dégustation sur le stand",
    "en continu pendant les trois jours du salon",
    "AOP Nyons est une appellation d'origine protégée"
  ],
  "temps_ecartes": [
    {
      "temps": "obstacle",
      "raison": "aucun obstacle ni difficulté énoncé dans la source"
    },
    {
      "temps": "beneficiaire",
      "raison": "aucun bénéficiaire précis nommé dans la source, seuls les profils visiteurs Lotexpo servent d'appui"
    },
    {
      "temps": "preuve_chiffree",
      "raison": "aucun chiffre, résultat ou client nommé dans la source"
    },
    {
      "temps": "exclusivite",
      "raison": "aucune primeur ou avant-première revendiquée dans la source"
    }
  ],
  "alertes": [],
  "model": "claude-opus-4-8",
  "prompt_version": 2
}
```

---

## C3 — type déclaré `Launch`

Texte figé :

```
Nous lançons la gamme Aurora, une déclinaison de notre collection Vento en douze nouveaux coloris pastel, disponible à partir de septembre pour la saison printemps-été.
```

HTTP 200 — `prompt_version`: 2 — `model`: claude-opus-4-8

Notes d'expert par angle :

- **a1 — Le lancement, centré sur la nouveauté de gamme** : On ouvre directement sur le fait concret, le lancement de la gamme et son rattachement à Vento, parce que c'est le seul élément solide fourni. Le titre porte le vocabulaire de recherche : Aurora, Vento, coloris pastel.
- **a2 — L'angle disponibilité et saisonnalité** : Cet angle met en avant la date de disponibilité et la saison, utiles pour un acheteur qui cale ses commandes. À privilégier si votre visiteur cible raisonne en calendrier d'assortiment plutôt qu'en gamme.

Réponse JSON intégrale :

```json
{
  "angles": [
    {
      "id": "a1",
      "libelle": "Le lancement, centré sur la nouveauté de gamme",
      "ouverture": "fait",
      "temps_utilises": [
        "hero",
        "mission",
        "exclusivite"
      ],
      "temps_ecartes": [],
      "title": "Aurora, nouvelle déclinaison de la collection Vento en douze coloris pastel",
      "type": "Launch",
      "reason_1": "La gamme Aurora arrive : une déclinaison de la collection Vento en douze nouveaux coloris pastel, disponible à partir de septembre pour la saison printemps-été. De quoi élargir le choix proposé sur Vento sans changer de collection de référence.",
      "reason_2": null,
      "reason_3": null,
      "summary": "Aurora, déclinaison de la collection Vento en douze coloris pastel, disponible dès septembre pour la saison printemps-été",
      "audience_tags": [
        "achats",
        "production",
        "direction"
      ],
      "note_expert": "On ouvre directement sur le fait concret, le lancement de la gamme et son rattachement à Vento, parce que c'est le seul élément solide fourni. Le titre porte le vocabulaire de recherche : Aurora, Vento, coloris pastel."
    },
    {
      "id": "a2",
      "libelle": "L'angle disponibilité et saisonnalité",
      "ouverture": "fait",
      "temps_utilises": [
        "hero",
        "mission",
        "exclusivite"
      ],
      "temps_ecartes": [],
      "title": "Douze coloris pastel Aurora disponibles dès septembre pour la saison printemps-été",
      "type": "Launch",
      "reason_1": "Disponible à partir de septembre, la gamme Aurora complète la collection Vento avec douze coloris pastel pensés pour la saison printemps-été. Pour qui prépare ses assortiments à l'avance, la fenêtre de disponibilité et le calendrier saisonnier sont les deux repères à retenir.",
      "reason_2": null,
      "reason_3": null,
      "summary": "Douze coloris pastel de la gamme Aurora, déclinaison de Vento, disponibles à partir de septembre pour le printemps-été",
      "audience_tags": [
        "achats",
        "direction"
      ],
      "note_expert": "Cet angle met en avant la date de disponibilité et la saison, utiles pour un acheteur qui cale ses commandes. À privilégier si votre visiteur cible raisonne en calendrier d'assortiment plutôt qu'en gamme."
    }
  ],
  "faits_utilises": [
    "lancement de la gamme Aurora",
    "Aurora est une déclinaison de la collection Vento",
    "douze nouveaux coloris pastel",
    "disponible à partir de septembre",
    "pour la saison printemps-été"
  ],
  "temps_ecartes": [
    {
      "temps": "obstacle",
      "raison": "obstacle_source nul, aucune difficulté énoncée dans la source"
    },
    {
      "temps": "conséquence",
      "raison": "aucun obstacle donc aucune conséquence"
    },
    {
      "temps": "preuve",
      "raison": "aucune ancre preuve ou tiers dans la source"
    },
    {
      "temps": "experience",
      "raison": "aucune activité de stand décrite (démonstration, essai, rendez-vous)"
    },
    {
      "temps": "beneficiaire",
      "raison": "beneficiaire_source nul, public déduit uniquement des profils Lotexpo"
    }
  ],
  "alertes": [],
  "model": "claude-opus-4-8",
  "prompt_version": 2
}
```

---

## C4 — type déclaré `Partnership`

Texte figé :

```
Nous annonçons un partenariat avec l'ADEME pour accompagner les industriels dans la mesure de l'empreinte carbone de leurs lignes de production. Les premiers audits conjoints démarrent en janvier.
```

HTTP 200 — `prompt_version`: 2 — `model`: claude-opus-4-8

Notes d'expert par angle :

- **a1 — Le partenariat par ce qu'il rend possible** : On ouvre sur ce que le partenariat permet concrètement (mesurer l'empreinte d'une ligne) plutôt que sur l'annonce du partenariat lui-même, parce que c'est le résultat qui intéresse l'industriel. Le nom de l'ADEME et le démarrage en janvier sont les deux seuls faits solides : ils portent tout l'angle.
- **a2 — Le tiers de confiance comme point d'entrée** : Ici l'ouverture met en avant l'ADEME dès le premier mot, car c'est l'élément qui rassure une direction. Choisissez cet angle si vous visez des décideurs sensibles à la caution institutionnelle, l'angle 1 si vous parlez d'abord aux équipes de production.
- **a3 — Le calendrier comme déclencheur** : On ouvre sur la date parce que c'est le seul élément d'exclusivité disponible et qu'un calendrier crée un motif de venir sur le stand. À réserver si vous pouvez, sur place, expliquer comment un visiteur rejoint ces premiers audits ; sinon l'angle 1 est plus sûr.

Réponse JSON intégrale :

```json
{
  "angles": [
    {
      "id": "a1",
      "libelle": "Le partenariat par ce qu'il rend possible",
      "ouverture": "possibilite",
      "temps_utilises": [
        "hero",
        "mission",
        "tiers",
        "exclusivite"
      ],
      "temps_ecartes": [],
      "title": "Audits carbone des lignes de production menés avec l'ADEME",
      "type": "Partnership",
      "reason_1": "Mesurer l'empreinte carbone d'une ligne de production devient un audit conjoint mené avec l'ADEME. Pour les industriels qui doivent objectiver leurs émissions, l'association réunit l'expertise des équipements de production et un cadre institutionnel reconnu. Les premiers audits conjoints démarrent en janvier.",
      "reason_2": "L'ADEME apporte la méthode et la légitimité publique, le partenaire industriel la connaissance des lignes de production. C'est cette combinaison qui rend l'audit exploitable.",
      "reason_3": "Un calendrier concret : les premiers audits conjoints démarrent en janvier. De quoi situer le stand comme point de départ d'une démarche déjà engagée.",
      "summary": "Un partenariat avec l'ADEME pour auditer l'empreinte carbone des lignes de production industrielles, dès janvier",
      "audience_tags": [
        "production",
        "direction",
        "achats",
        "rd"
      ],
      "note_expert": "On ouvre sur ce que le partenariat permet concrètement (mesurer l'empreinte d'une ligne) plutôt que sur l'annonce du partenariat lui-même, parce que c'est le résultat qui intéresse l'industriel. Le nom de l'ADEME et le démarrage en janvier sont les deux seuls faits solides : ils portent tout l'angle."
    },
    {
      "id": "a2",
      "libelle": "Le tiers de confiance comme point d'entrée",
      "ouverture": "fait",
      "temps_utilises": [
        "tiers",
        "mission",
        "exclusivite"
      ],
      "temps_ecartes": [],
      "title": "Empreinte carbone des lignes de production : partenariat avec l'ADEME",
      "type": "Partnership",
      "reason_1": "L'ADEME s'associe à cette démarche pour accompagner les industriels dans la mesure de l'empreinte carbone de leurs lignes de production. Pour une direction qui doit rendre des comptes sur ses émissions, l'implication de l'agence publique change la portée de l'audit. Les premiers audits conjoints démarrent en janvier.",
      "reason_2": "L'audit ne porte pas sur un bâtiment ni sur un bilan global, mais sur les lignes de production elles-mêmes. C'est à ce niveau que se prennent les décisions d'équipement.",
      "reason_3": null,
      "summary": "Mesurer l'empreinte carbone au niveau des lignes de production, via un partenariat avec l'ADEME, à partir de janvier",
      "audience_tags": [
        "direction",
        "achats",
        "production"
      ],
      "note_expert": "Ici l'ouverture met en avant l'ADEME dès le premier mot, car c'est l'élément qui rassure une direction. Choisissez cet angle si vous visez des décideurs sensibles à la caution institutionnelle, l'angle 1 si vous parlez d'abord aux équipes de production."
    },
    {
      "id": "a3",
      "libelle": "Le calendrier comme déclencheur",
      "ouverture": "fait",
      "temps_utilises": [
        "exclusivite",
        "mission",
        "tiers"
      ],
      "temps_ecartes": [],
      "title": "Premiers audits carbone conjoints ADEME pour lignes de production en janvier",
      "type": "Partnership",
      "reason_1": "Les premiers audits conjoints démarrent en janvier. Menés avec l'ADEME, ils portent sur la mesure de l'empreinte carbone des lignes de production. Pour les industriels qui veulent objectiver leurs émissions avant d'engager des investissements, ce calendrier fixe un point de départ concret.",
      "reason_2": "Une date affichée transforme une intention en démarche datée. Le stand devient l'endroit où comprendre comment s'inscrire dans ces premiers audits.",
      "reason_3": null,
      "summary": "Les premiers audits carbone conjoints avec l'ADEME sur les lignes de production démarrent en janvier",
      "audience_tags": [
        "production",
        "direction",
        "achats"
      ],
      "note_expert": "On ouvre sur la date parce que c'est le seul élément d'exclusivité disponible et qu'un calendrier crée un motif de venir sur le stand. À réserver si vous pouvez, sur place, expliquer comment un visiteur rejoint ces premiers audits ; sinon l'angle 1 est plus sûr."
    }
  ],
  "faits_utilises": [
    "partenariat avec l'ADEME",
    "accompagner les industriels dans la mesure de l'empreinte carbone de leurs lignes de production",
    "les premiers audits conjoints démarrent en janvier"
  ],
  "temps_ecartes": [
    {
      "temps": "obstacle",
      "raison": "obstacle_source nul, aucune difficulté énoncée dans la source"
    },
    {
      "temps": "consequence",
      "raison": "absente faute d'obstacle"
    },
    {
      "temps": "preuve",
      "raison": "aucun chiffre ni résultat dans la source"
    },
    {
      "temps": "experience",
      "raison": "aucune activité sur le stand décrite par l'exposant"
    }
  ],
  "alertes": [],
  "model": "claude-opus-4-8",
  "prompt_version": 2
}
```

---

## C5 — type déclaré `Demo`

Texte figé :

```
Conférence le mercredi 14h sur le stand : « Réduire de 30 % la consommation d'air comprimé sans changer de compresseur ». Retour d'expérience de trois sites clients, questions-réponses ouvertes.
```

HTTP 200 — `prompt_version`: 2 — `model`: claude-opus-4-8

Notes d'expert par angle :

- **a1 — La question technique posée par la conférence** : On ouvre sur la question du budget (faut-il racheter un compresseur ?) parce que c'est elle qui arrête un responsable production devant l'objectif des 30 %. Le titre porte le vocabulaire métier et le chiffre pour la recherche, la tension reste dans reason_1.
- **a2 — Le retour d'expérience de trois sites comme preuve** : Ici on ouvre sur le fait vérifié (trois sites) plutôt que sur la question, pour un public technique qui accorde plus de valeur au cas concret qu'à l'accroche. Choisissez cet angle si vous visez surtout la production et la R&D.
- **a3 — L'occasion concrète du rendez-vous** : On met le rendez-vous et son créneau au premier plan, utile à l'approche du salon pour aider le visiteur à planifier sa visite. Angle à privilégier dans une communication J-quelques jours plutôt que J-59.

Réponse JSON intégrale :

```json
{
  "angles": [
    {
      "id": "a1",
      "libelle": "La question technique posée par la conférence",
      "ouverture": "question",
      "temps_utilises": [
        "hero",
        "mission",
        "rendez_vous",
        "preuve"
      ],
      "temps_ecartes": [],
      "title": "Conférence air comprimé : réduire de 30 % la consommation sans changer de compresseur",
      "type": "Demo",
      "reason_1": "Faut-il vraiment investir dans un nouveau compresseur pour baisser sa facture d'air comprimé ? La conférence du mercredi 14h sur le stand aborde cette question de front, autour d'un objectif chiffré : réduire de 30 % la consommation sans remplacer l'équipement en place. Le propos s'appuie sur le retour d'expérience de trois sites clients, suivi d'un échange questions-réponses ouvert.",
      "reason_2": "L'annonce vise directement les responsables production et achats qui cherchent des marges d'efficacité énergétique sans engager un budget d'investissement lourd.",
      "reason_3": "Le format retour d'expérience puis questions-réponses permet de confronter les chiffres annoncés à sa propre installation, en direct.",
      "summary": "Conférence le mercredi 14h sur le stand E49 : réduire de 30 % la consommation d'air comprimé sans remplacer le compresseur, avec le retour de trois sites",
      "audience_tags": [
        "production",
        "achats",
        "direction",
        "rd"
      ],
      "note_expert": "On ouvre sur la question du budget (faut-il racheter un compresseur ?) parce que c'est elle qui arrête un responsable production devant l'objectif des 30 %. Le titre porte le vocabulaire métier et le chiffre pour la recherche, la tension reste dans reason_1."
    },
    {
      "id": "a2",
      "libelle": "Le retour d'expérience de trois sites comme preuve",
      "ouverture": "fait",
      "temps_utilises": [
        "hero",
        "preuve",
        "rendez_vous"
      ],
      "temps_ecartes": [],
      "title": "Retour de trois sites industriels sur la réduction de consommation d'air comprimé",
      "type": "Demo",
      "reason_1": "Trois sites clients ont travaillé leur consommation d'air comprimé sans changer de compresseur. Leurs enseignements sont présentés lors d'une conférence le mercredi 14h sur le stand, avec un objectif affiché de 30 % de réduction. La séance se termine par des questions-réponses ouvertes, pour rapprocher ces cas de sa propre installation.",
      "reason_2": "Pour un visiteur qui veut vérifier avant d'agir, entendre trois cas réels et pouvoir poser ses questions vaut mieux qu'une promesse générale.",
      "reason_3": null,
      "summary": "Le retour de trois sites clients sur la réduction de consommation d'air comprimé, présenté en conférence mercredi 14h sur le stand E49",
      "audience_tags": [
        "production",
        "achats",
        "rd",
        "direction"
      ],
      "note_expert": "Ici on ouvre sur le fait vérifié (trois sites) plutôt que sur la question, pour un public technique qui accorde plus de valeur au cas concret qu'à l'accroche. Choisissez cet angle si vous visez surtout la production et la R&D."
    },
    {
      "id": "a3",
      "libelle": "L'occasion concrète du rendez-vous",
      "ouverture": "possibilite",
      "temps_utilises": [
        "hero",
        "rendez_vous",
        "preuve"
      ],
      "temps_ecartes": [],
      "title": "Session air comprimé et efficacité énergétique : échange ouvert le mercredi sur le stand",
      "type": "Demo",
      "reason_1": "Mercredi à 14h, le stand accueille une session dédiée à l'efficacité énergétique de l'air comprimé, articulée autour d'un objectif de 30 % de réduction de consommation sans remplacement de compresseur. Le retour de trois sites clients sert de base à un temps de questions-réponses ouvert, où chacun peut apporter le cas de son installation.",
      "reason_2": "Le créneau est fixe et l'échange ouvert : c'est le moment à réserver dans son agenda de salon si l'air comprimé pèse sur ses coûts.",
      "reason_3": null,
      "summary": "Session air comprimé mercredi 14h sur le stand E49 : objectif 30 % de réduction, retour de trois sites et questions-réponses ouvertes",
      "audience_tags": [
        "production",
        "achats",
        "direction"
      ],
      "note_expert": "On met le rendez-vous et son créneau au premier plan, utile à l'approche du salon pour aider le visiteur à planifier sa visite. Angle à privilégier dans une communication J-quelques jours plutôt que J-59."
    }
  ],
  "faits_utilises": [
    "Conférence le mercredi 14h sur le stand",
    "Titre : réduire de 30 % la consommation d'air comprimé sans changer de compresseur",
    "Retour d'expérience de trois sites clients",
    "Questions-réponses ouvertes",
    "Stand E49 (contexte salon)"
  ],
  "temps_ecartes": [
    {
      "temps": "obstacle",
      "raison": "obstacle_source nul : aucune difficulté client énoncée dans la source, je n'ai décrit aucun manque ni limite"
    },
    {
      "temps": "consequence",
      "raison": "absente faute d'obstacle autorisé"
    },
    {
      "temps": "exclusivite",
      "raison": "aucune ancre exclusivite : rien n'indique une primeur ou avant-première"
    },
    {
      "temps": "preuve chiffrée de résultat",
      "raison": "les 30 % sont l'intitulé de la conférence, pas un résultat certifié attribué nommément ; formulé comme objectif de la session et non comme résultat garanti"
    }
  ],
  "alertes": [],
  "model": "claude-opus-4-8",
  "prompt_version": 2
}
```

---

## C7 — type déclaré `Launch`

Texte figé :

```
Sur les lignes d'embouteillage, les micro-fuites d'air comprimé passent inaperçues et représentent jusqu'à 30 % de la facture énergétique. Nous lançons AirScan, un capteur ultrasonique autonome qui les localise en continu sans arrêter la ligne. Démonstration sur maquette en fonctionnement toutes les heures sur le stand.
```

HTTP 200 — `prompt_version`: 2 — `model`: claude-opus-4-8

Notes d'expert par angle :

- **a1 — L'obstacle chiffré du gaspillage invisible** : On ouvre sur le chiffre de 30 % parce que c'est le fait qui fait lever les yeux d'un responsable production : le problème est nommé avant le produit. Le titre porte tout le vocabulaire métier pour la recherche, la tension reste dans reason_1.
- **a2 — La démonstration comme preuve visible** : Ici on met la démonstration en tête parce que la maquette horaire est un vrai atout concret : le visiteur sait exactement ce qu'il verra et pourquoi passer. À privilégier si vous visez des profils techniques qui veulent constater avant de croire.
- **a3 — L'angle énergie pour les achats et la direction** : On ouvre par une question de coût qui parle aux achats et à la direction, là où l'angle 2 parle aux techniciens. Choisissez cet angle si votre cible prioritaire décide sur le poste énergie, l'angle 2 si elle décide sur la performance technique.

Réponse JSON intégrale :

```json
{
  "angles": [
    {
      "id": "a1",
      "libelle": "L'obstacle chiffré du gaspillage invisible",
      "ouverture": "fait",
      "temps_utilises": [
        "obstacle",
        "consequence",
        "mission",
        "experience"
      ],
      "temps_ecartes": [],
      "title": "AirScan : capteur ultrasonique de détection des fuites d'air comprimé en continu",
      "type": "Launch",
      "reason_1": "Sur les lignes d'embouteillage, les micro-fuites d'air comprimé passent inaperçues et peuvent représenter jusqu'à 30 % de la facture énergétique. AirScan est un capteur ultrasonique autonome qui les localise en continu, sans arrêter la ligne. Une maquette en fonctionnement tourne sur le stand toutes les heures pour voir comment la détection opère en conditions réelles.",
      "reason_2": "Le repérage se fait sans immobiliser la production : la détection est continue et autonome, là où une fuite non traitée alourdit la consommation ligne après ligne.",
      "reason_3": null,
      "summary": "AirScan, capteur ultrasonique autonome, localise en continu les micro-fuites d'air comprimé sans arrêter la ligne d'embouteillage.",
      "audience_tags": [
        "production",
        "achats",
        "direction",
        "rd"
      ],
      "note_expert": "On ouvre sur le chiffre de 30 % parce que c'est le fait qui fait lever les yeux d'un responsable production : le problème est nommé avant le produit. Le titre porte tout le vocabulaire métier pour la recherche, la tension reste dans reason_1."
    },
    {
      "id": "a2",
      "libelle": "La démonstration comme preuve visible",
      "ouverture": "possibilite",
      "temps_utilises": [
        "experience",
        "mission"
      ],
      "temps_ecartes": [],
      "title": "Détection continue des fuites d'air comprimé : maquette AirScan en fonctionnement",
      "type": "Demo",
      "reason_1": "Voir un capteur repérer une micro-fuite d'air comprimé pendant que la ligne tourne, sans l'arrêter : c'est ce que montre la maquette en fonctionnement présentée toutes les heures sur le stand. AirScan, capteur ultrasonique autonome, y localise les fuites en continu. De quoi juger sur pièce d'une source de surconsommation habituellement invisible.",
      "reason_2": "Un créneau toutes les heures permet de caler le passage sur le stand sans attendre, et de constater la localisation en conditions de fonctionnement.",
      "reason_3": null,
      "summary": "Une maquette en fonctionnement montre toutes les heures comment AirScan localise les fuites d'air comprimé sans arrêter la ligne.",
      "audience_tags": [
        "production",
        "rd",
        "achats"
      ],
      "note_expert": "Ici on met la démonstration en tête parce que la maquette horaire est un vrai atout concret : le visiteur sait exactement ce qu'il verra et pourquoi passer. À privilégier si vous visez des profils techniques qui veulent constater avant de croire."
    },
    {
      "id": "a3",
      "libelle": "L'angle énergie pour les achats et la direction",
      "ouverture": "question",
      "temps_utilises": [
        "obstacle",
        "mission",
        "experience"
      ],
      "temps_ecartes": [],
      "title": "Réduire la part des fuites d'air comprimé dans la facture énergétique industrielle",
      "type": "Launch",
      "reason_1": "Quelle part de votre facture énergétique part dans des fuites d'air comprimé que personne ne voit ? Sur les lignes d'embouteillage, elles peuvent atteindre 30 %. AirScan, capteur ultrasonique autonome, les localise en continu sans interrompre la production. Une maquette en fonctionnement tourne sur le stand toutes les heures.",
      "reason_2": "Localiser une fuite est le préalable à la traiter : le capteur cible précisément où agir plutôt que de laisser la surconsommation se poursuivre.",
      "reason_3": null,
      "summary": "AirScan localise en continu les fuites d'air comprimé qui peuvent représenter jusqu'à 30 % de la facture énergétique d'une ligne.",
      "audience_tags": [
        "achats",
        "direction",
        "production"
      ],
      "note_expert": "On ouvre par une question de coût qui parle aux achats et à la direction, là où l'angle 2 parle aux techniciens. Choisissez cet angle si votre cible prioritaire décide sur le poste énergie, l'angle 2 si elle décide sur la performance technique."
    }
  ],
  "faits_utilises": [
    "micro-fuites d'air comprimé sur les lignes d'embouteillage",
    "jusqu'à 30 % de la facture énergétique",
    "AirScan, capteur ultrasonique autonome",
    "localise les fuites en continu sans arrêter la ligne",
    "démonstration sur maquette en fonctionnement toutes les heures sur le stand"
  ],
  "temps_ecartes": [
    {
      "temps": "tiers",
      "raison": "aucun client nommé ni certification dans la source"
    },
    {
      "temps": "exclusivite",
      "raison": "aucune mention de primeur ou d'avant-première dans la source"
    },
    {
      "temps": "preuve_resultat",
      "raison": "le 30 % décrit l'ampleur du problème, aucun résultat obtenu par AirScan n'est chiffré"
    }
  ],
  "alertes": [],
  "model": "claude-opus-4-8",
  "prompt_version": 2
}
```

---
