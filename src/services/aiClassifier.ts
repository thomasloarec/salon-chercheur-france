
import type { ScrapedEvent, ClassificationResult } from '@/types/scraping';

export class AIClassifier {
  private static readonly PROFESSIONAL_KEYWORDS = [
    'salon', 'expo', 'exposition', 'congrès', 'convention', 'forum',
    'b2b', 'professionnel', 'industriel', 'technique', 'innovation',
    'technologie', 'numérique', 'digital', 'startup', 'entreprise',
    'industrie', 'manufacturing', 'équipement', 'solutions',
    'médical', 'santé', 'pharmaceutique', 'biotechnologie',
    'agroalimentaire', 'alimentaire', 'agriculture',
    'btp', 'construction', 'bâtiment', 'architecture',
    'énergie', 'environnement', 'développement durable',
    'finance', 'assurance', 'banque', 'investissement',
    'transport', 'logistique', 'automobile', 'aéronautique',
    'textile', 'mode', 'luxe', 'cosmétique',
    'immobilier', 'retail', 'commerce', 'distribution',
    'sécurité', 'informatique', 'software', 'hardware'
  ];

  private static readonly LEISURE_KEYWORDS = [
    'festival', 'concert', 'spectacle', 'théâtre', 'danse',
    'musique', 'artiste', 'show', 'divertissement',
    'mariage', 'bien-être', 'beauté', 'spa', 'détente',
    'loisir', 'hobby', 'passion', 'amateur',
    'gaming', 'jeux vidéo', 'cosplay', 'manga', 'anime',
    'sport', 'fitness', 'course', 'marathon',
    'gastronomie', 'dégustation', 'vin', 'bière',
    'artisanat', 'art', 'peinture', 'sculpture',
    'famille', 'enfant', 'jouet', 'puériculture'
  ];

  private static readonly SECTOR_KEYWORDS = {
    'Technologie': ['tech', 'digital', 'numérique', 'ia', 'intelligence artificielle', 'robotique', 'startup', 'innovation', 'software', 'hardware', 'informatique'],
    'Industrie': ['industrie', 'manufacturing', 'production', 'usine', 'équipement', 'machine', 'mécanique', 'métallurgie'],
    'Santé': ['médical', 'santé', 'pharmaceutique', 'biotechnologie', 'hopital', 'clinique', 'thérapie', 'dispositif médical'],
    'BTP': ['btp', 'construction', 'bâtiment', 'architecture', 'immobilier', 'travaux', 'génie civil', 'urbanisme'],
    'Agroalimentaire': ['agroalimentaire', 'alimentaire', 'agriculture', 'food', 'bio', 'organic', 'ferme', 'élevage'],
    'Énergie': ['énergie', 'environnement', 'durable', 'écologie', 'renouvelable', 'solaire', 'éolien', 'nucléaire'],
    'Transport': ['transport', 'logistique', 'automobile', 'aéronautique', 'maritime', 'ferroviaire', 'mobilité'],
    'Finance': ['finance', 'banque', 'assurance', 'investissement', 'fintech', 'blockchain', 'crypto']
  };

  static classifyEvent(event: Partial<ScrapedEvent>): ClassificationResult {
    const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    
    // Calculate professional score
    const professionalScore = this.calculateProfessionalScore(text);
    
    // Detect sector
    const sector = this.detectSector(text);
    
    // Extract tags
    const tags = this.extractTags(text);

    return {
      isProfessional: professionalScore >= 0.6,
      professionalScore,
      sector,
      tags,
      confidence: this.calculateConfidence(professionalScore, sector)
    };
  }

  private static calculateProfessionalScore(text: string): number {
    let positiveScore = 0;
    let negativeScore = 0;
    let totalMatches = 0;

    // Count professional keywords
    for (const keyword of this.PROFESSIONAL_KEYWORDS) {
      if (text.includes(keyword)) {
        positiveScore += 1;
        totalMatches++;
      }
    }

    // Count leisure keywords (negative score)
    for (const keyword of this.LEISURE_KEYWORDS) {
      if (text.includes(keyword)) {
        negativeScore += 2; // Stronger penalty for leisure keywords
        totalMatches++;
      }
    }

    // Base score considerations
    let baseScore = 0.5; // Neutral starting point

    // Boost for strong professional indicators
    if (text.includes('b2b') || text.includes('professionnel')) {
      baseScore += 0.2;
    }

    // Calculate final score
    const keywordScore = totalMatches > 0 ? (positiveScore - negativeScore) / totalMatches : 0;
    const finalScore = Math.max(0, Math.min(1, baseScore + keywordScore * 0.3));
    
    return Math.round(finalScore * 100) / 100;
  }

  private static detectSector(text: string): string {
    let bestSector = 'Autre';
    let maxMatches = 0;

    for (const [sector, keywords] of Object.entries(this.SECTOR_KEYWORDS)) {
      let matches = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matches++;
        }
      }
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestSector = sector;
      }
    }

    return bestSector;
  }

  private static extractTags(text: string): string[] {
    const tags = new Set<string>();
    
    // Extract based on found keywords
    for (const keyword of this.PROFESSIONAL_KEYWORDS) {
      if (text.includes(keyword)) {
        tags.add(keyword);
      }
    }

    // Limit to most relevant tags
    return Array.from(tags).slice(0, 5);
  }

  private static calculateConfidence(professionalScore: number, sector: string): number {
    let confidence = 0.5;
    
    // Higher confidence for extreme scores
    if (professionalScore > 0.8 || professionalScore < 0.2) {
      confidence += 0.3;
    }
    
    // Higher confidence if we detected a specific sector
    if (sector !== 'Autre') {
      confidence += 0.2;
    }
    
    return Math.min(1, confidence);
  }
}
