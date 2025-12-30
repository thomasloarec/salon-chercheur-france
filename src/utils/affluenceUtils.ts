/**
 * Formate l'affluence d'un événement de manière sécurisée
 * @param affluence - La valeur d'affluence (nombre ou chaîne)
 * @returns Le texte formaté ou un message par défaut
 */
export const formatAffluence = (affluence?: string | number): string => {
  if (!affluence) return 'Affluence inconnue';
  
  // Si c'est déjà un nombre
  if (typeof affluence === 'number') {
    return affluence.toLocaleString('fr-FR');
  }
  
  // Nettoyer la chaîne : enlever les points (séparateurs de milliers) et les espaces
  const cleanedValue = String(affluence).replace(/\./g, '').replace(/\s/g, '').trim();
  
  // Si c'est une chaîne, vérifier si elle est numérique
  const numericValue = parseInt(cleanedValue, 10);
  
  // Si c'est un nombre valide et positif
  if (!isNaN(numericValue) && isFinite(numericValue) && numericValue > 0) {
    return numericValue.toLocaleString('fr-FR');
  }
  
  // Sinon, retourner la valeur telle quelle (ex: "Non communiqué")
  return affluence;
};

/**
 * Formate l'affluence avec le suffixe "visiteurs attendus"
 */
export const formatAffluenceWithSuffix = (affluence?: string | number): string => {
  if (!affluence) return 'Affluence inconnue';
  
  const formatted = formatAffluence(affluence);
  
  // Vérifier si le résultat formaté est un nombre valide (contient des chiffres)
  const hasValidNumber = /^\d/.test(formatted.replace(/\s/g, ''));
  
  // Si c'est un nombre valide, ajouter "visiteurs attendus"
  if (hasValidNumber && formatted !== String(affluence)) {
    return `${formatted} visiteurs attendus`;
  }
  
  // Si c'est "non communiqué" ou similaire, ne pas afficher
  const lowerAffluence = String(affluence).toLowerCase();
  if (lowerAffluence.includes('non communiqué') || lowerAffluence.includes('inconnu')) {
    return '';
  }
  
  // Sinon, retourner tel quel
  return formatted === 'Affluence inconnue' ? '' : formatted;
};