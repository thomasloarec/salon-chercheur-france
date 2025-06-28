
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-12 w-full rounded-lg border border-gray-200 bg-white shadow-sm pl-4 pr-4 flex items-center justify-between text-gray-900 text-sm hover:bg-gray-50 focus:border-accent focus:ring-1 focus:ring-accent">
          <SelectValue 
            placeholder={placeholder} 
            className="text-gray-400 text-sm leading-5"
          />
        </SelectTrigger>
        <SelectContent>
          {regions.map((region) => (
            <SelectItem key={region.code} value={region.code}>
              {region.nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
