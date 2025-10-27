# 🔍 DIAGNOSTIC COMPLET - Logos exposants ne s'affichent pas sur les nouveautés

**Date**: 2025-01-27  
**Problème**: Les logos des exposants ne s'affichent jamais sur les cards de nouveautés, même après upload réussi

---

## 📋 RÉSUMÉ DU PROBLÈME

Quand un utilisateur crée une nouveauté pour un exposant existant et uploade un logo:
- ✅ Le logo est bien sélectionné (visible dans la console: `📁 Logo sélectionné pour exposant existant: photo de profil.jpg`)
- ❌ Le logo n'est **jamais uploadé** vers Supabase Storage
- ❌ Le logo n'est **jamais sauvegardé** dans la table `exhibitors.logo_url`
- ❌ Le logo ne s'affiche pas sur la card de nouveauté (affiche l'avatar fallback avec initiale)

---

## 🔬 ANALYSE DES LOGS

### Logs lors de la sélection du logo
```
📁 Logo sélectionné pour exposant existant: photo de profil.jpg
```
✅ Le logo est bien détecté par le composant

### Logs lors de la création de la nouveauté
```javascript
🐛 DEBUG DÉTAILLÉ - Création nouveauté
📋 Exposant existant: {id: '3fa2fe58-03fd-4c1b-856d-6ca7bbfa9e89', approved: true}
🔍 DEBUG Logo exposant existant: {
  hasId: true, 
  exhibitorId: '3fa2fe58-03fd-4c1b-856d-6ca7bbfa9e89', 
  hasLogo: false,        // ❌ PROBLÈME ICI
  logoType: undefined,   // ❌ PROBLÈME ICI
  isFile: false,         // ❌ PROBLÈME ICI
  logoConstructor: undefined
}
ℹ️ Aucun logo à uploader pour cet exposant existant
```

**🚨 PROBLÈME IDENTIFIÉ**: Le logo sélectionné n'arrive JAMAIS dans `AddNoveltyStepper.tsx`

---

## 🗂️ ARCHITECTURE DES COMPOSANTS

### Flow de données pour l'upload de logo

```
Step1ExhibitorAndUser.tsx (ligne ~99-105)
    ↓
Stocke le logo dans l'état local:
- selectedExhibitorLogo (pour exposant existant)
- newExhibitorData.logo (pour nouvel exposant)
    ↓
Passe au parent via onUpdate() (ligne ~136)
    ↓
AddNoveltyStepper.tsx (ligne ~293+)
    ↓
Reçoit step1Data qui contient exhibitor
    ↓
Vérifie si exhibitor.logo existe (ligne ~372+)
    ↓ 
❌ FAIL: exhibitor.logo est undefined
```

---

## 🔍 CODE ACTUEL

### 1. Step1ExhibitorAndUser.tsx (ligne ~99)
```typescript
exhibitor: selectedExhibitor 
  ? { 
      id: selectedExhibitor.id, 
      name: selectedExhibitor.name, 
      website: selectedExhibitor.website || '',
      approved: selectedExhibitor.approved,
      logo: selectedExhibitorLogo || newExhibitorData.logo // Dernière tentative
    }
  : { 
      name: newExhibitorData.name, 
      website: newExhibitorData.website,
      logo: newExhibitorData.logo 
    }
```

**🔍 Question**: `selectedExhibitorLogo` contient-il le File ?

### 2. AddNoveltyStepper.tsx (ligne ~372+)
```typescript
if ('id' in step1.exhibitor && isValidUUID(step1.exhibitor.id)) {
  const exhibitor = step1.exhibitor as any;
  
  console.log('🔍 DEBUG Logo exposant existant:', {
    hasId: true,
    exhibitorId: exhibitor.id,
    hasLogo: 'logo' in exhibitor,
    logoType: exhibitor.logo?.constructor?.name,
    isFile: exhibitor.logo instanceof File,
    logoConstructor: exhibitor.logo?.constructor
  });
  
  const pendingLogo = exhibitor.logo;
  
  if (pendingLogo instanceof File) {
    // Upload vers Storage + UPDATE exhibitors
  } else {
    console.log('ℹ️ Aucun logo à uploader pour cet exposant existant');
  }
}
```

