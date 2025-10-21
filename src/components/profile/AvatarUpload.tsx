import React, { useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  onAvatarUpdated?: (url: string) => void;
}

export default function AvatarUpload({
  currentAvatarUrl,
  firstName,
  lastName,
  onAvatarUpdated
}: AvatarUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);

  const getInitials = () => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) {
      return;
    }

    const file = event.target.files[0];

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG ou WebP.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5 Mo.');
      return;
    }

    try {
      setUploading(true);

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      if (onAvatarUpdated) {
        onAvatarUpdated(publicUrl);
      }

      toast.success('Photo de profil mise à jour');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erreur lors de l\'upload de la photo');
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !avatarUrl) return;

    try {
      setUploading(true);

      // Delete from storage
      const oldPath = avatarUrl.split('/').pop();
      if (oldPath) {
        await supabase.storage
          .from('avatars')
          .remove([`${user.id}/${oldPath}`]);
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

      if (error) throw error;

      setAvatarUrl(null);
      if (onAvatarUpdated) {
        onAvatarUpdated('');
      }

      toast.success('Photo de profil supprimée');
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="w-24 h-24">
          <AvatarImage src={avatarUrl || undefined} alt="Photo de profil" />
          <AvatarFallback className="text-2xl">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        {avatarUrl && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
            onClick={handleRemoveAvatar}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById('avatar-upload')?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Upload...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              {avatarUrl ? 'Changer' : 'Ajouter'} la photo
            </>
          )}
        </Button>

        <input
          id="avatar-upload"
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploading}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        JPG, PNG ou WebP. Max 5 Mo.
      </p>
    </div>
  );
}
