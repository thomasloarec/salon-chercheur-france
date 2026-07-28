import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ContentSettingsMap = Record<string, unknown>;

export interface ContentSettingRow {
  key: string;
  value: unknown;
  updated_at: string | null;
}

export const CONTENT_SETTINGS_QUERY_KEY = ['content-settings'] as const;

export function useContentSettings() {
  return useQuery<{ values: ContentSettingsMap; rows: ContentSettingRow[] }>({
    queryKey: CONTENT_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_settings')
        .select('key, value, updated_at');
      if (error) throw error;
      const rows = (data ?? []) as ContentSettingRow[];
      const values: ContentSettingsMap = {};
      for (const row of rows) values[row.key] = row.value;
      return { values, rows };
    },
  });
}

export function useUpdateContentSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { data, error } = await supabase
        .from('content_settings')
        .update({
          value: value as never,
          updated_at: new Date().toISOString(),
          updated_by: 'control_room',
        })
        .eq('key', key)
        .select('key');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Réglage non modifié : droits insuffisants ou session expirée.');
      }
      return { key, value };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTENT_SETTINGS_QUERY_KEY });
    },
  });
}
