
export class TextClassifier {
  detectSector(text: string): string {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('tech') || textLower.includes('digital') || textLower.includes('numérique')) return 'Technologie';
    if (textLower.includes('industrie') || textLower.includes('manufacturing')) return 'Industrie';
    if (textLower.includes('médical') || textLower.includes('santé') || textLower.includes('pharma')) return 'Santé';
    if (textLower.includes('btp') || textLower.includes('construction') || textLower.includes('bâtiment')) return 'BTP';
    if (textLower.includes('agro') || textLower.includes('alimentaire') || textLower.includes('agriculture')) return 'Agroalimentaire';
    if (textLower.includes('énergie') || textLower.includes('environnement')) return 'Énergie';
    if (textLower.includes('transport') || textLower.includes('automobile') || textLower.includes('logistique')) return 'Transport';
    if (textLower.includes('finance') || textLower.includes('banque') || textLower.includes('assurance')) return 'Finance';
    
    return 'Autre';
  }

  ruleBasedType(text: string): string {
    const textLower = text.toLowerCase();

    if (textLower.includes('salon')) return 'salon';
    if (textLower.includes('foire')) return 'salon';
    if (textLower.includes('convention')) return 'convention';
    if (textLower.includes('congres')) return 'congres';
    if (textLower.includes('conference')) return 'conference';
    if (textLower.includes('ceremonie')) return 'ceremonie';

    return 'inconnu';
  }

  extractTags(text: string): string[] {
    const textLower = text.toLowerCase();
    const tags: string[] = [];
    
    const keywords = ['innovation', 'technologie', 'digital', 'industrie', 'b2b', 'professionnel', 'salon', 'exposition'];
    
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        tags.push(keyword);
      }
    }
    
    return tags.slice(0, 5);
  }
}
