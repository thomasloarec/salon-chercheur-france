import { supabase } from '@/integrations/supabase/client';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a novelty image to Supabase storage
 */
export const uploadNoveltyImage = async (
  noveltyId: string,
  file: File,
  position: number
): Promise<UploadResult> => {
  try {
    const fileExtension = file.name.split('.').pop();
    const filename = `${noveltyId}/pos-${position}.${fileExtension}`;
    
    const { data, error } = await supabase.storage
      .from('novelty-images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error uploading image:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('novelty-images')
      .getPublicUrl(filename);

    return { success: true, url: filename };
  } catch (error) {
    console.error('Upload error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur d\'upload'
    };
  }
};

/**
 * Upload a novelty PDF resource to Supabase storage
 */
export const uploadNoveltyResource = async (
  noveltyId: string,
  file: File
): Promise<UploadResult> => {
  try {
    const filename = `${noveltyId}/presentation.pdf`;
    
    const { data, error } = await supabase.storage
      .from('novelty-resources')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error uploading resource:', error);
      return { success: false, error: error.message };
    }

    return { success: true, url: filename };
  } catch (error) {
    console.error('Upload error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur d\'upload'
    };
  }
};

/**
 * Delete a novelty image from storage
 */
export const deleteNoveltyImage = async (filename: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from('novelty-images')
      .remove([filename]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
};

/**
 * Delete a novelty resource from storage
 */
export const deleteNoveltyResource = async (filename: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from('novelty-resources')
      .remove([filename]);

    if (error) {
      console.error('Error deleting resource:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
};

/**
 * Get signed URL for downloading a private resource
 */
export const getSignedResourceUrl = async (filename: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('novelty-resources')
      .createSignedUrl(filename, 3600); // 1 hour expiry

    if (error || !data) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Signed URL error:', error);
    return null;
  }
};

/**
 * Batch upload images for a novelty
 */
export const uploadNoveltyImages = async (
  noveltyId: string,
  files: File[]
): Promise<{ successes: UploadResult[]; failures: UploadResult[] }> => {
  const results = await Promise.all(
    files.map((file, index) => uploadNoveltyImage(noveltyId, file, index))
  );

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  return { successes, failures };
};

/**
 * Clean up failed uploads (rollback)
 */
export const cleanupFailedUploads = async (filenames: string[]): Promise<void> => {
  if (filenames.length === 0) return;

  try {
    // Remove from images bucket
    const imageFiles = filenames.filter(f => !f.includes('presentation.pdf'));
    if (imageFiles.length > 0) {
      await supabase.storage.from('novelty-images').remove(imageFiles);
    }

    // Remove from resources bucket
    const resourceFiles = filenames.filter(f => f.includes('presentation.pdf'));
    if (resourceFiles.length > 0) {
      await supabase.storage.from('novelty-resources').remove(resourceFiles);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};