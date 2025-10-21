import React, { useState, useRef } from 'react';
import { Send, Smile, Image as ImageIcon, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CommentInputProps {
  onSubmit: (content: string, imageUrl?: string) => Promise<void>;
  isPending: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😊', '🎉', '🤔', '👏', '🔥', '💡'];

export default function CommentInput({ onSubmit, isPending }: CommentInputProps) {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  const handleEmojiClick = (emoji: string) => {
    setComment(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5 Mo');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/comments/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('novelty-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('novelty-images')
        .getPublicUrl(fileName);

      setUploadedImage(publicUrl);
      toast.success('Image ajoutée');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erreur lors de l\'ajout de l\'image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && !uploadedImage) return;

    try {
      await onSubmit(comment, uploadedImage || undefined);
      setComment('');
      setUploadedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  if (!user) return null;

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-start">
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage 
          src={user?.user_metadata?.avatar_url || undefined}
          alt="Votre photo"
        />
        <AvatarFallback className="text-xs">
          {getInitials(
            user?.user_metadata?.first_name || null,
            user?.user_metadata?.last_name || null
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <div className="relative">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            className="w-full px-4 py-2 pr-20 rounded-full border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={500}
            disabled={isPending || isUploading}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="h-4 w-4" />
              </Button>
              
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 p-2 bg-popover border rounded-lg shadow-lg z-10">
                  <div className="flex gap-1">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleEmojiClick(emoji)}
                        className="hover:bg-accent p-1 rounded text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !!uploadedImage}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={(!comment.trim() && !uploadedImage) || isPending || isUploading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {uploadedImage && (
          <div className="relative inline-block">
            <img 
              src={uploadedImage} 
              alt="Preview" 
              className="max-w-[200px] max-h-[200px] rounded-lg border"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
              onClick={handleRemoveImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {comment.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {comment.length}/500
          </p>
        )}
      </div>
    </form>
  );
}
