import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appuyable } from '@/components/appuyable';
import { BoutonAction } from '@/components/bouton-action';
import { ThemedText } from '@/components/themed-text';
import { useJetonsNavigation } from '@/hooks/use-jetons-navigation';

import { COULEUR_OMBRE, FEUILLE_BASE } from './style';

type Props = {
  /** La grosse ligne : « 4 min · 1,2 km » (prochain arrêt). */
  principal?: string | null;
  /** « Arrêt 1 sur 39 · reste 6 h 14 » */
  progression: string;
  /** « Égout bouché · Près de 900 place Jean-Paul-Riopelle » */
  lieu?: string | null;
  /** Petite étiquette, par exemple « Démonstration ». */
  etiquette?: string | null;
  /** « Vous êtes arrivé à l'arrêt 3 » : quand on est arrivé. */
  arrivee?: string | null;
  /** Information utile seulement par moments, en pastille : « Vous êtes à 380 m du départ prévu. » */
  info?: string | null;
  /** Proposition en une ligne avec un bouton, par exemple « Vous êtes à l'arrêt 3 : le faire maintenant ? » */
  suggestion?: { texte: string; titre: string; onPress: () => void } | null;
  titreAction?: string;
  occupe?: boolean;
  actionActive?: boolean;
  onAction: () => void;
  /** Fin de la navigation (bouton d'icône). */
  onArreter: () => void;
  /** Liste des arrêts (bouton d'icône). */
  onListe: () => void;
  /** Retour à l'écran précédent (bouton d'icône), si on peut. */
  onRetour?: () => void;
  message?: string | null;
};

/**
 * Panneau du bas de la navigation : un seul ensemble, aux couleurs du thème (celui de la carte quand elle est sombre).
 * Une action principale (« Arrêt fait ? »), des actions secondaires en boutons d'icône ronds.
 */
export function BarreNavigation({ principal, progression, lieu, etiquette, arrivee, info, suggestion, titreAction = 'Arrêt fait ?', occupe, actionActive = true, onAction, onArreter, onListe, onRetour, message }: Props) {
  const P = useJetonsNavigation();
  const { bottom } = useSafeAreaInsets();
  return (
    <View testID="panneau-navigation" style={[styles.panneau, FEUILLE_BASE, { backgroundColor: P.surface, paddingBottom: 12 + bottom }]}>
      <View style={styles.textes} accessibilityLiveRegion="polite">
        {principal ? (
          <ThemedText style={[styles.principal, { color: P.text }]} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {principal}
          </ThemedText>
        ) : null}
        <ThemedText style={[styles.progression, { color: P.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {progression}
          {etiquette ? ` · ${etiquette}` : ''}
        </ThemedText>
        {lieu ? (
          <ThemedText style={[styles.lieu, { color: P.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {lieu}
          </ThemedText>
        ) : null}
      </View>
      {info ? (
        <View style={[styles.pastille, { backgroundColor: P.backgroundSelected }]}>
          <Ionicons name="information-circle" size={18} color={P.primary} />
          <ThemedText style={[styles.pastilleTexte, { color: P.text }]} maxFontSizeMultiplier={1.2}>
            {info}
          </ThemedText>
        </View>
      ) : null}
      {arrivee ? (
        <View style={[styles.pastille, { backgroundColor: P.backgroundSelected }]} accessibilityRole="alert">
          <Ionicons name="flag" size={18} color={P.primary} />
          <ThemedText style={[styles.pastilleTexte, { color: P.text }]} maxFontSizeMultiplier={1.2}>
            {arrivee}
          </ThemedText>
        </View>
      ) : null}
      {suggestion ? (
        <View style={styles.suggestion}>
          <ThemedText style={[styles.pastilleTexte, { color: P.text, flex: 1 }]} maxFontSizeMultiplier={1.2}>
            {suggestion.texte}
          </ThemedText>
          <Appuyable accessibilityRole="button" accessibilityLabel={suggestion.titre} onPress={suggestion.onPress} style={[styles.petitBouton, { backgroundColor: P.backgroundSelected }]}>
            <ThemedText style={{ color: P.primary, fontWeight: '800', fontSize: 14 }}>{suggestion.titre}</ThemedText>
          </Appuyable>
        </View>
      ) : null}
      {message ? (
        <ThemedText style={[styles.progression, { color: P.textSecondary }]} maxFontSizeMultiplier={1.2}>
          {message}
        </ThemedText>
      ) : null}
      <View style={styles.rangee}>
        {onRetour ? <BoutonRond icone="arrow-back" libelle="Retour à l'écran précédent" onPress={onRetour} /> : null}
        <View style={styles.action}>
          <BoutonAction titre={occupe ? 'Enregistrement…' : titreAction} occupe={occupe} onPress={onAction} actif={!occupe && actionActive} />
        </View>
        <BoutonRond icone="list" libelle="Liste des arrêts" onPress={onListe} />
        <BoutonRond icone="stop" libelle="Arrêter la navigation" onPress={onArreter} />
      </View>
    </View>
  );
}

/** Bouton d'icône rond de 48 points (cible minimale), avec son libellé d'accessibilité. */
function BoutonRond({ icone, libelle, onPress }: { icone: 'arrow-back' | 'list' | 'stop'; libelle: string; onPress: () => void }) {
  const P = useJetonsNavigation();
  return (
    <Appuyable accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress} style={[styles.rond, { backgroundColor: P.backgroundSelected }]}>
      <Ionicons name={icone} size={24} color={P.primary} />
    </Appuyable>
  );
}

const styles = StyleSheet.create({
  panneau: { paddingTop: 16, paddingHorizontal: 16, gap: 8, shadowColor: COULEUR_OMBRE, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
  textes: { gap: 2 },
  principal: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  progression: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  lieu: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  pastilleTexte: { fontSize: 14, lineHeight: 20, fontWeight: '500', flexShrink: 1 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  petitBouton: { minHeight: 44, justifyContent: 'center', borderRadius: 16, paddingHorizontal: 16 },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { flex: 1 },
  rond: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
