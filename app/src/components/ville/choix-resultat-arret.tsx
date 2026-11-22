import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import { useTheme } from '@/hooks/use-theme';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

export type ChoixResultat = 'oui' | 'non';

/**
 * « Arrêt fait ? » : deux boutons de même poids. La couleur (jeton success ou danger) accompagne toujours un mot et une icône,
 * elle n'est jamais le seul signe. Le choix déjà fait est marqué (fond et libellé « sélectionné »).
 */
export function ChoixResultatArret({
  choix,
  onChoisir,
  actif = true,
}: {
  choix: ChoixResultat | null;
  onChoisir: (c: ChoixResultat) => void;
  actif?: boolean;
}) {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const boutons: { id: ChoixResultat; mot: string; libelle: string; icone: 'checkmark-circle' | 'close-circle'; couleur: string }[] = [
    { id: 'oui', mot: 'Oui', libelle: "Oui, l'arrêt est fait", icone: 'checkmark-circle', couleur: P.success },
    { id: 'non', mot: 'Non', libelle: "Non, l'arrêt n'est pas fait", icone: 'close-circle', couleur: P.danger },
  ];
  return (
    <View style={styles.rangee}>
      {boutons.map((b) => {
        const choisi = choix === b.id;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={choisi ? `${b.libelle}, sélectionné` : b.libelle}
            accessibilityState={{ selected: choisi, disabled: !actif }}
            disabled={!actif}
            onPress={() => onChoisir(b.id)}
            style={[styles.bouton, { borderColor: b.couleur }, choisi && styles.choisi, !actif && styles.inactif]}>
            <Ionicons name={b.icone} size={24} color={b.couleur} />
            <Text style={styles.mot} maxFontSizeMultiplier={1.2}>
              {b.mot}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const creerStyles = (P: Jetons) =>
  StyleSheet.create({
    rangee: { flexDirection: 'row', gap: 12 },
    bouton: { flex: 1, minHeight: 48, borderRadius: 22, borderWidth: 2, backgroundColor: P.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
    choisi: { backgroundColor: P.backgroundSelected },
    inactif: { opacity: 0.5 },
    mot: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: P.text },
  });
