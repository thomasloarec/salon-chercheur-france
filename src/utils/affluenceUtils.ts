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
  
  // Si c'est une chaîne, vérifier si elle est numérique
  const numericValue = parseInt(affluence, 10);
  
  // Si c'est un nombre valide
  if (!isNaN(numericValue) && isFinite(numericValue)) {
    return numericValue.toLocaleString('fr-FR');
  }
  
  // Sinon, retourner la valeur telle quelle (ex: "Inconnu")
  return affluence;
};

/**
 * Formate l'affluence avec le suffixe "visiteurs attendus"
 */
export const formatAffluenceWithSuffix = (affluence?: string | number): string => {
  const formatted = formatAffluence(affluence);
  
  // Si c'est un nombre, ajouter "visiteurs attendus"
  if (formatted !== 'Affluence inconnue' && formatted !== affluence) {
    return `${formatted} visiteurs attendus`;
  }
  
  // Sinon, retourner tel quel
  return formatted === 'Affluence inconnue' ? 'Affluence inconnue' : formatted;
};