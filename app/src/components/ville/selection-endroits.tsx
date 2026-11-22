import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { Region } from '@/lib/config';
import { formaterNombre } from '@/lib/format';
import { MESSAGE_SELECTION_VIDE } from '@/lib/messages';
import { compterSelection, gravitesDisponibles, libelleCompteur } from '@/lib/selection';
import { LIBELLES_GRAVITE, type Endroit, type Gravite } from '@/types';

import { Bouton } from './bouton';
import { CarteSelection } from './carte-selection';
import { CIBLE_MIN, COULEUR_REPERE } from './style';

const GRAVITES: Gravite[] = ['faible', 'moyenne', 'elevee'];
const PAS_LISTE = 20;

type Props = {
  endroits: Endroit[]; // endroits ouverts seulement
  region: Region;
  cles: string[];
  estChoisi: (cle: string) => boolean;
  choisirGravite: (g: Gravite) => void;
  basculer: (cle: string) => void;
  toutes: () => void;
  vider: () => void;
};

/** Choix des endroits à planifier : boutons de gravité, carte, compteur et liste de secours accessible. */
export function SelectionEndroits({ endroits, region, cles, estChoisi, choisirGravite, basculer, toutes, vider }: Props) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [plein, setPlein] = useState(false);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [limite, setLimite] = useState(PAS_LISTE);
  const compte = useMemo(() => compterSelection(cles, endroits), [cles, endroits]);
  const dispo = useMemo(() => gravitesDisponibles(endroits), [endroits]);
  const choisies = useMemo(() => new Set(cles), [cles]);

  return (
    <View style={styles.bloc}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Endroits à planifier
      </ThemedText>
      <View style={styles.rangee}>
        {GRAVITES.map((g) => {
          const tous = dispo[g] > 0 && endroits.filter((e) => e.gravite_affichee === g).every((e) => choisies.has(e.cle));
          return (
            <Bouton
              key={g}
              titre={`${LIBELLES_GRAVITE[g]} (${dispo[g]})`}
              variante="discret"
              selectionne={tous}
              actif={dispo[g] > 0}
              libelleAccessible={`Gravité ${LIBELLES_GRAVITE[g]}, ${formaterNombre(dispo[g], 'endroit', 'endroits')}, ${tous ? 'tous sélectionnés, toucher pour les retirer' : 'toucher pour tous les sélectionner'}`}
              onPress={() => choisirGravite(g)}
            />
          );
        })}
      </View>
      <View style={styles.rangee}>
        <Bouton titre="Tout sélectionner" variante="discret" onPress={toutes} />
        <Bouton titre="Tout retirer" variante="discret" onPress={vider} />
      </View>
      <ThemedText type="smallBold" accessibilityLiveRegion="polite">
        {libelleCompteur(compte)}
      </ThemedText>
      {compte.total === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {MESSAGE_SELECTION_VIDE}
        </ThemedText>
      ) : null}
      <CarteSelection
        endroits={endroits}
        region={region}
        estChoisi={estChoisi}
        onBasculer={basculer}
        style={{ height: Math.round(height * 0.55) }}
      />
      <Bouton titre="Agrandir la carte" variante="discret" onPress={() => setPlein(true)} />
      <Modal visible={plein} animationType="slide" onRequestClose={() => setPlein(false)}>
        <View style={[styles.plein, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.hautPlein}>
            <ThemedText type="smallBold" accessibilityLiveRegion="polite">
              {libelleCompteur(compte)}
            </ThemedText>
            <View style={styles.rangee}>
              <Bouton titre="Terminer" onPress={() => setPlein(false)} />
              {GRAVITES.map((g) => (
                <Bouton
                  key={g}
                  titre={LIBELLES_GRAVITE[g]}
                  variante="discret"
                  actif={dispo[g] > 0}
                  onPress={() => choisirGravite(g)}
                />
              ))}
            </View>
          </View>
          <CarteSelection
            endroits={endroits}
            region={region}
            estChoisi={estChoisi}
            onBasculer={basculer}
            style={styles.cartePleine}
          />
        </View>
      </Modal>
      <ThemedText type="small" themeColor="textSecondary">
        Touchez un repère pour l&apos;ajouter ou le retirer. Disque avec coche : sélectionné. Anneau vide : non sélectionné.
      </ThemedText>
      <Bouton
        titre={listeOuverte ? 'Masquer la liste des endroits' : 'Afficher la liste des endroits'}
        variante="discret"
        onPress={() => setListeOuverte((o) => !o)}
      />
      {listeOuverte ? (
        <View style={styles.liste}>
          {endroits.slice(0, limite).map((e) => {
            const choisi = choisies.has(e.cle);
            const nombre = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
            return (
              <Pressable
                key={e.cle}
                onPress={() => basculer(e.cle)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: choisi }}
                accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}, ${e.position.latitude.toFixed(4)}, ${e.position.longitude.toFixed(4)}`}
                style={[styles.ligne, { backgroundColor: choisi ? theme.backgroundSelected : theme.backgroundElement }]}>
                <ThemedText type="smallBold">{choisi ? '✓' : '○'}</ThemedText>
                <View style={[styles.pastille, { backgroundColor: COULEUR_REPERE[e.gravite_affichee] }]} />
                <ThemedText type="small" style={styles.texteLigne}>
                  {LIBELLES_GRAVITE[e.gravite_affichee]} · {nombre} · {e.position.latitude.toFixed(4)}, {e.position.longitude.toFixed(4)}
                </ThemedText>
              </Pressable>
            );
          })}
          {limite < endroits.length ? (
            <Bouton
              titre={`Afficher plus (${endroits.length - limite} restants)`}
              variante="discret"
              onPress={() => setLimite((l) => l + PAS_LISTE)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 10 },
  plein: { flex: 1 },
  hautPlein: { padding: 12, gap: 8 },
  cartePleine: { flex: 1, borderRadius: 0 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  liste: { gap: 6 },
  ligne: { minHeight: CIBLE_MIN, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastille: { width: 12, height: 12, borderRadius: 6 },
  texteLigne: { flex: 1 },
});
