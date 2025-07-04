
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
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:hidden",
          className
        )}>
          <SelectValue placeholder={placeholder} className="text-gray-400" />
          <ChevronsUpDown className="h-4 w-4 text-white" />
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
