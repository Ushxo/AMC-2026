import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { Bouton } from './bouton';

type Props = {
  /** « Arrêt 3 sur 41 » */
  pastille: string;
  /** Petite étiquette, par exemple « Démonstration ». */
  etiquette?: string | null;
  /** « Vous êtes arrivé à l'arrêt 3 » : quand on est arrivé, « Arrêt fait » devient le bouton principal. */
  arrivee?: string | null;
  /** « Reste (estimé) : 5 h 10 · 30 arrêts » */
  reste?: string | null;
  /** Proposition en une ligne avec un bouton, par exemple « Vous êtes à l'arrêt 3 : le faire maintenant ? » */
  suggestion?: { texte: string; titre: string; onPress: () => void } | null;
  /** Information courte, par exemple « Vous êtes à 1,2 km du départ prévu. » */
  info?: string | null;
  titreAction?: string;
  occupe?: boolean;
  onAction: () => void;
  actionActive?: boolean;
  onArreter: () => void;
  onListe: () => void;
  message?: string | null;
};

/** Barre d'actions fixe sous la carte de navigation : l'état de la tournée et les trois actions utiles au volant. */
export function BarreNavigation({
  pastille,
  etiquette,
  arrivee,
  reste,
  info,
  suggestion,
  titreAction = 'Arrêt fait',
  occupe,
  onAction,
  actionActive = true,
  onArreter,
  onListe,
  message,
}: Props) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.barre, { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected, paddingBottom: 10 + bottom }]}>
      <View style={styles.texte} accessibilityLiveRegion="polite">
        <ThemedText type="smallBold">
          {pastille}
          {etiquette ? ` · ${etiquette}` : ''}
        </ThemedText>
        {reste ? <ThemedText type="small">{reste}</ThemedText> : null}
        {info ? <ThemedText type="small">{info}</ThemedText> : null}
        {suggestion ? (
          <View style={styles.suggestion}>
            <ThemedText type="small" style={styles.texteSuggestion}>
              {suggestion.texte}
            </ThemedText>
            <Bouton titre={suggestion.titre} variante="discret" onPress={suggestion.onPress} />
          </View>
        ) : null}
        {arrivee ? <ThemedText type="small">{arrivee}</ThemedText> : null}
        {message ? <ThemedText type="small">{message}</ThemedText> : null}
      </View>
      <View style={styles.rangee}>
        <View style={styles.action}>
          <Bouton
            pleineLargeur
            titre={occupe ? 'Enregistrement…' : titreAction}
            occupe={occupe}
            variante={arrivee ? 'plein' : 'discret'}
            actif={!occupe && actionActive}
            onPress={onAction}
          />
        </View>
        <Bouton titre="Arrêter" variante="discret" onPress={onArreter} />
        <Bouton titre="Arrêts" variante="discret" onPress={onListe} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 12, gap: 8 },
  texte: { gap: 2 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  texteSuggestion: { flex: 1 },
  rangee: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  action: { flex: 1 },
});
