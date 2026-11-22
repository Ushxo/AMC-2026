import { useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { Region } from '@/lib/config';
import { formaterNombre } from '@/lib/format';
import { MESSAGE_SELECTION_VIDE, MESSAGE_ZONE_ESTIMEE } from '@/lib/messages';
import type { Zone } from '@/lib/zones';
import { compterSelection, gravitesDisponibles, libelleCompteur } from '@/lib/selection';
import { LIBELLES_GRAVITE, type Endroit, type Gravite, type Signalement } from '@/types';

import { Bouton } from './bouton';
import { Chip } from './chip';
import { CarteSelection } from './carte-selection';
import { CIBLE_MIN, COULEUR_REPERE } from './style';
import { Coche } from './coche';

const GRAVITES: Gravite[] = ['elevee', 'moyenne', 'faible'];
const PAS_LISTE = 20;

type Props = {
  endroits: Endroit[]; // endroits ouverts seulement
  region: Region;
  cles: string[];
  estChoisi: (cle: string) => boolean;
  choisirGravite: (g: Gravite) => void;
  basculer: (cle: string) => void;
  basculerZoneEndroits: (clesZone: string[]) => void;
  toutes: () => void;
  vider: () => void;
  /** Zones de signalements (inondation) et leurs signalements, pour la fiche. */
  zones?: Zone[];
  signalements?: Signalement[];
  onOuvrirSignalement?: (id: string) => void;
  modeFin?: boolean;
  cleFin?: string | null;
  onChoisirFin?: (cle: string) => void;
};

/** Choix des endroits à planifier : boutons de gravité, carte, compteur et liste de secours accessible. */
export function SelectionEndroits({
  endroits,
  region,
  cles,
  estChoisi,
  choisirGravite,
  basculer,
  basculerZoneEndroits,
  toutes,
  vider,
  zones = [],
  signalements = [],
  onOuvrirSignalement,
  modeFin,
  cleFin,
  onChoisirFin,
}: Props) {
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
      <ThemedText type="smallBold" style={{ fontSize: 17, lineHeight: 24 }} accessibilityRole="header">
        Quoi inclure
      </ThemedText>
      <View style={styles.rangee}>
        {GRAVITES.map((g) => {
          const tous = dispo[g] > 0 && endroits.filter((e) => e.gravite_affichee === g).every((e) => choisies.has(e.cle));
          return (
            <Chip
              key={g}
              titre={`${LIBELLES_GRAVITE[g]} (${dispo[g]})`}
              selectionne={tous}
              actif={dispo[g] > 0}
              libelleAccessible={`Gravité ${LIBELLES_GRAVITE[g]}, ${formaterNombre(dispo[g], 'endroit', 'endroits')}, ${tous ? 'tous sélectionnés, toucher pour les retirer' : 'toucher pour tous les sélectionner'}`}
              onPress={() => choisirGravite(g)}
            />
          );
        })}
      </View>
      <View style={styles.rangee}>
        <Chip titre="Choisir une zone sur la carte" libelleAccessible="Choisir une zone sur la carte : ouvrir la carte en grand" onPress={() => setPlein(true)} />
        <Chip titre="Tout sélectionner" onPress={toutes} />
        <Chip titre="Tout retirer" onPress={vider} />
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
        cles={cles}
        onBasculer={basculer}
        zones={zones}
        signalements={signalements}
        onBasculerZone={basculerZoneEndroits}
        onOuvrirSignalement={onOuvrirSignalement}
        modeFin={modeFin}
        cleFin={cleFin}
        onChoisirFin={onChoisirFin}
        style={{ height: Math.round(height * 0.55) }}
      />
      {zones.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {MESSAGE_ZONE_ESTIMEE}. Touchez une zone pour sélectionner (ou retirer) tous ses endroits ; « Voir la zone » ouvre sa fiche.
        </ThemedText>
      ) : null}
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
            cles={cles}
            onBasculer={basculer}
            zones={zones}
            signalements={signalements}
            onBasculerZone={basculerZoneEndroits}
            onOuvrirSignalement={(id) => {
              setPlein(false);
              onOuvrirSignalement?.(id);
            }}
            modeFin={modeFin}
            cleFin={cleFin}
            onChoisirFin={onChoisirFin}
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
                <View style={[styles.caseCoche, { borderColor: theme.borderForte }]}>{choisi ? <Coche /> : null}</View>
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
  bloc: { gap: 12 },
  plein: { flex: 1 },
  hautPlein: { padding: 12, gap: 8 },
  cartePleine: { flex: 1, borderRadius: 0 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  liste: { gap: 8 },
  ligne: { minHeight: CIBLE_MIN, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pastille: { width: 12, height: 12, borderRadius: 6 },
  caseCoche: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  texteLigne: { flex: 1 },
});
