
import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

// Register a custom image blot once so width/style/alt attributes survive in the delta/HTML.
const BaseImageFormat = Quill.import('formats/image') as any;
const IMAGE_ATTRIBUTES = ['alt', 'height', 'width', 'style'];
class CustomImageFormat extends BaseImageFormat {
  static formats(domNode: HTMLElement) {
    return IMAGE_ATTRIBUTES.reduce((formats: Record<string, string>, attribute) => {
      if (domNode.hasAttribute(attribute)) {
        formats[attribute] = domNode.getAttribute(attribute) as string;
      }
      return formats;
    }, {});
  }
  format(name: string, value: string) {
    if (IMAGE_ATTRIBUTES.indexOf(name) > -1) {
      if (value) {
        this.domNode.setAttribute(name, value);
      } else {
        this.domNode.removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}
Quill.register(CustomImageFormat, true);

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Toolbar at the bottom of the frame (stays visible with long content). */
  bottomToolbar?: boolean;
  /** Enable image/GIF upload button with size, alt text and link options. */
  enableImages?: boolean;
}

const BASE_FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'blockquote',
  'list', 'bullet',
  'link',
  'align',
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '',
  className,
  readOnly = false,
  bottomToolbar = false,
  enableImages = false,
}) => {
  const { toast } = useToast();
  const quillRef = useRef<ReactQuill>(null);
  const savedRange = useRef<{ index: number; length: number } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [size, setSize] = useState<'original' | 'reduced'>('original');

  const imageHandler = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    savedRange.current = editor?.getSelection(true) ?? null;

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/png,image/jpeg,image/webp,image/gif');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Image trop volumineuse (max 5 Mo)', variant: 'destructive' });
        return;
      }
      setUploading(true);
      try {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `blog-body-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from('blog-images')
          .upload(fileName, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('blog-images').getPublicUrl(fileName);
        setPendingUrl(data.publicUrl);
        setAltText('');
        setLinkUrl('');
        setSize('original');
        setDialogOpen(true);
      } catch (err: any) {
        toast({ title: 'Erreur upload: ' + (err?.message || ''), variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [toast]);

  const insertImage = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor || !pendingUrl) return;
    const range = savedRange.current ?? editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
    const index = range.index;

    const attrs: Record<string, string> = {};
    if (altText.trim()) attrs.alt = altText.trim();
    if (size === 'reduced') {
      attrs.style = 'width: 55%; display: block; margin: 1.5rem auto;';
    } else {
      attrs.style = 'width: 100%; display: block; margin: 1.5rem auto;';
    }
    const normalizedLink = linkUrl.trim();
    if (normalizedLink) {
      attrs.link = /^https?:\/\//i.test(normalizedLink) ? normalizedLink : `https://${normalizedLink}`;
    }

    const Delta = Quill.import('delta');
    editor.updateContents(
      new Delta().retain(index).insert({ image: pendingUrl }, attrs),
      'user'
    );
    editor.setSelection(index + 1, 0, 'user');
    setDialogOpen(false);
    setPendingUrl('');
  }, [pendingUrl, altText, size, linkUrl]);

  const modules = useMemo(() => {
    const toolbar: any = {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        enableImages ? ['link', 'image'] : ['link'],
        [{ align: [] }],
        ['clean'],
      ],
    };
    if (enableImages) {
      toolbar.handlers = { image: imageHandler };
    }
    return { toolbar };
  }, [enableImages, imageHandler]);

  // When images are enabled we let Quill keep all default formats (incl. the custom
  // image blot's style/alt/width attributes) so styling survives save/reload round-trips.
  const formats = useMemo(
    () => (enableImages ? undefined : BASE_FORMATS),
    [enableImages]
  );

  return (
    <div className={cn('rich-text-editor', bottomToolbar && 'rich-text-editor--bottom', className)}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
        }}
      />

      {uploading && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Téléchargement de l'image…
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insérer l'image</DialogTitle>
          </DialogHeader>

          {pendingUrl && (
            <div className="rounded-md border bg-muted/30 p-3">
              <img
                src={pendingUrl}
                alt={altText || 'Aperçu'}
                className="mx-auto max-h-48 w-auto rounded"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Taille de l'image</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={size === 'original' ? 'default' : 'outline'}
                  onClick={() => setSize('original')}
                >
                  Taille originale
                </Button>
                <Button
                  type="button"
                  variant={size === 'reduced' ? 'default' : 'outline'}
                  onClick={() => setSize('reduced')}
                >
                  Réduite
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rte-img-alt">Texte alternatif (SEO / accessibilité)</Label>
              <Input
                id="rte-img-alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Description de l'image"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rte-img-link">Lien hypertexte (optionnel)</Label>
              <Input
                id="rte-img-link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://exemple.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={insertImage}>
              Insérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
