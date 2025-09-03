# Configuration Google Maps Embed

## Configuration de la clé API

### 1. Créer une clé API Google Cloud

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer ou sélectionner un projet
3. Activer l'API **Maps Embed API**
4. Créer une clé API dans "Identifiants"

### 2. Restreindre la clé API (sécurité)

Dans la configuration de votre clé API, ajouter les restrictions suivantes :

**Restrictions d'application :**
- Type : Références HTTP (sites web)
- Références de sites web autorisées :
  ```
  https://lotexpo.com/*
  https://*.sandbox.lovable.dev/*
  ```

**Restrictions d'API :**
- Sélectionner uniquement : **Maps Embed API**

### 3. Ajouter la clé dans l'environnement

Créer un fichier `.env.local` à la racine du projet (ou ajouter dans `.env`) :

```bash
VITE_GOOGLE_MAPS_API_KEY=votre_cle_api_ici
```

### 4. Redémarrer le serveur de développement

```bash
npm run dev
```

## Fonctionnement

- **Priorité 1** : Coordonnées lat/lon (si disponibles)
- **Priorité 2** : Recherche par adresse complète
- **Fallback** : Message informatif avec lien vers Google Maps

## Cas de figure gérés

✅ **Clé API présente + adresse** → Carte Google Maps intégrée  
✅ **Clé API absente** → Message + lien externe  
✅ **Aucune donnée de localisation** → "Localisation non renseignée"  
✅ **Mobile responsive** → Carte adaptée à tous les écrans

## Coût

L'API Maps Embed est **gratuite et illimitée** pour l'affichage de cartes statiques via iframe.

## Composants modifiés

- `src/components/maps/EventMapEmbed.tsx` - Nouveau composant
- `src/components/event/EventSidebar.tsx` - Intégration dans la sidebar