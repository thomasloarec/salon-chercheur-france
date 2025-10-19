
import { MapPin, Mail, Phone, Linkedin, Twitter } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-primary text-white py-16">
      <div className="w-full px-6 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="text-2xl font-bold mb-4">
              <span className="text-white">Lot</span><span className="text-orange-500">Expo</span>
            </div>
            <p className="text-gray-300 mb-4">
              La plateforme de référence pour découvrir tous les salons professionnels en France.
            </p>
            <div className="flex space-x-4">
              <Linkedin className="h-5 w-5 text-gray-300 hover:text-accent cursor-pointer transition-colors" />
              <Twitter className="h-5 w-5 text-gray-300 hover:text-accent cursor-pointer transition-colors" />
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li><a href="/" className="text-gray-300 hover:text-accent transition-colors">Accueil</a></li>
              <li><a href="/events" className="text-gray-300 hover:text-accent transition-colors">Événements</a></li>
              <li><a href="/nouveautes" className="text-gray-300 hover:text-accent transition-colors">Nouveautés</a></li>
              <li><a href="/premium" className="text-gray-300 hover:text-accent transition-colors">Premium</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent" />
                <a href="mailto:admin@lotexpo.com" className="text-gray-300 hover:text-accent transition-colors">admin@lotexpo.com</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-accent" />
                <a href="tel:+33623765293" className="text-gray-300 hover:text-accent transition-colors">06.23.76.52.93</a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                <span className="text-gray-300">Caen, France</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-300 text-sm">
              © 2024 LotExpo. Tous droits réservés.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="/mentions-legales" className="text-gray-300 hover:text-accent text-sm transition-colors">
                Mentions légales
              </a>
              <a href="/politique-confidentialite" className="text-gray-300 hover:text-accent text-sm transition-colors">
                Politique de confidentialité
              </a>
              <a href="/cgu" className="text-gray-300 hover:text-accent text-sm transition-colors">
                CGU
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
