import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { FEUILLE_BASE, VOILE_FEUILLE, CIBLE_MIN, STYLE_ZONE } from '@/components/ville/style';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formaterDate } from '@/lib/format';
import { MESSAGE_ZONE_ESTIMEE } from '@/lib/messages';
import { type Zone } from '@/lib/zones';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, LIBELLES_GRAVITE, type Signalement } from '@/types';

import { Bouton } from './bouton';

type Props = {
  zone: Zone | null;
  signalements: Signalement[];
  onFermer: () => void;
  onOuvrir: (signalementId: string) => void;
};

/** Fiche d'une zone, en feuille au bas de l'écran : gravité, dates, nombre et liste des signalements. */
export function FicheZone({ zone, signalements, onFermer, onOuvrir }: Props) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const membres = zone ? signalements.filter((s) => zone.signalement_ids.includes(s.id)) : [];
  return (
    <Modal visible={!!zone} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable retour={false} style={styles.fond} onPress={onFermer} accessibilityLabel="Fermer la fiche" accessibilityRole="button" />
      {zone ? (
        <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
          <ScrollView contentContainerStyle={styles.contenu}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Zone de signalements
            </ThemedText>
            <View style={styles.rangee}>
              <View style={[styles.pastille, { backgroundColor: STYLE_ZONE[zone.gravite].contour }]} />
              <ThemedText type="smallBold">Gravité maximale : {LIBELLES_GRAVITE[zone.gravite].toLowerCase()}</ThemedText>
            </View>
            <ThemedText>
              {zone.signalement_ids.length} signalement{zone.signalement_ids.length > 1 ? 's' : ''} · premier le{' '}
              {formaterDate(zone.premier_le)} · dernier le {formaterDate(zone.dernier_le)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {MESSAGE_ZONE_ESTIMEE}
            </ThemedText>
            {membres.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onOuvrir(s.id)}
                accessibilityRole="button"
                accessibilityLabel={`${LIBELLES_CATEGORIE[s.categorie]}, gravité ${LIBELLES_GRAVITE[s.gravite].toLowerCase()}, ${LIBELLES_ETAT[s.etat].toLowerCase()}, ${formaterDate(s.cree_le)}. Ouvrir`}
                style={[styles.ligne, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{LIBELLES_CATEGORIE[s.categorie]}</ThemedText>
                <ThemedText type="small">
                  {LIBELLES_GRAVITE[s.gravite]} · {LIBELLES_ETAT[s.etat]} · {formaterDate(s.cree_le)}
                </ThemedText>
              </Pressable>
            ))}
            <Bouton titre="Fermer" variante="discret" pleineLargeur onPress={onFermer} />
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VOILE_FEUILLE },
  feuille: { maxHeight: '70%', ...FEUILLE_BASE },
  contenu: { padding: 20, gap: 12 },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastille: { width: 14, height: 14, borderRadius: 7 },
  ligne: { minHeight: CIBLE_MIN, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 2, justifyContent: 'center' },
});
