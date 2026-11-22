import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { Guidage } from '@/lib/guidage';

import { Bouton } from './bouton';
import { FlecheManoeuvre } from './fleche-manoeuvre';
import { COULEUR_ACCENT } from './style';

type Props = {
  guidage: Guidage;
  /** « Arrêt 3 sur 41 · 350 m · environ 2 min » */
  resume: string;
  /** À l'arrivée, le bouton « Arrêt fait » passe en avant. */
  onArretFait?: () => void;
  occupe?: boolean;
};

/**
 * Bandeau de guidage visuel : flèche, phrase de la manœuvre, manœuvre suivante, puis le résumé de l'arrêt.
 * Région vive « polie » : VoiceOver annonce les changements, sans synthèse vocale de notre part.
 */
export function BandeauGuidage({ guidage, resume, onArretFait, occupe }: Props) {
  const theme = useTheme();
  const arrive = guidage.statut === 'arrive';
  return (
    <View style={[styles.bandeau, { backgroundColor: theme.backgroundElement, borderLeftColor: COULEUR_ACCENT }]}>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={[guidage.instruction, guidage.suivante, resume].filter(Boolean).join('. ')}
        style={styles.rangee}>
        <FlecheManoeuvre icone={guidage.icone} />
        <View style={styles.textes}>
          <ThemedText type="smallBold" style={styles.phrase}>
            {guidage.instruction}
          </ThemedText>
          {guidage.suivante ? (
            <ThemedText type="small" themeColor="textSecondary">
              {guidage.suivante}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <ThemedText type="small">{resume}</ThemedText>
      {arrive && onArretFait ? (
        <Bouton pleineLargeur titre={occupe ? 'Enregistrement…' : 'Arrêt fait'} actif={!occupe} onPress={onArretFait} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: { borderRadius: 12, borderLeftWidth: 6, padding: 12, gap: 8 },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textes: { flex: 1, gap: 2 },
  phrase: { fontSize: 18, lineHeight: 24 },
});
