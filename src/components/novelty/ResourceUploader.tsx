import React, { useState, useCallback } from 'react';
import { Upload, FileText, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ResourceUploaderProps {
  file: File | null;
  onChange: (file: File | null) => void;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
  className?: string;
  label?: string;
}

export default function ResourceUploader({
  file,
  onChange,
  maxSize = 20 * 1024 * 1024, // 20MB
  acceptedTypes = ['application/pdf'],
  className = '',
  label = 'Dossier de présentation (PDF)'
}: ResourceUploaderProps) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);

  const validateFile = (file: File): boolean => {
    if (!acceptedTypes.includes(file.type)) {
      toast({
        title: 'Type de fichier invalide',
        description: 'Seuls les fichiers PDF sont acceptés',
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

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const selectedFile = selectedFiles[0];
    if (validateFile(selectedFile)) {
      onChange(selectedFile);
    }
  }, [onChange, maxSize, toast]);

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

  const removeFile = () => {
    onChange(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium">{label}</label>
        <p className="text-xs text-muted-foreground">
          Les utilisateurs intéressés pourront télécharger ce document après avoir fourni leurs coordonnées
        </p>
      </div>

      {!file ? (
        /* Drop zone when no file */
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
            accept={acceptedTypes.join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="resource-upload"
          />
          <label htmlFor="resource-upload" className="cursor-pointer">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              Glissez votre PDF ici ou cliquez pour sélectionner
            </p>
            <p className="text-xs text-muted-foreground">
              PDF uniquement • Max {Math.round(maxSize / (1024 * 1024))}MB
            </p>
          </label>
        </div>
      ) : (
        /* File preview when file is selected */
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Replace button */}
              <div>
                <input
                  type="file"
                  accept={acceptedTypes.join(',')}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="resource-replace"
                />
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-8"
                >
                  <label htmlFor="resource-replace" className="cursor-pointer">
                    <Upload className="h-3 w-3 mr-1" />
                    Remplacer
                  </label>
                </Button>
              </div>

              {/* Remove button */}
              <Button
                size="sm"
                variant="outline"
                onClick={removeFile}
                className="h-8 text-destructive hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
        <strong>💡 Conseils pour votre dossier de présentation :</strong>
        <ul className="mt-1 space-y-1 list-disc list-inside">
          <li>Incluez des informations détaillées sur votre nouveauté</li>
          <li>Ajoutez des spécifications techniques, tarifs ou conditions</li>
          <li>Ce document sera téléchargeable après capture de leads</li>
        </ul>
      </div>
    </div>
  );
}