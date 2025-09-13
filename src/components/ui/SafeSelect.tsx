import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SafeOption = { value: string; label: string };
export const SENTINEL_ALL = "all";

function sanitizeValue(v?: string | null): string {
  const s = (v ?? "").trim();
  return s === "" ? SENTINEL_ALL : s;
}

function sanitizeOptions(opts: SafeOption[]): SafeOption[] {
  // Filtre toutes les options sans valeur ou valeur vide
  const filtered = (opts ?? []).filter(o => o && typeof o.value === "string" && o.value.trim() !== "");
  // Dé-duplique par value
  const seen = new Set<string>();
  return filtered.filter(o => {
    if (seen.has(o.value)) return false;
    seen.add(o.value);
    return true;
  });
}

type SafeSelectProps = {
  ariaLabel: string;
  value?: string | null;
  onChange: (v: string | null) => void; // null = "all"/reset
  placeholder: string;
  options: SafeOption[];
  includeAllOption?: boolean; // default true
  allLabel?: string;          // default "Tous"
  className?: string;
  disabled?: boolean;
};

export function SafeSelect({
  ariaLabel,
  value,
  onChange,
  placeholder,
  options,
  includeAllOption = true,
  allLabel = "Tous",
  className,
  disabled = false,
}: SafeSelectProps) {
  const saneOptions = React.useMemo(() => sanitizeOptions(options), [options]);
  const current = sanitizeValue(value);

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === SENTINEL_ALL ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={ariaLabel} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAllOption && (
          <SelectItem value={SENTINEL_ALL}>{allLabel}</SelectItem>
        )}
        {saneOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}