**Résultat actuel**: 
- `hasLogo: false` → La propriété `logo` n'existe même pas sur l'objet
- `logoType: undefined`
- `isFile: false`

---

## 💾 ÉTAT DE LA BASE DE DONNÉES

### Requête SQL pour vérifier les logos
```sql
SELECT id, name, logo_url 
FROM exhibitors 
WHERE name LIKE '%LEKO%' OR name LIKE '%ORIENT%';
```

**Résultat attendu**: `logo_url` est **NULL** pour tous les exposants testés

### Confirmation via NoveltyCard
```javascript
🎨 NoveltyCard - Exhibitor data: {
  id: '58538d4f-7eab-4d10-9088-e37dc11969d8', 
  name: 'LEKO', 
  logo_url: null,      // ❌ Confirme que le logo n'est jamais sauvegardé
  has_logo: false, 
  logo_length: undefined
}
```

---

## 🎯 CAUSE RACINE PROBABLE

Le logo sélectionné par l'utilisateur dans `Step1ExhibitorAndUser.tsx` **ne parvient jamais** à `AddNoveltyStepper.tsx`.

### Hypothèses par ordre de probabilité

#### **Hypothèse A** (TRÈS PROBABLE): État non synchronisé entre Step1 et AddNoveltyStepper
- `selectedExhibitorLogo` dans `Step1ExhibitorAndUser.tsx` contient bien le File
- MAIS lors de l'appel à `onUpdate()`, le logo est perdu ou non inclus
- Possible cause: timing de mise à jour d'état React

**Test à effectuer**:
```typescript
// Dans Step1ExhibitorAndUser.tsx, ligne ~136 (dans onUpdate)
console.log('🔍 DEBUG onUpdate appelé avec:', {
  selectedExhibitorLogo,
  hasSelectedExhibitorLogo: !!selectedExhibitorLogo,
  selectedExhibitorLogoType: selectedExhibitorLogo?.constructor?.name,
  newExhibitorDataLogo: newExhibitorData.logo,
  hasNewExhibitorDataLogo: !!newExhibitorData.logo
});
```

#### **Hypothèse B**: L'objet exhibitor est recréé sans le logo
- L'objet passé à `onUpdate()` contient le logo
- MAIS `AddNoveltyStepper.tsx` recrée l'objet en perdant le logo

**Test à effectuer**:
```typescript
// Dans AddNoveltyStepper.tsx, juste après réception de step1Data
console.log('🔍 DEBUG step1Data reçu:', {
  step1Data,
  hasExhibitor: !!step1Data.exhibitor,
  exhibitorKeys: Object.keys(step1Data.exhibitor || {}),
  exhibitorLogo: step1Data.exhibitor?.logo,
  exhibitorLogoType: step1Data.exhibitor?.logo?.constructor?.name
});
```

#### **Hypothèse C**: Le File est sérialisé/désérialisé quelque part
- React Query ou un autre middleware sérialise l'état
- Les objets File ne survivent pas à la sérialisation JSON

**Test à effectuer**:
```typescript
// Vérifier si le logo passe par JSON.stringify quelque part
const testFile = new File(['test'], 'test.jpg');
console.log('Test sérialisation:', {
  avant: testFile,
  apres: JSON.parse(JSON.stringify({ file: testFile }))
});
// Résultat attendu: apres.file sera {} (objet vide)
```

---

## 🛠️ SOLUTIONS POSSIBLES

### Solution 1: Séparer le logo de l'objet exhibitor
Au lieu de passer le logo dans `exhibitor.logo`, le passer dans une propriété séparée:

```typescript
// Dans Step1ExhibitorAndUser.tsx
onUpdate({ 
  exhibitor: { id, name, website, approved }, // Sans logo
  exhibitorLogo: selectedExhibitorLogo  // Logo séparé
});

// Dans AddNoveltyStepper.tsx
const { exhibitor, exhibitorLogo } = step1Data;
if (exhibitorLogo instanceof File) {
  // Upload
}
```

### Solution 2: Utiliser un ref pour stocker le logo
```typescript
// Dans AddNoveltyStepper.tsx
const exhibitorLogoRef = useRef<File | null>(null);

// Dans Step1 callback
exhibitorLogoRef.current = selectedExhibitorLogo;

// Dans handleSubmit
const logoFile = exhibitorLogoRef.current;
if (logoFile instanceof File) {
  // Upload
}
```

