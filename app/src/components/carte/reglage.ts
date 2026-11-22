import Constants from 'expo-constants';

/** Vrai seulement dans une build faite avec NAVIGATION_GOOGLE=1 (la bibliothèque n'existe pas ailleurs, ni dans Expo Go). */
export const NAVIGATION_GOOGLE = Constants.expoConfig?.extra?.navigationGoogle === true;
