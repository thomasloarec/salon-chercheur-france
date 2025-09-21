import React, { useState, useCallback } from 'react';
import { Upload, X, Move, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ImagesUploaderProps {
  files: (File | string)[];
  onChange: (files: (File | string)[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
  className?: string;
}

export default function ImagesUploader({
  files,
  onChange,
  maxFiles = 3,
  maxSize = 5 * 1024 * 1024, // 5MB
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  className = ''
}: ImagesUploaderProps) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);

  // Normalize files prop to always be an array
  const items = Array.isArray(files) ? files.filter(Boolean) : [];

  // Helper to get image source
  const getSrc = (item: File | string): string => {
    if (item instanceof File) return URL.createObjectURL(item);
    if (typeof item === 'string') return item;
    return '';
  };

  const validateFile = (file: File): boolean => {
    if (!acceptedTypes.includes(file.type)) {
      toast({
        title: 'Type de fichier invalide',
        description: `Seuls les formats ${acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} sont acceptés`,
        variant: 'destructive'
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        title: 'Fichier trop volumineux',
        description: `Taille maximum: ${Math.round(maxSize / (1024 * 1024))}MB`,
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles = Array.from(newFiles).filter(f => f && f.type && /^image\//.test(f.type) && validateFile(f));
    
    if (items.length + validFiles.length > maxFiles) {
      toast({
        title: 'Limite atteinte',
        description: `Maximum ${maxFiles} images autorisées`,
        variant: 'destructive'
      });
      return;
    }

    const nextFiles = [...items, ...validFiles].slice(0, maxFiles);
    onChange(nextFiles);
  }, [items, onChange, maxFiles, validateFile, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const removeFile = (index: number) => {
    const newFiles = items.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  const moveFile = (fromIndex: number, toIndex: number) => {
    const newFiles = [...items];
    const [moved] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, moved);
    onChange(newFiles);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }
        `}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="images-upload"
        />
        <label htmlFor="images-upload" className="cursor-pointer">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-1">
            Glissez vos images ici ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-muted-foreground">
            {acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} • Max {Math.round(maxSize / (1024 * 1024))}MB • {maxFiles} images max
          </p>
        </label>
      </div>

      {/* Preview grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item, index) => {
            const src = getSrc(item);
            const itemKey = item instanceof File ? `${item.name}-${index}` : `${item}-${index}`;
            
            return (
              <div
                key={itemKey}
                className="relative group aspect-square rounded-lg overflow-hidden border bg-muted"
              >
                {src ? (
                  <img
                    src={src}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                    onLoad={() => {
                      // Only revoke object URLs created for Files
                      if (item instanceof File) {
                        URL.revokeObjectURL(src);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Controls overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {/* Move buttons */}
                  {index > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0"
                      onClick={() => moveFile(index, index - 1)}
                      title="Déplacer vers la gauche"
                    >
                      <Move className="h-3 w-3 rotate-180" />
                    </Button>
                  )}
                  
                  {index < items.length - 1 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0"
                      onClick={() => moveFile(index, index + 1)}
                      title="Déplacer vers la droite"
                    >
                      <Move className="h-3 w-3" />
                    </Button>
                  )}

                  {/* Remove button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 w-6 p-0"
                    onClick={() => removeFile(index)}
                    title="Supprimer"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* Position indicator */}
                <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* File info */}
      {items.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {items.length} image{items.length > 1 ? 's' : ''} sélectionnée{items.length > 1 ? 's' : ''}
          {maxFiles > items.length && ` • ${maxFiles - items.length} restante${maxFiles - items.length > 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}