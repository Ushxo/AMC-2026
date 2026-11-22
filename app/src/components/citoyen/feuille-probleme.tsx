import { StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { FEUILLE_BASE } from '@/components/ville/style';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IllustrationProbleme } from '@/components/illustration-probleme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BlurView } from '@/lib/flou-optionnel';
import { CATEGORIES_PROPOSEES, LIBELLES_CATEGORIE, type Categorie } from '@/types';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';
import { BoutonAction } from '@/components/bouton-action';

const TITRE_CARTE: Partial<Record<Categorie, string>> = {
  grille_bouchee: 'Égout bouché',
  eau_accumulee: "Accumulation d'eau ou inondation",
  affaissement: "Affaissement autour d'un égout",
  grille_endommagee: "Grille d'égout endommagée",
};

/**
 * Feuille « Quel problème avez-vous observé ? » : monte par-dessus l'écran (la carte reste visible, floutée derrière).
 * Sans le module de flou (build pas rebâtie), un voile clair semi-transparent le remplace : jamais de noir.
 */
export function FeuilleProbleme({
  categorie,
  onChoisir,
  onContinuer,
  onFermer,
  erreur,
}: {
  categorie: Categorie | null;
  onChoisir: (c: Categorie) => void;
  onContinuer: () => void;
  onFermer: () => void;
  erreur?: string | null;
}) {
  const styles = useStyles(creerStyles);
  const { bottom } = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View style={styles.plein} pointerEvents="box-none">
      <Pressable retour={false} style={styles.plein} onPress={onFermer} accessibilityRole="button" accessibilityLabel="Fermer sans signaler">
        {BlurView ? (
          <BlurView intensity={25} tint="light" style={styles.plein}>
            <View style={[styles.plein, styles.teinte]} />
          </BlurView>
        ) : (
          <View style={[styles.plein, styles.voile]} />
        )}
      </Pressable>
      <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 20 }]}>
        <View style={[styles.poignee, { backgroundColor: theme.borderForte }]} />
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.titre} maxFontSizeMultiplier={1.3}>
          Quel problème avez-vous observé ?
        </ThemedText>
        <View style={styles.grille}>
          {CATEGORIES_PROPOSEES.map((c) => {
            const choisi = categorie === c;
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected: choisi }}
                accessibilityLabel={TITRE_CARTE[c] ?? LIBELLES_CATEGORIE[c]}
                onPress={() => onChoisir(c)}
                style={[
                  styles.carte,
                  { backgroundColor: choisi ? theme.accentDoux : theme.surface, borderColor: choisi ? theme.accent : theme.border, borderWidth: choisi ? 3 : 1 },
                ]}>
                <View style={styles.dessin}>
                  <IllustrationProbleme categorie={c} taille={84} />
                </View>
                <ThemedText type="smallBold" style={styles.texte} maxFontSizeMultiplier={1.3}>
                  {TITRE_CARTE[c] ?? LIBELLES_CATEGORIE[c]}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {erreur ? (
          <ThemedText type="small" accessibilityRole="alert" style={{ color: theme.danger }}>
            {erreur}
          </ThemedText>
        ) : null}
        <BoutonAction titre="Continuer" actif={!!categorie} onPress={onContinuer} />
      </View>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  plein: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  teinte: { backgroundColor: 'rgba(248, 244, 234, 0.35)' },
  voile: { backgroundColor: 'rgba(248, 244, 234, 0.72)' },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, ...FEUILLE_BASE, paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  poignee: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3 },
  titre: { textAlign: 'center', fontSize: 24, lineHeight: 30 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  carte: { flexBasis: '47%', flexGrow: 1, borderRadius: 22, padding: 12, alignItems: 'center', minHeight: 150, justifyContent: 'space-between' },
  dessin: { height: 84, alignItems: 'center', justifyContent: 'center' },
  texte: { textAlign: 'center' },
});
