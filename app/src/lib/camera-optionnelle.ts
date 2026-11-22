import { requireOptionalNativeModule } from 'expo';

// La caméra intégrée (expo-camera) n'existe que dans une version de l'app construite avec son module natif.
// On vérifie d'abord que ce module est là : sans lui, importer expo-camera ferait planter l'app au démarrage.
type ModuleCamera = typeof import('expo-camera');

let module_: ModuleCamera | null = null;
if (requireOptionalNativeModule('ExpoCamera')) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  module_ = require('expo-camera') as ModuleCamera;
}

export const cameraDisponible = module_ !== null;
export const CameraView = module_?.CameraView ?? null;
export type VueCamera = import('expo-camera').CameraView;

const useSansCamera = (): [null, () => Promise<void>] => [null, async () => {}];
export const useCameraPermissions = module_?.useCameraPermissions ?? useSansCamera;
