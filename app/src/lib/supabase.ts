import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

let client: SupabaseClient | null | undefined;

/** Client Supabase, ou null si les clés manquent. Ne plante jamais. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) {
    client = null;
    return client;
  }
  // Hors de l'appareil (export, rendu côté serveur), il n'y a pas de stockage : pas de session gardée.
  const surAppareil = typeof window !== 'undefined';
  try {
    client = createClient(url, cle, {
      auth: {
        storage: surAppareil ? AsyncStorage : undefined,
        autoRefreshToken: surAppareil,
        persistSession: surAppareil,
        detectSessionInUrl: false,
      },
    });
    // Sur téléphone, le jeton ne se rafraîchit que quand l'app est au premier plan.
    if (surAppareil && Platform.OS !== 'web') {
      const cree = client;
      AppState.addEventListener('change', (etat) => {
        if (etat === 'active') void cree.auth.startAutoRefresh();
        else void cree.auth.stopAutoRefresh();
      });
    }
  } catch {
    client = null;
  }
  return client;
}
