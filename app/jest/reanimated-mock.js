// Simulation légère de react-native-reanimated pour les tests : pas de module natif, les valeurs animées prennent leur valeur finale
// tout de suite et un changement de valeur redessine le composant (les tests voient donc l'état d'arrivée).
const React = require('react');
const { View, Text, ScrollView, Image } = require('react-native');

let mouvementReduit = false;
const compteurs = { springs: 0, timings: 0, annulations: 0 };

function useSharedValue(initial) {
  const [, forcer] = React.useState(0);
  const ref = React.useRef(null);
  if (!ref.current) {
    let v = initial;
    ref.current = {
      get value() {
        return v;
      },
      set value(n) {
        if (n !== v) {
          v = n;
          forcer((x) => x + 1);
        }
      },
      get: () => v,
      set(n) {
        this.value = typeof n === 'function' ? n(v) : n;
      },
    };
  }
  return ref.current;
}

const useAnimatedStyle = (fn) => fn();
const useDerivedValue = (fn) => ({ value: fn() });
const identite = (v) => v;
const chainable = () => {
  const o = {};
  ['duration', 'delay', 'springify', 'damping', 'stiffness', 'easing', 'withInitialValues', 'withCallback', 'reduceMotion'].forEach((m) => {
    o[m] = () => o;
  });
  return o;
};

const Animated = {
  View,
  Text,
  ScrollView,
  Image,
  createAnimatedComponent: (c) => c,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedReaction: () => {},
  useReducedMotion: () => mouvementReduit,
  __definirMouvementReduit: (v) => {
    mouvementReduit = !!v;
  },
  withSpring: (v) => {
    compteurs.springs++;
    return v;
  },
  withTiming: (v) => {
    compteurs.timings++;
    return v;
  },
  withDelay: (_d, v) => v,
  withSequence: (...v) => v[v.length - 1],
  withRepeat: identite,
  cancelAnimation: () => {
    compteurs.annulations++;
  },
  __compteurs: compteurs,
  runOnJS: (f) => f,
  runOnUI: (f) => f,
  interpolate: (v, entree, sortie) => {
    const i = entree.findIndex((x) => v <= x);
    if (i <= 0) return sortie[0];
    const t = (v - entree[i - 1]) / (entree[i] - entree[i - 1]);
    return sortie[i - 1] + t * (sortie[i] - sortie[i - 1]);
  },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: { out: identite, in: identite, inOut: identite, cubic: identite, quad: identite, ease: identite, bezier: () => identite },
  FadeIn: chainable(),
  FadeOut: chainable(),
  ZoomIn: chainable(),
  ZoomOut: chainable(),
  FadeInDown: chainable(),
  FadeOutUp: chainable(),
  LinearTransition: chainable(),
};
