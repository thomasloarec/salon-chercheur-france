import * as React from "react";
import { SafeSelect } from "@/components/ui/SafeSelect";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Region {
  code: string;
  nom: string;
}

interface RegionSelectProps {
  regions: Region[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const RegionSelect = ({
  regions,
  value,
  onValueChange,
  placeholder = "Sélectionner une région…",
  label = "Région",
  className,
}: RegionSelectProps) => {
  return (
    <div className={className}>
      <Label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </Label>
      <SafeSelect
        ariaLabel="Sélection région"
        placeholder={placeholder}
        className={cn(
          "w-full justify-between",
          className
        )}
        value={value}
        onChange={(v) => onValueChange(v || '')}
        options={regions.map(region => ({ value: region.code, label: region.nom }))}
        includeAllOption={false}
      />
    </div>
  );
};