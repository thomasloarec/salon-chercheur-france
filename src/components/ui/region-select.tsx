
import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={cn(
          "w-full justify-between h-auto min-h-[2.5rem] border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&>svg]:hidden",
          className
        )}>
          <SelectValue placeholder={placeholder} className="text-gray-400 placeholder:text-gray-400" />
          <ChevronsUpDown className="h-4 w-4 text-gray-200" />
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
