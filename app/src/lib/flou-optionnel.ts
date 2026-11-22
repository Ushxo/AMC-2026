import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// Le flou (expo-blur) n'existe que dans une version de l'app construite avec son module natif.
// On vérifie d'abord que ce module est là : sans lui, importer expo-blur ferait planter l'app au démarrage.
type ModuleFlou = typeof import('expo-blur');

let module_: ModuleFlou | null = null;
if (Platform.OS === 'ios' && requireOptionalNativeModule('ExpoBlur')) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  module_ = require('expo-blur') as ModuleFlou;
}

export const flouDisponible = module_ !== null;
export const BlurView = module_?.BlurView ?? null;
