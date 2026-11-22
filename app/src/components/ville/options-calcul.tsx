import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  aidePosition,
  finIncomplete,
  libelleArrivee,
  libelleGarage,
  positionRecente,
  resumeOptions,
  type OptionsCalcul as Options,
} from '@/lib/options-calcul';
import type { Equipe, PositionEquipe } from '@/types';

import { Bouton } from './bouton';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  options: Options;
  onChanger: (o: Options) => void;
  equipes: Equipe[];
  positions: PositionEquipe[];
  /** Position (texte) de l'endroit de fin touché sur la carte, ou null. */
  texteFin?: string | null;
  /** Heure actuelle (ms), pour juger si une position est récente. */
  maintenant?: number;
};

/** Options du calcul (repliées) : pour chaque équipe, d'où elle part et où elle finit. */
export function OptionsCalcul({ options, onChanger, equipes, positions, texteFin, maintenant }: Props) {
  const theme = useTheme();
  const [ouvert, setOuvert] = useState(false);
  const [horloge] = useState(() => Date.now());
  const ms = maintenant ?? horloge;
  const actives = equipes.filter((e) => e.active);
  const ids = actives.map((e) => e.id);
  const positionDe = (id: string) => positions.find((p) => p.equipe_id === id);
  const recente = (id: string) => positionRecente(positionDe(id), ms);
  const resume = resumeOptions(options, ids);

  function toutesAuGarage() {
    onChanger({ ...options, departParEquipe: {} });
  }
  function toutesAPosition() {
    onChanger({ ...options, departParEquipe: Object.fromEntries(ids.filter(recente).map((id) => [id, 'position' as const])) });
  }

  return (
    <View style={styles.bloc}>
      <Bouton
        titre={ouvert ? 'Masquer les options du calcul' : 'Options du calcul'}
        variante="discret"
        libelleAccessible={`${ouvert ? 'Masquer' : 'Afficher'} les options du calcul. ${resume}`}
        onPress={() => setOuvert((o) => !o)}
      />
      {!ouvert ? (
        <ThemedText type="small" themeColor="textSecondary">
          {resume}
        </ThemedText>
      ) : (
        <View style={styles.bloc}>
          <View style={styles.rangee}>
            <Bouton titre="Toutes au garage" variante="discret" onPress={toutesAuGarage} />
            <Bouton titre="Toutes à leur position" variante="discret" actif={ids.some(recente)} onPress={toutesAPosition} />
          </View>
          {actives.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune équipe active.
            </ThemedText>
          ) : null}
          {actives.map((e) => {
            const depart = options.departParEquipe[e.id] ?? 'garage';
            const fin = options.finParEquipe[e.id] ?? 'arrivee';
            const peutPosition = recente(e.id);
            return (
              <View key={e.id} style={[styles.ligne, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" accessibilityRole="header">
                  {e.nom}
                </ThemedText>
                <ThemedText type="small">Départ</ThemedText>
                <View style={styles.rangee}>
                  <Bouton
                    titre={libelleGarage(e)}
                    variante="discret"
                    selectionne={depart === 'garage'}
                    onPress={() => {
                      const { [e.id]: _retire, ...reste } = options.departParEquipe;
                      onChanger({ ...options, departParEquipe: reste });
                    }}
                  />
                  <Bouton
                    titre="Position actuelle"
                    variante="discret"
                    selectionne={depart === 'position'}
                    actif={peutPosition}
                    onPress={() => onChanger({ ...options, departParEquipe: { ...options.departParEquipe, [e.id]: 'position' } })}
                  />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {aidePosition(positionDe(e.id), ms)}
                </ThemedText>
                <ThemedText type="small">Fin</ThemedText>
                <View style={styles.rangee}>
                  <Bouton
                    titre={libelleArrivee(e)}
                    variante="discret"
                    selectionne={fin === 'arrivee'}
                    onPress={() => {
                      const { [e.id]: _retire, ...reste } = options.finParEquipe;
                      onChanger({ ...options, finParEquipe: reste });
                    }}
                  />
                  <Bouton
                    titre="Fin au dernier arrêt"
                    variante="discret"
                    selectionne={fin === 'libre'}
                    onPress={() => onChanger({ ...options, finParEquipe: { ...options.finParEquipe, [e.id]: 'libre' } })}
                  />
                </View>
              </View>
            );
          })}
          <Bouton
            titre="Répartir le travail entre les équipes"
            variante="discret"
            selectionne={options.repartir}
            onPress={() => onChanger({ ...options, repartir: !options.repartir })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {options.repartir
              ? 'Le travail est partagé pour que la tournée la plus longue soit la plus courte possible.'
              : 'Désactivé : le plan réduit seulement les kilomètres, une équipe peut recevoir presque tous les arrêts.'}
          </ThemedText>
          <ThemedText type="smallBold" accessibilityRole="header">
            Option avancée
          </ThemedText>
          <Bouton
            titre="Finir à un endroit"
            variante="discret"
            selectionne={options.finEndroit}
            onPress={() => onChanger({ ...options, finEndroit: !options.finEndroit })}
          />
          {options.finEndroit ? (
            <ThemedText type="small" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {finIncomplete(options)
                ? 'Touchez un repère sur la carte pour choisir où finir.'
                : `Endroit de fin choisi : ${texteFin ?? 'sur la carte'}. Touchez un autre repère pour le changer.`}
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ligne: { padding: 12, borderRadius: 14, gap: 6 },
});
