import { htmlToPlainText, normalizeRichTextHtml, plainTextToHtml } from '@/lib/richTextPlain';

describe('richTextPlain', () => {
  it('conserve les paragraphes et les retours simples du texte brut', () => {
    expect(plainTextToHtml('Premier paragraphe\nligne suivante\n\nDeuxième paragraphe')).toBe(
      '<p>Premier paragraphe<br/>ligne suivante</p><p>Deuxième paragraphe</p>',
    );
  });

  it('ne double pas les balises HTML déjà présentes', () => {
    expect(normalizeRichTextHtml('<p>Premier</p><p>Deuxième</p>')).toBe(
      '<p>Premier</p><p>Deuxième</p>',
    );
  });

  it('répare les anciennes balises de paragraphes échappées', () => {
    expect(normalizeRichTextHtml('&lt;p&gt;Premier&lt;/p&gt;&lt;p&gt;Deuxième&lt;/p&gt;')).toBe(
      '<p>Premier</p><p>Deuxième</p>',
    );
  });

  it('présente toujours du texte lisible dans le formulaire organisateur', () => {
    expect(htmlToPlainText('&lt;p&gt;Premier&lt;/p&gt;&lt;p&gt;Deuxième&lt;/p&gt;')).toBe(
      'Premier\n\nDeuxième',
    );
  });
});