### Solution 3: Upload immédiat lors de la sélection
```typescript
// Dans Step1ExhibitorAndUser.tsx
const handleLogoChange = async (file: File) => {
  // Upload immédiatement
  const url = await uploadLogoToStorage(file);
  
  // Stocker l'URL au lieu du File
  setSelectedExhibitorLogoUrl(url);
  
  // Passer l'URL au parent
  onUpdate({ 
    exhibitor: { 
      ...selectedExhibitor, 
      pendingLogoUrl: url  // URL au lieu de File
    } 
  });
};
```

### Solution 4: Créer un contexte dédié aux fichiers
```typescript
// FileUploadContext.tsx
const FileUploadContext = createContext<{
  exhibitorLogo: File | null;
  setExhibitorLogo: (file: File | null) => void;
}>();

// Accessible depuis n'importe quel composant enfant
// Les Files restent en mémoire sans sérialisation
```

---

## 📊 ÉTAT DES CORRECTIONS DÉJÀ TENTÉES

1. ✅ Ajout de logs de debug dans `AddNoveltyStepper.tsx`
2. ✅ Ajout de logs de debug dans `NoveltyCard.tsx`
3. ✅ Vérification de la requête `useNovelties` (elle récupère bien `logo_url`)
4. ✅ Invalidation agressive du cache React Query
5. ✅ Modification de `Step1ExhibitorAndUser.tsx` pour prioriser `selectedExhibitorLogo`
6. ❌ Aucune de ces corrections n'a résolu le problème

---

## 🎯 PROCHAINES ÉTAPES RECOMMANDÉES

### 1. Ajout de logs dans Step1ExhibitorAndUser.tsx
```typescript
// Ligne ~75 (dans handleExhibitorLogoChange)
const handleExhibitorLogoChange = (file: File | null) => {
  console.log('📸 Logo changé dans Step1:', {
    file,
    fileName: file?.name,
    fileSize: file?.size,
    fileType: file?.type,
    isFile: file instanceof File
  });
  setSelectedExhibitorLogo(file);
};

// Ligne ~136 (dans useEffect onUpdate)
console.log('🔄 Step1 onUpdate appelé avec:', {
  selectedExhibitor,
  selectedExhibitorLogo,
  hasLogo: !!selectedExhibitorLogo,
  logoFileName: selectedExhibitorLogo?.name,
  exhibitorObject: selectedExhibitor ? {
    id: selectedExhibitor.id,
    name: selectedExhibitor.name,
    logo: selectedExhibitorLogo || newExhibitorData.logo
  } : null
});
```

### 2. Vérifier la réception dans AddNoveltyStepper
```typescript
// Au début de handleSubmit (ligne ~293)
console.log('🎬 handleSubmit démarré avec:', {
  step1Data,
  exhibitor: step1Data.exhibitor,
  exhibitorKeys: Object.keys(step1Data.exhibitor || {}),
  hasLogoKey: 'logo' in (step1Data.exhibitor || {}),
  logoValue: step1Data.exhibitor?.logo,
  logoType: step1Data.exhibitor?.logo?.constructor?.name
});
```

### 3. Créer une nouveauté de test et observer les logs
- Ouvrir la console navigateur
- Sélectionner un exposant existant
- Uploader un logo
- Observer les logs dans l'ordre:
  1. `📸 Logo changé dans Step1:`
  2. `🔄 Step1 onUpdate appelé avec:`
  3. `🎬 handleSubmit démarré avec:`
  4. `🔍 DEBUG Logo exposant existant:`

### 4. Identifier à quelle étape le logo est perdu
- Si le logo est présent dans `📸` et `🔄` mais absent dans `🎬` → Problème de transmission entre composants
- Si le logo est présent dans `🎬` mais absent dans `🔍` → Problème de destructuration/transformation de l'objet
- Si le logo est absent dès `📸` → Problème dans le composant de sélection de fichier

---

## 📝 FICHIERS CONCERNÉS

### Fichiers principaux
1. **`src/components/novelty/steps/Step1ExhibitorAndUser.tsx`** (ligne ~75, ~99, ~136)
   - Gère la sélection du logo
   - Stocke dans `selectedExhibitorLogo`
   - Passe au parent via `onUpdate()`

