import { StyleSheet, Switch, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';

import { ApparitionDouce } from '@/components/mouvement/apparition-douce';
import { ThemedText } from '@/components/themed-text';
import { Coche } from '@/components/ville/coche';
import { useTheme } from '@/hooks/use-theme';
import { definirLisibilite, definirTheme, jetonsDuTheme } from '@/marque/magasin';
import { LIBELLES_THEME_APP, THEMES_IDS, type ThemeId } from '@/marque/themes';
import { useMarque } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

/** Mini-écran d'aperçu fidèle : en-tête, fond, carte et bouton, dessinés avec les vrais jetons du thème. */
export function ApercuTheme({ jetons }: { jetons: Jetons }) {
  return (
    <View testID="apercu-theme" style={[styles.apercu, { backgroundColor: jetons.background, borderColor: jetons.borderForte }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.apercuEntete, { backgroundColor: jetons.header }]}>
        <View style={[styles.trait, { backgroundColor: jetons.onHeader, width: '55%' }]} />
      </View>
      <View style={[styles.apercuCarte, { backgroundColor: jetons.surface, borderColor: jetons.border }]}>
        <View style={[styles.trait, { backgroundColor: jetons.text, width: '70%' }]} />
        <View style={[styles.trait, { backgroundColor: jetons.textSecondary, width: '45%' }]} />
      </View>
      <View style={[styles.apercuBouton, { backgroundColor: jetons.action }]} />
    </View>
  );
}

/** Choix du thème (grille de cartes) et réglages de lisibilité (deux interrupteurs séparés). Application immédiate. */
export function ChoixTheme() {
  const theme = useTheme();
  const { organisation, theme: actuel, lisibilite } = useMarque();
  return (
    <>
      <ThemedText type="smallBold" accessibilityRole="header">
        Thème
      </ThemedText>
      <View style={styles.grille} accessibilityRole="radiogroup">
        {THEMES_IDS.map((id: ThemeId) => {
          const actif = actuel === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={LIBELLES_THEME_APP[id]}
              accessibilityState={{ checked: actif, selected: actif }}
              onPress={() => definirTheme(id)}
              style={[styles.carte, { backgroundColor: actif ? theme.backgroundSelected : theme.backgroundElement, borderColor: actif ? theme.primary : theme.border }]}>
              <ApercuTheme jetons={jetonsDuTheme(organisation, id)} />
              <ApparitionDouce visible={actif} style={[styles.coche, { backgroundColor: theme.primary }]}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Coche taille={14} couleur={theme.onPrimary} />
                </View>
              </ApparitionDouce>
              <ThemedText type={actif ? 'smallBold' : 'small'} numberOfLines={1} style={styles.nom} maxFontSizeMultiplier={1.2}>
                {id === 'organisation' ? 'Organisation' : LIBELLES_THEME_APP[id]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="smallBold" accessibilityRole="header">
        Lisibilité
      </ThemedText>
      <LigneInterrupteur titre="Contraste élevé" aide="Textes et contours renforcés" valeur={lisibilite.contraste} onChange={(v) => definirLisibilite({ contraste: v })} />
      <LigneInterrupteur titre="Adapté au daltonisme" aide="Succès en bleu, danger en vermillon" valeur={lisibilite.daltonisme} onChange={(v) => definirLisibilite({ daltonisme: v })} />
    </>
  );
}

function LigneInterrupteur({ titre, aide, valeur, onChange }: { titre: string; aide: string; valeur: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.ligne, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="smallBold" style={styles.titreLigne} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {titre}
      </ThemedText>
      <View style={styles.zoneInterrupteur}>
      <Switch
        style={styles.interrupteur}
        value={valeur}
        onValueChange={onChange}
        accessibilityLabel={`${titre} : ${valeur ? 'activé' : 'désactivé'}`}
        accessibilityHint={aide}
        trackColor={{ true: theme.primary, false: theme.borderForte }}
        ios_backgroundColor={theme.borderForte}
        thumbColor={theme.surface}
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carte: { flexBasis: '31%', flexGrow: 1, minHeight: 44, borderRadius: 12, borderWidth: 2, padding: 4, gap: 4 },
  coche: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nom: { textAlign: 'center' },
  apercu: { height: 56, borderRadius: 8, borderWidth: 1, overflow: 'hidden', gap: 4 },
  apercuEntete: { height: 12, justifyContent: 'center', paddingHorizontal: 8 },
  apercuCarte: { marginHorizontal: 4, borderRadius: 4, borderWidth: 1, padding: 4, gap: 4 },
  apercuBouton: { marginHorizontal: 4, height: 8, borderRadius: 4, width: '40%' },
  trait: { height: 4, borderRadius: 2 },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  titreLigne: { flex: 1 },
  // Zone fixe aux dimensions natives de l'interrupteur (51 x 31) : il est centré dans la ligne, allumé comme éteint.
  zoneInterrupteur: { width: 51, height: 31, alignItems: 'center', justifyContent: 'center' },
  interrupteur: { alignSelf: 'center' },
});
