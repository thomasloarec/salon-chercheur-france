
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface LocationSuggestion {
  type: 'department' | 'region' | 'city' | 'text';
  value: string;
  label: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  placeholder?: string;
}

const LocationAutocomplete = ({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Ville, département, région..." 
}: LocationAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const uniqueSuggestions = new Map<string, LocationSuggestion>();

        // Recherche dans les villes (depuis la table events)
        const { data: cities } = await supabase
          .from('events')
          .select('city')
          .ilike('city', `%${query}%`)
          .limit(10);

        cities?.forEach(event => {
          if (event.city && event.city.toLowerCase().includes(query.toLowerCase())) {
            const key = `city-${event.city}`;
            if (!uniqueSuggestions.has(key)) {
              uniqueSuggestions.set(key, {
                type: 'city',
                value: event.city,
                label: `${event.city} (ville)`
              });
            }
          }
        });

        // Recherche dans les départements
        const { data: departements } = await supabase
          .from('departements')
          .select('code, nom')
          .ilike('nom', `%${query}%`)
          .limit(5);

        departements?.forEach(dep => {
          if (dep.nom && dep.nom.toLowerCase().includes(query.toLowerCase())) {
            const key = `department-${dep.code}`;
            if (!uniqueSuggestions.has(key)) {
              uniqueSuggestions.set(key, {
                type: 'department',
                value: dep.code,
                label: `${dep.nom} (département)`
              });
            }
          }
        });

        // Recherche dans les régions
        const { data: regions } = await supabase
          .from('regions')
          .select('code, nom')
          .ilike('nom', `%${query}%`)
          .limit(5);

        regions?.forEach(region => {
          if (region.nom && region.nom.toLowerCase().includes(query.toLowerCase())) {
            const key = `region-${region.code}`;
            if (!uniqueSuggestions.has(key)) {
              uniqueSuggestions.set(key, {
                type: 'region',
                value: region.code,
                label: `${region.nom} (région)`
              });
            }
          }
        });

        setSuggestions(Array.from(uniqueSuggestions.values()).slice(0, 8));
        setIsOpen(true);
      } catch (error) {
        console.error('Erreur autocomplete:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.label);
    onChange(suggestion.label);
    onSelect(suggestion);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    // Only update parent for display purposes, don't trigger search
    onChange(newValue);
    
    if (!newValue) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.length >= 3) {
      // Create a text-based location suggestion when user presses Enter
      const textSuggestion: LocationSuggestion = {
        type: 'text',
        value: query.trim(),
        label: query.trim()
      };
      onSelect(textSuggestion);
      setIsOpen(false);
    }
  };

  // Fermer le dropdown si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <Input
          placeholder={placeholder}
          className="pl-10 pr-10 h-12 text-gray-900"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
        />
        {isLoading && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
          </div>
        )}
        {!isLoading && suggestions.length > 0 && (
          <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-none bg-transparent"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center">
                <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                <span className="text-gray-900">{suggestion.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
