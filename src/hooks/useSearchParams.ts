
import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export const useSearchParam = (key: string, defaultValue: string) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const value = searchParams.get(key) || defaultValue;
  
  const setValue = useCallback((newValue: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (newValue === defaultValue) {
      newParams.delete(key);
    } else {
      newParams.set(key, newValue);
    }
    setSearchParams(newParams);
  }, [key, defaultValue, searchParams, setSearchParams]);
  
  return [value, setValue] as const;
};
