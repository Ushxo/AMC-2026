import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Expo Go n'embarque pas le module natif de navigation Google, même si NAVIGATION_GOOGLE=1 est défini. */
const DANS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Vrai seulement dans une build faite avec NAVIGATION_GOOGLE=1 (la bibliothèque n'existe pas ailleurs, ni dans Expo Go). */
export const NAVIGATION_GOOGLE = !DANS_EXPO_GO && Constants.expoConfig?.extra?.navigationGoogle === true;
