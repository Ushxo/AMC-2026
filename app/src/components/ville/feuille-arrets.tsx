import { FlatList, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { ModaleAnimee } from '@/components/mouvement/modale-animee';
import { FEUILLE_BASE } from '@/components/ville/style';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formaterNombre } from '@/lib/format';
import { formaterHeure } from '@/lib/temps';
import type { StatutArret } from '@/lib/trajet';
import type { Arret } from '@/types';

import { Bouton } from './bouton';

type Props = {
  visible: boolean;
  /** Tous les arrêts de la tournée : à faire, faits et non faits. */
  arrets: Arret[];
  statutDe?: (a: Arret) => StatutArret;
  commentaireDe?: (a: Arret) => string | null;
  /** Toucher un arrêt pour donner ou corriger son résultat (absent : lecture seule). */
  onChoisir?: (a: Arret) => void;
  onFermer: () => void;
};

const ETIQUETTES: Record<'fait' | 'non_fait' | 'a_faire', string> = { fait: 'Fait', non_fait: 'Non fait', a_faire: 'À faire' };

/** Liste des arrêts de la tournée, en feuille au bas de l'écran : le résultat de chacun (fait, non fait avec son commentaire, à faire). */
export function FeuilleArrets({ visible, arrets, statutDe = () => null, commentaireDe = () => null, onChoisir, onFermer }: Props) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const restants = arrets.filter((a) => statutDe(a) === null).length;
  return (
    <ModaleAnimee visible={visible} onFermer={onFermer} libelleFermer="Fermer la liste">
      <View testID="feuille-arrets" style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
        <FlatList
          data={arrets}
          keyExtractor={(a) => String(a.id ?? a.cle_endroit)}
          contentContainerStyle={styles.contenu}
          initialNumToRender={15}
          windowSize={7}
          ListHeaderComponent={
            <ThemedText type="subtitle" accessibilityRole="header">
              Arrêts ({arrets.length}) : {restants} à faire
            </ThemedText>
          }
          renderItem={({ item: a }) => {
            const n = formaterNombre(a.signalement_ids.length, 'signalement', 'signalements');
            const statut = statutDe(a);
            const etiquette = ETIQUETTES[statut ?? 'a_faire'];
            const mot = commentaireDe(a);
            const couleur = statut === 'fait' ? theme.success : statut === 'non_fait' ? theme.danger : theme.textSecondary;
            const corps = (
              <View style={styles.ligne}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="small">
                    {a.rang}. {formaterHeure(a.arrivee_prevue)} · {n}
                  </ThemedText>
                  {mot && statut ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      « {mot} »
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="smallBold" style={{ color: couleur }}>
                  {etiquette}
                </ThemedText>
              </View>
            );
            const libelle = `Arrêt ${a.rang}, passage prévu à ${formaterHeure(a.arrivee_prevue)}, ${n}, ${etiquette.toLowerCase()}${mot && statut ? `, commentaire : ${mot}` : ''}`;
            return onChoisir ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`${libelle}. Donner ou corriger le résultat.`} onPress={() => onChoisir(a)} style={styles.cible}>
                {corps}
              </Pressable>
            ) : (
              <View accessible accessibilityLabel={libelle}>
                {corps}
              </View>
            );
          }}
          ListFooterComponent={<Bouton titre="Fermer" variante="discret" pleineLargeur onPress={onFermer} />}
        />
      </View>
    </ModaleAnimee>
  );
}

const styles = StyleSheet.create({
  feuille: { ...FEUILLE_BASE },
  contenu: { padding: 20, gap: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cible: { minHeight: 48, justifyContent: 'center' },
});
