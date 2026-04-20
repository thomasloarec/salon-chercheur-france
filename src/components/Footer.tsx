
import { Link } from 'react-router-dom';
import logoLotexpo from '@/assets/logo-lotexpo.png';
import { CANONICAL_SECTORS } from '@/lib/taxonomy';
import { useConsent } from '@/contexts/ConsentContext';

const FOOTER_SECTORS = CANONICAL_SECTORS.slice(0, 8);

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
    <footer className="bg-primary text-white py-16">
      <div className="w-full px-6 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <img src={logoLotexpo} alt="LotExpo" className="h-8 mb-4 brightness-0 invert" />
            <p className="text-gray-300 mb-4">
              La plateforme de référence pour découvrir tous les salons professionnels en France.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-300 hover:text-accent transition-colors">Accueil</Link></li>
              <li><Link to="/nouveautes" className="text-gray-300 hover:text-accent transition-colors">Nouveautés</Link></li>
              <li><Link to="/exposants" className="text-gray-300 hover:text-accent transition-colors">Exposants</Link></li>
              <li><Link to="/comment-ca-marche" className="text-gray-300 hover:text-accent transition-colors">Comment ça marche</Link></li>
              <li><Link to="/blog" className="text-gray-300 hover:text-accent transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Sectors */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Salons par secteur</h4>
            <ul className="space-y-2">
              {FOOTER_SECTORS.map(s => (
                <li key={s.value}>
                  <Link to={`/secteur/${s.value}`} className="text-gray-300 hover:text-accent transition-colors text-sm">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Salons par ville</h4>
            <ul className="space-y-2">
              {FOOTER_CITIES.map(c => (
                <li key={c.slug}>
                  <Link to={`/ville/${c.slug}`} className="text-gray-300 hover:text-accent transition-colors text-sm">
                    Salons à {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <ul className="space-y-2">
              <li><Link to="/contact" className="text-gray-300 hover:text-accent transition-colors">Nous contacter</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-300 text-sm">
              © {new Date().getFullYear()} Lotexpo. Tous droits réservés.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 md:mt-0">
              <Link to="/mentions-legales" className="text-gray-300 hover:text-accent text-sm transition-colors">
                Mentions légales
              </Link>
              <Link to="/politique-confidentialite" className="text-gray-300 hover:text-accent text-sm transition-colors">
                Politique de confidentialité
              </Link>
              <Link to="/cgu" className="text-gray-300 hover:text-accent text-sm transition-colors">
                CGU
              </Link>
              <button
                type="button"
                onClick={openPreferences}
                className="text-gray-300 hover:text-accent text-sm transition-colors"
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
