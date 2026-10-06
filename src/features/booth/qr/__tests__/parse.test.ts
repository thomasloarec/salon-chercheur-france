import { parseQr, hasUsefulData } from '../parse';

describe('parseQr', () => {
  it('lit une vCard 3.0', () => {
    const r = parseQr(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Martin;Claire;;;\r\nFN:Claire Martin\r\nORG:Acme Industrie;Achats\r\nTITLE:Responsable achats\r\nEMAIL;TYPE=INTERNET:claire.martin@acme.fr\r\nTEL;TYPE=CELL:+33 6 12 34 56 78\r\nURL:https://www.acme.fr\r\nEND:VCARD',
    );
    expect(r.kind).toBe('vcard');
    expect(r.name).toBe('Claire Martin');
    expect(r.company).toBe('Acme Industrie');
    expect(r.job_title).toBe('Responsable achats');
    expect(r.email).toBe('claire.martin@acme.fr');
    expect(r.phone).toBe('+33 6 12 34 56 78');
    expect(r.domain).toBe('acme.fr');
  });

  it('lit une vCard 4.0', () => {
    const r = parseQr(
      'BEGIN:VCARD\nVERSION:4.0\nN:Durand;Paul;;;\nORG:Durand SAS\nEMAIL;TYPE=work:mailto:paul@durand.com\nTEL;VALUE=uri;TYPE=cell:tel:+33-7-00-00-00-00\nURL:https://linkedin.com/in/pauldurand\nEND:VCARD',
    );
    expect(r.kind).toBe('vcard');
    expect(r.name).toBe('Paul Durand');
    expect(r.email).toBe('paul@durand.com');
    expect(r.phone).toBe('+33-7-00-00-00-00');
    expect(r.linkedin_url).toBe('https://linkedin.com/in/pauldurand');
  });

  it('lit une MeCard', () => {
    const r = parseQr('MECARD:N:Bernard,Luc;ORG:Bernard et Fils;TEL:0612345678;EMAIL:luc@bernard.fr;URL:https://bernard.fr;;');
    expect(r.kind).toBe('mecard');
    expect(r.name).toBe('Luc Bernard');
    expect(r.company).toBe('Bernard et Fils');
    expect(r.phone).toBe('0612345678');
    expect(r.email).toBe('luc@bernard.fr');
  });

  it('reconnaît un lien LinkedIn', () => {
    const r = parseQr('https://www.linkedin.com/in/jeanne-dupont-123');
    expect(r.kind).toBe('linkedin');
    expect(r.linkedin_url).toBe('https://www.linkedin.com/in/jeanne-dupont-123');
  });

  it("propose le domaine d'un lien d'entreprise", () => {
    const r = parseQr('https://www.exemple-industrie.fr/contact?utm=badge');
    expect(r.kind).toBe('company_url');
    expect(r.domain).toBe('exemple-industrie.fr');
  });

  it('refuse un texte sans coordonnées', () => {
    const r = parseQr('BADGE-2026-000123');
    expect(r.kind).toBe('unknown');
    expect(hasUsefulData(r)).toBe(false);
  });

  it('extrait un email dans un texte', () => {
    expect(parseQr('Contact : marie@societe.fr merci').email).toBe('marie@societe.fr');
  });
});
