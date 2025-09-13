export const SENTINEL_ALL = 'all';

export function normalizeParam(v?: string | null): string {
  return (!v || v.trim() === '' ? SENTINEL_ALL : v);
}

export function isAll(v?: string | null): boolean {
  return (v ?? SENTINEL_ALL) === SENTINEL_ALL;
}

export function updateUrlParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | null
): URLSearchParams {
  const newParams = new URLSearchParams(searchParams);
  if (value && value !== SENTINEL_ALL) {
    newParams.set(key, value);
  } else {
    newParams.delete(key);
  }
  return newParams;
}