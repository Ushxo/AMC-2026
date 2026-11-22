import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  aidePosition,
  finIncomplete,
  libelleArrivee,
  libelleGarage,
  positionRecente,
  type OptionsCalcul as Options,
} from '@/lib/options-calcul';
import { useState } from 'react';
import type { Equipe, PositionEquipe } from '@/types';

import { Chip } from './chip';
import { couleurEquipe } from './style';
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

type Props = {
  options: Options;
  onChanger: (o: Options) => void;
  equipes: Equipe[];
  positions: PositionEquipe[];
  /** Position (texte) de l'endroit de fin touché sur la carte, ou null. */
  texteFin?: string | null;
  /** Heure actuelle (ms), pour juger si une position est récente. */
  maintenant?: number;
  /** Lien « Gérer » de la carte Équipes. */
  onGerer?: () => void;
};

const COURT_DEPART: Record<'garage' | 'position', string> = { garage: 'garage', position: 'sa position' };

/** Options du calcul : une carte « Équipes » (départ et arrivée de chaque équipe, modifiables) et la bascule « Répartir le travail ». */
export function OptionsCalcul({ options, onChanger, equipes, positions, texteFin, maintenant, onGerer }: Props) {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const [horloge] = useState(() => Date.now());
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>({});
  const ms = maintenant ?? horloge;
  const actives = equipes.filter((e) => e.active);
  const ids = actives.map((e) => e.id);
  const positionDe = (id: string) => positions.find((p) => p.equipe_id === id);
  const recente = (id: string) => positionRecente(positionDe(id), ms);

  function toutesAuGarage() {
    onChanger({ ...options, departParEquipe: {} });
  }
  function toutesAPosition() {
    onChanger({ ...options, departParEquipe: Object.fromEntries(ids.filter(recente).map((id) => [id, 'position' as const])) });
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.carte}>
        <View style={styles.entete}>
          <ThemedText style={styles.titre} accessibilityRole="header">
            Équipes
          </ThemedText>
          {onGerer ? (
            <Pressable onPress={onGerer} accessibilityRole="button" accessibilityLabel="Gérer les équipes" style={styles.lien}>
              <ThemedText style={styles.lienTexte}>Gérer</ThemedText>
            </Pressable>
          ) : null}
        </View>
        {actives.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Aucune équipe active.
          </ThemedText>
        ) : null}
        {actives.map((e, i) => {
          const depart = options.departParEquipe[e.id] ?? 'garage';
          const fin = options.finParEquipe[e.id] ?? 'arrivee';
          const peutPosition = recente(e.id);
          const resume = `Départ : ${COURT_DEPART[depart]} · Arrivée : ${fin === 'libre' ? 'libre' : e.arrivee ? 'autre adresse' : 'garage'}`;
          const ouvert = !!ouvertes[e.id];
          return (
            <View key={e.id}>
              {i > 0 ? <View style={styles.separateur} /> : null}
              <Pressable
                onPress={() => setOuvertes((o) => ({ ...o, [e.id]: !o[e.id] }))}
                accessibilityRole="button"
                accessibilityState={{ expanded: ouvert }}
                accessibilityLabel={`${e.nom}. ${resume}. ${ouvert ? 'Masquer' : 'Modifier'} le départ et l'arrivée.`}
                style={styles.ligne}>
                <View style={[styles.point, { backgroundColor: couleurEquipe(i) }]} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.nom}>{e.nom}</ThemedText>
                  <ThemedText style={styles.detail}>{resume}</ThemedText>
                </View>
                <ThemedText style={styles.lienTexte}>{ouvert ? 'Fermer' : 'Modifier'}</ThemedText>
              </Pressable>
              {ouvert ? (
                <View style={styles.choix}>
                  <ThemedText type="smallBold">Départ</ThemedText>
                  <View style={styles.rangee}>
                    <Chip
                      titre={libelleGarage(e)}
                      selectionne={depart === 'garage'}
                      onPress={() => {
                        const { [e.id]: _retire, ...reste } = options.departParEquipe;
                        onChanger({ ...options, departParEquipe: reste });
                      }}
                    />
                    <Chip
                      titre="Position actuelle"
                      selectionne={depart === 'position'}
                      actif={peutPosition}
                      onPress={() => onChanger({ ...options, departParEquipe: { ...options.departParEquipe, [e.id]: 'position' } })}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {aidePosition(positionDe(e.id), ms)}
                  </ThemedText>
                  <ThemedText type="smallBold">Fin</ThemedText>
                  <View style={styles.rangee}>
                    <Chip
                      titre={libelleArrivee(e)}
                      selectionne={fin === 'arrivee'}
                      onPress={() => {
                        const { [e.id]: _retire, ...reste } = options.finParEquipe;
                        onChanger({ ...options, finParEquipe: reste });
                      }}
                    />
                    <Chip
                      titre="Fin au dernier arrêt"
                      selectionne={fin === 'libre'}
                      onPress={() => onChanger({ ...options, finParEquipe: { ...options.finParEquipe, [e.id]: 'libre' } })}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
        {actives.length > 1 ? (
          <View style={styles.rangee}>
            <Chip titre="Toutes au garage" onPress={toutesAuGarage} />
            <Chip titre="Toutes à leur position" actif={ids.some(recente)} onPress={toutesAPosition} />
          </View>
        ) : null}
      </View>

      <View style={styles.carteBascule}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.nom}>Répartir le travail également</ThemedText>
          <ThemedText style={styles.detail}>
            {options.repartir
              ? 'Même charge pour chaque équipe : la tournée la plus longue est la plus courte possible.'
              : 'Désactivé : le plan réduit seulement les kilomètres, une équipe peut recevoir presque tous les arrêts.'}
          </ThemedText>
        </View>
        <Switch
          value={options.repartir}
          onValueChange={(v) => onChanger({ ...options, repartir: v })}
          accessibilityLabel="Répartir le travail entre les équipes"
          trackColor={{ true: P.primary, false: P.border }}
        />
      </View>

      <View style={styles.carteBascule}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.nom}>Finir à un endroit (option avancée)</ThemedText>
          <ThemedText style={styles.detail} accessibilityLiveRegion="polite">
            {options.finEndroit
              ? finIncomplete(options)
                ? 'Touchez un repère sur la carte pour choisir où finir.'
                : `Endroit de fin choisi : ${texteFin ?? 'sur la carte'}. Touchez un autre repère pour le changer.`
              : 'Toutes les équipes finissent à un endroit choisi sur la carte.'}
          </ThemedText>
        </View>
        <Switch
          value={options.finEndroit}
          onValueChange={(v) => onChanger({ ...options, finEndroit: v })}
          accessibilityLabel="Finir à un endroit"
          trackColor={{ true: P.primary, false: P.border }}
        />
      </View>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  bloc: { gap: 12 },
  carte: { backgroundColor: P.surface, borderRadius: 22, padding: 18, gap: 12 },
  carteBascule: { backgroundColor: P.surface, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  lien: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  lienTexte: { fontSize: 15, fontWeight: '700', color: P.primary, textDecorationLine: 'underline' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  point: { width: 14, height: 14, borderRadius: 7 },
  nom: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: P.textSecondary },
  separateur: { height: 1, backgroundColor: P.border, marginVertical: 4 },
  choix: { gap: 8, paddingBottom: 8 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
