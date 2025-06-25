
import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';

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

// Debounce utility function
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

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
  const navigate = useNavigate();
  const location = useLocation();

  // Sync with external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const fetchSuggestions = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 Fetching suggestions for:', searchQuery);
      
      // Use the new get_location_suggestions function
      const { data, error } = await supabase.rpc('get_location_suggestions', { q: searchQuery });
      
      if (error) {
        console.error('❌ Error fetching suggestions:', error);
        setSuggestions([]);
        return;
      }

      const formattedSuggestions: LocationSuggestion[] = (data || []).map((item: any) => ({
        type: item.type,
        value: item.value,
        label: item.label
      }));

      console.log('✅ Suggestions received:', formattedSuggestions);
      setSuggestions(formattedSuggestions);
      setIsOpen(formattedSuggestions.length > 0);
    } catch (error) {
      console.error('❌ Error in fetchSuggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced fetch function
  const debouncedFetch = useMemo(() => debounce(fetchSuggestions, 300), []);

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    console.log('🎯 Suggestion selected:', suggestion);
    setQuery(suggestion.label);
    onChange(suggestion.label);
    onSelect(suggestion);
    setIsOpen(false);
    
    // Navigate to events page with location filter
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('location_type', suggestion.type);
    searchParams.set('location_value', suggestion.value);
    searchParams.set('page', '1');
    
    navigate({
      pathname: '/events',
      search: searchParams.toString()
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    // Only update parent for display purposes, don't trigger search
    onChange(newValue);
    
    if (!newValue) {
      setIsOpen(false);
      setSuggestions([]);
    } else {
      // Debounced fetch for suggestions
      debouncedFetch(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim().length >= 3) {
      console.log('⌨️ Enter pressed with query:', query.trim());
      // Create a text-based location suggestion when user presses Enter
      const textSuggestion: LocationSuggestion = {
        type: 'text',
        value: query.trim(),
        label: query.trim()
      };
      onSelect(textSuggestion);
      setIsOpen(false);
      
      // Navigate to events page with text search
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('location_type', 'text');
      searchParams.set('location_value', encodeURIComponent(query.trim()));
      searchParams.set('page', '1');
      
      navigate({
        pathname: '/events',
        search: searchParams.toString()
      });
    }
  };

  // Close dropdown if clicked outside
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
                <span className="ml-2 text-xs text-gray-500">
                  ({suggestion.type === 'city' ? 'ville' : 
                    suggestion.type === 'department' ? 'département' : 'région'})
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
