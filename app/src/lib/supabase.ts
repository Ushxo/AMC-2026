import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !cle) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY manquent : remplir app/.env puis relancer Expo.',
  );
}

// Le rendu web côté serveur (web.output = "server") n'a pas de stockage :
// pas de session à garder là-bas.
const rendServeur = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(url, cle, {
  auth: {
    storage: rendServeur ? undefined : AsyncStorage,
    persistSession: !rendServeur,
    autoRefreshToken: !rendServeur,
    detectSessionInUrl: false,
  },
});

// Sur mobile, le jeton ne se rafraîchit que quand l'app est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (etat) => {
    if (etat === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
