import { useEffect } from 'react';

const THEME_COLOR = '#6b51ff';

type TagSpec = { tag: 'link' | 'meta'; attrs: Record<string, string>; selector: string };

const TAGS: TagSpec[] = [
  { tag: 'link', attrs: { rel: 'manifest', href: '/salon-manifest.webmanifest' }, selector: 'link[rel="manifest"]' },
  { tag: 'meta', attrs: { name: 'theme-color', content: THEME_COLOR }, selector: 'meta[name="theme-color"]' },
  { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, selector: 'meta[name="mobile-web-app-capable"]' },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, selector: 'meta[name="apple-mobile-web-app-capable"]' },
  {
    tag: 'meta',
    attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    selector: 'meta[name="apple-mobile-web-app-status-bar-style"]',
  },
  {
    tag: 'meta',
    attrs: { name: 'apple-mobile-web-app-title', content: 'Lotexpo Salon' },
    selector: 'meta[name="apple-mobile-web-app-title"]',
  },
];

/** Ajoute le manifeste et les balises d'application, uniquement sur les pages du mode salon. */
export function useSalonAppMeta() {
  useEffect(() => {
    const added: Element[] = [];
    TAGS.forEach(({ tag, attrs, selector }) => {
      if (document.head.querySelector(selector)) return;
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      added.push(el);
    });
    return () => added.forEach((el) => el.remove());
  }, []);
}
