
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
  placeholder = "Sélectionnez une région…",
  label = "Région",
  className,
}: RegionSelectProps) => {
  return (
    <div className={className}>
      <Label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full h-12">
          <SelectValue placeholder={placeholder} />
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