2. **`src/components/novelty/AddNoveltyStepper.tsx`** (ligne ~293, ~372)
   - Reçoit les données de Step1
   - Devrait uploader le logo vers Storage
   - Devrait UPDATE `exhibitors.logo_url`

3. **`src/components/novelty/NoveltyCard.tsx`** (ligne ~30)
   - Affiche la nouveauté
   - Récupère `exhibitors.logo_url` depuis la base
   - Affiche l'avatar avec le logo ou les initiales

### Fichiers de support
4. **`src/hooks/useNovelties.ts`**
   - Requête Supabase pour récupérer les novelties
   - Inclut bien `exhibitors(logo_url)`

5. **`src/lib/novelty/uploads.ts`**
   - Fonctions d'upload vers Supabase Storage
   - Utilisées pour les images de nouveautés (fonctionne)
   - Devrait être utilisée pour les logos d'exposants (ne l'est pas)

---

## 🔍 REQUÊTES SUPABASE À VÉRIFIER

### 1. Vérifier l'état actuel des logos en base
```sql
SELECT 
  e.id, 
  e.name, 
  e.logo_url,
  e.logo_url IS NOT NULL as has_logo,
  COUNT(n.id) as novelty_count
FROM exhibitors e
LEFT JOIN novelties n ON n.exhibitor_id = e.id
WHERE e.name IN ('LEKO', 'LA TANNERIE VÉGÉTALE', 'Orient Express')
GROUP BY e.id, e.name, e.logo_url;
```

### 2. Vérifier les fichiers dans le bucket avatars
```sql
SELECT 
  name,
  created_at,
  updated_at,
  metadata
FROM storage.objects
WHERE bucket_id = 'avatars'
ORDER BY created_at DESC
LIMIT 20;
```

**Résultat attendu**: Aucun fichier récent (confirme que l'upload n'a jamais lieu)

### 3. Vérifier les permissions RLS sur storage.objects
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
```

---

## 💡 INSIGHTS SUPPLÉMENTAIRES

### Pourquoi les images de nouveautés fonctionnent mais pas les logos ?

**Images de nouveautés** (`step2Data.images`):
```typescript
// Dans AddNoveltyStepper.tsx, ligne ~420
const imageFiles = step2Data.images.filter((img): img is File => img instanceof File);
const uploadedImages = await uploadNoveltyImages(imageFiles);
```
✅ Fonctionne car les images sont passées directement en tant que `File[]`

**Logos d'exposants** (`step1Data.exhibitor.logo`):
```typescript
// Dans AddNoveltyStepper.tsx, ligne ~372
const pendingLogo = exhibitor.logo;
if (pendingLogo instanceof File) { /* ... */ }
```
❌ Ne fonctionne pas car `exhibitor.logo` est `undefined`

**Différence clé**: Les images sont dans une propriété dédiée `images: File[]`, tandis que le logo est intégré dans un objet complexe `exhibitor: { id, name, logo }`.

---

## 🚀 RECOMMANDATION FINALE

**Solution recommandée**: Séparer le logo de l'objet exhibitor (Solution 1)

**Raison**: 
- Les objets File ne se transmettent pas bien à travers les props React complexes
- Les images de nouveautés fonctionnent car elles sont dans un array dédié
- Appliquer la même logique pour le logo d'exposant

**Implémentation**:
```typescript
// Type Step1Data (à créer/modifier)
interface Step1Data {
  exhibitor: {
    id?: string;
    name: string;
    website?: string;
    approved?: boolean;
  };
  exhibitorLogo?: File;  // Logo séparé
  user?: User;
}
```

**Modification requise**:
1. Modifier `Step1ExhibitorAndUser.tsx` pour passer le logo séparément
2. Modifier `AddNoveltyStepper.tsx` pour récupérer `step1Data.exhibitorLogo`
3. Uploader `exhibitorLogo` avec la même logique que les images

---

## 📞 CONTACT / DEBUGGING

Pour continuer le debug:
1. Ajouter les logs recommandés (section "Prochaines étapes")
2. Créer une nouveauté de test
3. Copier la sortie console complète
4. Identifier à quelle étape le logo est perdu
5. Appliquer la solution correspondante

---

**Document créé le**: 2025-01-27  
**Dernière mise à jour**: 2025-01-27  
**Statut**: En attente de tests supplémentaires
