import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ETAPES_AFFICHEES, LIBELLES_ETAPE, type EtapeProgression } from '@/lib/progression';

import { COULEUR_ACCENT } from './style';

type Props = { etape: EtapeProgression; fraction: number };

/** Barre de progression + étapes réelles. L'étape courante est marquée ●, les faites ✓, les à venir ○. */
export function BarreProgression({ etape, fraction }: Props) {
  const theme = useTheme();
  const pourcent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const position = ETAPES_AFFICHEES.indexOf(etape);
  return (
    <View style={styles.bloc}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Calcul des tournées : ${LIBELLES_ETAPE[etape]}`}
        accessibilityValue={{ min: 0, max: 100, now: pourcent, text: `${pourcent} %` }}
        style={[styles.piste, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.remplissage, { width: `${pourcent}%`, backgroundColor: COULEUR_ACCENT }]} />
      </View>
      <ThemedText type="smallBold">
        {LIBELLES_ETAPE[etape]} · {pourcent} %
      </ThemedText>
      <View style={styles.etapes} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {ETAPES_AFFICHEES.map((e, i) => (
          <ThemedText key={e} type="small" themeColor={i <= position ? 'text' : 'textSecondary'}>
            {i < position || etape === 'terminee' && e === 'terminee' ? '✓' : i === position ? '●' : '○'} {LIBELLES_ETAPE[e]}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
  remplissage: { height: 10, borderRadius: 5 },
  etapes: { gap: 2 },
});
