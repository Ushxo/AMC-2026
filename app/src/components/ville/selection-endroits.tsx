import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { SelecteurCarte } from './selecteur-carte';
import { CarteSelection } from './carte-selection';
import { CIBLE_MIN, COULEUR_REPERE, COULEUR_OMBRE, BLANC_FIXE } from './style';

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

/** Petite pastille de filtre par gravité : point de couleur, libellé et nombre d'endroits. */
function PastilleGravite({
  gravite,
  nombre,
  tous,
  libelleAccessible,
  onPress,
}: {
  gravite: Gravite;
  nombre: number;
  tous: boolean;
  libelleAccessible?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const couleur = COULEUR_REPERE[gravite];
  const actif = nombre > 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={libelleAccessible}
      accessibilityState={{ disabled: !actif, selected: tous }}
      style={({ pressed }) => [
        styles.pastille,
        {
          borderColor: tous ? couleur : theme.border,
          backgroundColor: tous ? couleur + '1F' : theme.surface,
          opacity: !actif ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}>
      <View style={[styles.point, { backgroundColor: couleur }]} />
      <ThemedText type={tous ? 'smallBold' : 'small'} style={styles.pastilleTexte} numberOfLines={1}>
        {LIBELLES_GRAVITE[gravite]}
      </ThemedText>
      <View style={[styles.nombre, { backgroundColor: tous ? couleur : theme.backgroundElement }]}>
        <ThemedText type="smallBold" style={[styles.nombreTexte, { color: tous ? BLANC_FIXE : theme.text }]}>
          {nombre}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Petit bouton texte (actions secondaires). */
function Lien({ titre, icone, onPress }: { titre: string; icone: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => [styles.lien, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icone} size={15} color={theme.primary} />
      <ThemedText type="smallBold" style={[styles.lienTexte, { color: theme.primary }]}>
        {titre}
      </ThemedText>
    </Pressable>
  );
}

/** Choix des endroits à planifier : filtres de gravité, carte, compteur et liste de secours accessible. */
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

  const pastilles = GRAVITES.map((g) => {
    const tous = dispo[g] > 0 && endroits.filter((e) => e.gravite_affichee === g).every((e) => choisies.has(e.cle));
    return (
      <PastilleGravite
        key={g}
        gravite={g}
        nombre={dispo[g]}
        tous={tous}
        libelleAccessible={`Gravité ${LIBELLES_GRAVITE[g]}, ${formaterNombre(dispo[g], 'endroit', 'endroits')}, ${tous ? 'tous sélectionnés, toucher pour les retirer' : 'toucher pour tous les sélectionner'}`}
        onPress={() => choisirGravite(g)}
      />
    );
  });

  return (
    <View style={[styles.carte, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.entete}>
        <View style={[styles.icone, { backgroundColor: theme.accent + '22' }]}>
          <Ionicons name="map-outline" size={20} color={theme.accent} />
        </View>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.titre}>
          Endroits à planifier
        </ThemedText>
      </View>

      <View style={styles.filtres}>{pastilles}</View>

      <View style={[styles.resume, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="checkmark-circle" size={18} color={compte.total > 0 ? theme.success : theme.textSecondary} />
        <ThemedText type="smallBold" accessibilityLiveRegion="polite" style={styles.flexible}>
          {libelleCompteur(compte)}
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <Lien titre="Tout sélectionner" icone="checkbox-outline" onPress={toutes} />
        <Lien titre="Tout retirer" icone="close-circle-outline" onPress={vider} />
      </View>
      {compte.total === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {MESSAGE_SELECTION_VIDE}
        </ThemedText>
      ) : null}

      <View style={[styles.cadreCarte, { borderColor: theme.border }]}>
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
          style={{ height: Math.round(height * 0.5) }}
        />
        <Pressable
          onPress={() => setPlein(true)}
          accessibilityRole="button"
          accessibilityLabel="Agrandir la carte"
          hitSlop={6}
          style={[styles.agrandir, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="expand-outline" size={18} color={theme.text} />
        </Pressable>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Touchez un repère pour l&apos;ajouter ou le retirer. Disque avec coche : sélectionné. Anneau vide : non sélectionné.
      </ThemedText>
      {zones.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {MESSAGE_ZONE_ESTIMEE}. Touchez une zone pour sélectionner (ou retirer) tous ses endroits ; « Voir la zone » ouvre sa fiche.
        </ThemedText>
      ) : null}
      <SelecteurCarte />

      <Modal visible={plein} animationType="slide" onRequestClose={() => setPlein(false)}>
        <View style={[styles.plein, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.hautPlein}>
            <View style={styles.hautPleinLigne}>
              <ThemedText type="smallBold" accessibilityLiveRegion="polite" style={styles.flexible}>
                {libelleCompteur(compte)}
              </ThemedText>
              <Bouton titre="Terminer" onPress={() => setPlein(false)} />
            </View>
            <View style={styles.filtres}>
              {GRAVITES.map((g) => (
                <PastilleGravite
                  key={g}
                  gravite={g}
                  nombre={dispo[g]}
                  tous={dispo[g] > 0 && endroits.filter((e) => e.gravite_affichee === g).every((e) => choisies.has(e.cle))}
                  libelleAccessible={LIBELLES_GRAVITE[g]}
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

      <Lien
        titre={listeOuverte ? 'Masquer la liste des endroits' : 'Afficher la liste des endroits'}
        icone={listeOuverte ? 'chevron-up' : 'list-outline'}
        onPress={() => setListeOuverte((o) => !o)}
      />
      {listeOuverte ? (
        <View style={styles.liste}>
          {endroits.slice(0, limite).map((e) => {
            const choisi = choisies.has(e.cle);
            const nombre = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
            const couleur = COULEUR_REPERE[e.gravite_affichee];
            return (
              <Pressable
                key={e.cle}
                onPress={() => basculer(e.cle)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: choisi }}
                accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}, ${e.position.latitude.toFixed(4)}, ${e.position.longitude.toFixed(4)}`}
                style={[
                  styles.ligne,
                  { borderColor: choisi ? couleur + '66' : theme.border, backgroundColor: choisi ? couleur + '12' : theme.surface },
                ]}>
                <View style={[styles.barre, { backgroundColor: couleur }]} />
                <Ionicons name={choisi ? 'checkbox' : 'square-outline'} size={20} color={choisi ? theme.primary : theme.textSecondary} />
                <View style={styles.flexible}>
                  <ThemedText type="smallBold">
                    {LIBELLES_GRAVITE[e.gravite_affichee]} · {nombre}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {e.position.latitude.toFixed(4)}, {e.position.longitude.toFixed(4)}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
          {limite < endroits.length ? (
            <Lien
              titre={`Afficher plus (${endroits.length - limite} restants)`}
              icone="chevron-down"
              onPress={() => setLimite((l) => l + PAS_LISTE)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: COULEUR_OMBRE,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titre: { fontSize: 19, lineHeight: 24 },
  filtres: { flexDirection: 'row', gap: 6 },
  pastille: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    gap: 5,
    height: 34,
    paddingLeft: 8,
    paddingRight: 4,
    borderRadius: 17,
    borderWidth: 1,
  },
  point: { width: 9, height: 9, borderRadius: 5 },
  pastilleTexte: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  nombre: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  nombreTexte: { fontSize: 12, lineHeight: 16 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  lien: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, alignSelf: 'flex-start' },
  lienTexte: { fontSize: 13, lineHeight: 18 },
  cadreCarte: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  agrandir: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plein: { flex: 1 },
  hautPlein: { padding: 12, gap: 10 },
  hautPleinLigne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartePleine: { flex: 1, borderRadius: 0 },
  liste: { gap: 8 },
  ligne: {
    minHeight: CIBLE_MIN,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingRight: 12,
    paddingLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barre: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  flexible: { flex: 1 },
});
