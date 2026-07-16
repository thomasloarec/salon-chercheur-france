import { Link } from 'react-router-dom';
import { LotexpoWordmark } from '@/components/LotexpoWordmark';
import { CANONICAL_SECTORS } from '@/lib/taxonomy';
import { useConsent } from '@/contexts/ConsentContext';

const FOOTER_CITIES = [
  { name: 'Paris', slug: 'paris' },
  { name: 'Lyon', slug: 'lyon' },
  { name: 'Bordeaux', slug: 'bordeaux' },
  { name: 'Nantes', slug: 'nantes' },
  { name: 'Toulouse', slug: 'toulouse' },
  { name: 'Marseille', slug: 'marseille' },
  { name: 'Lille', slug: 'lille' },
  { name: 'Strasbourg', slug: 'strasbourg' },
];

const Footer = () => {
  const { openPreferences } = useConsent();
  return (
    <footer className="bg-surface-inverse text-inverse py-16">
      <div className="w-full px-6 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <LotexpoWordmark aria-label="Lotexpo" className="h-8 mb-4 w-auto text-inverse [--logo-accent:hsl(var(--primary-inverse))]" />
            <p className="text-primary-foreground/70 mb-4">
              Lotexpo centralise les salons professionnels en France et aide les entreprises à mieux préparer, suivre et valoriser leur présence sur les événements.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-inverse">Navigation</h4>
            <ul className="space-y-2">
              <li><Link to="/salons" className="text-inverse-muted hover:text-inverse-primary transition-colors">Salons</Link></li>
              <li><Link to="/salons-professionnels-2026" className="text-inverse-muted hover:text-inverse-primary transition-colors">Salons professionnels 2026</Link></li>
              <li><Link to="/nouveautes" className="text-inverse-muted hover:text-inverse-primary transition-colors">Nouveautés</Link></li>
              <li><Link to="/exposants" className="text-inverse-muted hover:text-inverse-primary transition-colors">Exposants</Link></li>
              <li><Link to="/radar-crm" className="text-inverse-muted hover:text-inverse-primary transition-colors">Radar CRM</Link></li>
              <li><Link to="/organisateurs" className="text-inverse-muted hover:text-inverse-primary transition-colors">Organisateurs de salons</Link></li>
              <li><Link to="/blog" className="text-inverse-muted hover:text-inverse-primary transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Sectors */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-inverse">Salons par secteur</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {CANONICAL_SECTORS.map(s => (
                <li key={s.value}>
                  <Link to={`/secteur/${s.value}`} className="text-inverse-muted hover:text-inverse-primary transition-colors text-xs leading-snug">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-inverse">Salons par ville</h4>
            <ul className="space-y-2">
              {FOOTER_CITIES.map(c => (
                <li key={c.slug}>
                  <Link to={`/ville/${c.slug}`} className="text-inverse-muted hover:text-inverse-primary transition-colors text-sm">
                    Salons à {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-inverse">Contact</h4>
            <ul className="space-y-2">
              <li><Link to="/contact" className="text-inverse-muted hover:text-inverse-primary transition-colors">Nous contacter</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-inverse/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-primary-foreground/70 text-sm">
              © {new Date().getFullYear()} Lotexpo. Tous droits réservés.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 md:mt-0">
              <Link to="/mentions-legales" className="text-inverse-muted hover:text-inverse-primary text-sm transition-colors">
                Mentions légales
              </Link>
              <Link to="/politique-confidentialite" className="text-inverse-muted hover:text-inverse-primary text-sm transition-colors">
                Politique de confidentialité
              </Link>
              <Link to="/cgu" className="text-inverse-muted hover:text-inverse-primary text-sm transition-colors">
                CGU
              </Link>
              <button
                type="button"
                onClick={openPreferences}
                className="text-inverse-muted hover:text-inverse-primary text-sm transition-colors"
              >
                Gérer mes cookies
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
