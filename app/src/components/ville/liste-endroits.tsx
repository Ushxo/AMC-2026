import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formaterNombre } from '@/lib/format';
import { LIBELLES_GRAVITE, type Endroit } from '@/types';

import { Bouton } from './bouton';
import { CIBLE_MIN, COULEUR_REPERE } from './style';

const PAS = 20;

type Props = { endroits: Endroit[]; onOuvrir: (e: Endroit) => void };

/**
 * Liste équivalente à la carte (lecteurs d'écran, carte native qui n'expose pas ses repères) : un bouton par endroit,
 * les plus graves en premier. Repliée par défaut, affichée par morceaux de 20.
 */
export function ListeEndroits({ endroits, onOuvrir }: Props) {
  const theme = useTheme();
  const [ouverte, setOuverte] = useState(false);
  const [limite, setLimite] = useState(PAS);
  return (
    <View style={styles.bloc}>
      <Bouton
        titre={ouverte ? 'Masquer la liste des endroits' : `Afficher la liste des endroits (${endroits.length})`}
        variante="discret"
        onPress={() => setOuverte((o) => !o)}
      />
      {ouverte ? (
        <View style={styles.liste}>
          {endroits.slice(0, limite).map((e) => {
            const n = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
            return (
              <Pressable
                key={e.cle}
                accessibilityRole="button"
                accessibilityLabel={`${n}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}. Voir le suivi.`}
                onPress={() => onOuvrir(e)}
                style={[styles.ligne, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.pastille, { backgroundColor: COULEUR_REPERE[e.gravite_affichee] }]} />
                <ThemedText type="small" style={styles.texte}>
                  {LIBELLES_GRAVITE[e.gravite_affichee]} · {n}
                </ThemedText>
              </Pressable>
            );
          })}
          {limite < endroits.length ? (
            <Bouton titre={`Afficher plus (${endroits.length - limite} restants)`} variante="discret" onPress={() => setLimite((l) => l + PAS)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  liste: { gap: 6 },
  ligne: { minHeight: CIBLE_MIN, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastille: { width: 12, height: 12, borderRadius: 6 },
  texte: { flex: 1 },
});
