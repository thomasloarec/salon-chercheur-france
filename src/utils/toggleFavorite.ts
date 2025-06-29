
import { supabase } from "@/integrations/supabase/client";

/**
 * Ajoute ou retire un favori.
 * @returns {Promise<{ isFavorite: boolean }>} - état final
 */
export async function toggleFavorite(eventId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Vérifie l'existence sans lever d'erreur 406
  const { data: row, error: selectError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle(); // ← évite le 406

  if (selectError && selectError.code !== "PGRST116") {
    // PGRST116 = row not found when maybeSingle => null, donc on ignore
    throw selectError;
  }

  if (row) {
    // 2a. Supprime si présent
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", row.id);
    if (deleteError) throw deleteError;
    return { isFavorite: false };
  }

  // 2b. Insère si absent (upsert évite doublons uniques)
  const { error: insertError } = await supabase.from("favorites").upsert({
    user_id: user.id,
    event_id: eventId,
  });
  if (insertError) throw insertError;
  return { isFavorite: true };
}
