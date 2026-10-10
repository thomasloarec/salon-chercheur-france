import { renderToStaticMarkup } from 'react-dom/server';
import { PhoneFrame, BrowserFrame, phoneHeight, browserHeight, measuredWidth } from '../DeviceFrames';
import DesktopHomeMock from '../DesktopHomeMock';
import { HomePhone, ActionPhone, SavedPhone } from '../PhoneMockup';

describe('cadres', () => {
  it('PhoneFrame garde le ratio 844/390', () => {
    for (const w of [240, 260, 280, 300]) {
      expect(phoneHeight(w) / w).toBeCloseTo(844 / 390, 6);
      const html = renderToStaticMarkup(<PhoneFrame width={w} label="x">a</PhoneFrame>);
      const h = Number(/data-frame="phone"[^>]*height:([\d.]+)px/.exec(html)![1]);
      expect(h / w).toBeCloseTo(868 / 414, 3); // coque comprise, mêmes proportions de téléphone
    }
  });
  it('BrowserFrame garde le ratio 800/1280', () => {
    for (const w of [400, 640, 900]) expect(browserHeight(w) / w).toBeCloseTo(800 / 1280, 6);
    const html = renderToStaticMarkup(<BrowserFrame>a</BrowserFrame>);
    expect(html).toContain('width:100%;height:212.5px');
  });
  it('BrowserFrame dans un conteneur de 335 px : largeur 100 % et hauteur 335 × 800 / 1280', () => {
    // Mesure simulée : ResizeObserver renvoie 335 px, valeur passée en largeur initiale.
    const w = measuredWidth(335);
    expect(w).toBe(335);
    const html = renderToStaticMarkup(<BrowserFrame defaultWidth={w}>a</BrowserFrame>);
    expect(html).toContain(`width:100%;height:${(335 * 800) / 1280}px`);
    expect(measuredWidth(1400)).toBe(900);
  });
  it('DesktopHomeMock rend 7 lignes', () => {
    expect(renderToStaticMarkup(<DesktopHomeMock />).match(/data-row=""/g)).toHaveLength(7);
  });
  it('aria-label et contenu masqué', () => {
    for (const el of [<HomePhone />, <ActionPhone />, <SavedPhone />, <BrowserFrame><DesktopHomeMock /></BrowserFrame>]) {
      const html = renderToStaticMarkup(el);
      expect(html).toMatch(/role="img" aria-label="[^"]+"/);
      expect(html).toContain('aria-hidden="true"');
    }
  });
});
