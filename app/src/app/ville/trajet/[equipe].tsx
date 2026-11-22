import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Polyline } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { CarteCommune } from '@/components/ville/carte-commune';
import { MarqueurEgout } from '@/components/ville/marqueur-egout';
import { Chargement, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteNeutre } from '@/components/ville/etiquette';
import { COULEUR_ARRET_FAIT, couleurEquipe, COULEUR_ACCENT } from '@/components/ville/style';
import { useEquipes } from '@/hooks/use-equipes';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { useSuiviTrajet } from '@/hooks/use-suivi-trajet';
import { useTheme } from '@/hooks/use-theme';
import {
  MESSAGE_ARRET_FAIT,
  MESSAGE_ARRET_FAIT_LOCAL,
  MESSAGE_TOURNEE_TERMINEE,
  MESSAGE_TRAJET_SANS_GUIDAGE,
} from '@/lib/messages';
import { chargerRegion } from '@/lib/officiel';
import { formaterHeure } from '@/lib/temps';
import { idArret, regionAutour } from '@/lib/trajet';
import { pointsTournee } from '@/lib/tournees';
import { formaterNombre } from '@/lib/format';

export default function Trajet() {
  const { equipe } = useLocalSearchParams<{ equipe: string }>();
  const { bottom } = useSafeAreaInsets();
  const theme = useTheme();
  const { etat } = useSource();
  const { demoHorsLigne } = useSessionEmploye();
  const { equipes } = useEquipes();
  const suivi = useSuiviTrajet(equipe ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const regionParDefaut = useMemo(() => chargerRegion(), []);

  const { tournee, arrets, courant, faits, total, position, local, estFait, estPartiel } = suivi;
  const garage = equipes.find((e) => e?.id === tournee?.equipe_id)?.garage ?? null;
  const trace = useMemo(() => (tournee ? pointsTournee(tournee, garage) : []), [tournee, garage]);
  const region = useMemo(
    () => regionAutour(trace.length > 0 ? trace : arrets.map((a) => a.position), regionParDefaut),
    [trace, arrets, regionParDefaut],
  );
  const partiel = arrets.find(estPartiel) ?? null;
  const restants = arrets.filter((a) => !estFait(a));
  const rangCourant = courant ? arrets.findIndex((a) => idArret(a) === idArret(courant)) : -1;

  async function faire(id: string) {
    setOccupe(true);
    const r = await suivi.marquerFait(id);
    setOccupe(false);
    setMessage(r ?? (local ? MESSAGE_ARRET_FAIT_LOCAL : MESSAGE_ARRET_FAIT));
  }

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}>
          <BandeauSource etat={etat} simule={demoHorsLigne} />
          {suivi.chargement && !tournee ? (
            <Chargement texte="Chargement de la tournée…" />
          ) : !tournee ? (
            <Vide texte="Aucune tournée pour cette équipe." />
          ) : (
            <>
              <ThemedText type="subtitle" accessibilityRole="header">
                {tournee.equipe_nom}
              </ThemedText>
              <ThemedText
                type="smallBold"
                accessibilityLabel={`${faits} arrêts faits sur ${total}`}>
                {faits} sur {total} arrêts faits
              </ThemedText>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Arrêts faits"
                accessibilityValue={{ min: 0, max: total, now: faits }}
                style={[styles.piste, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.remplissage,
                    { width: `${total > 0 ? Math.round((faits / total) * 100) : 0}%`, backgroundColor: COULEUR_ACCENT },
                  ]}
                />
              </View>

              <CarteCommune
                style={styles.carte}
                initialRegion={region}
                showsUserLocation
                accessibilityLabel="Carte du trajet de la tournée">
                <Polyline coordinates={trace} strokeColor={couleurEquipe(0)} strokeWidth={4} />
                {arrets.map((a) => {
                  const fait = estFait(a);
                  const actuel = courant ? idArret(a) === idArret(courant) : false;
                  return (
                    <MarqueurEgout
                      key={idArret(a)}
                      coordinate={a.position}
                      couleur={fait ? COULEUR_ARRET_FAIT : couleurEquipe(0)}
                      etat={fait ? 'fait' : actuel ? 'prochain' : 'normal'}
                      title={`Arrêt ${a.rang}${fait ? ' (fait)' : actuel ? ' (prochain)' : ''}`}
                      description={`Passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
                      accessibilityLabel={`Arrêt ${a.rang}, ${fait ? 'fait' : actuel ? 'à faire maintenant' : 'à faire'}, passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
                    />
                  );
                })}
              </CarteCommune>
              {position ? null : (
                <ThemedText type="small" themeColor="textSecondary">
                  Position de l&apos;appareil indisponible pour le moment.
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {MESSAGE_TRAJET_SANS_GUIDAGE}
              </ThemedText>

              {suivi.terminee ? (
                <EtiquetteNeutre texte={MESSAGE_TOURNEE_TERMINEE} />
              ) : courant ? (
                <View style={[styles.carteArret, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold" accessibilityRole="header">
                    {estFait(courant) ? `Arrêt ${courant.rang} (fait)` : `Prochain arrêt : ${courant.rang}`}
                  </ThemedText>
                  <ThemedText>
                    Passage prévu à {formaterHeure(courant.arrivee_prevue)} ·{' '}
                    {formaterNombre(courant.signalement_ids.length, 'signalement', 'signalements')}
                  </ThemedText>
                  <Bouton
                    pleineLargeur
                    titre={occupe ? 'Enregistrement…' : 'Arrêt fait'}
                    actif={!occupe && !estFait(courant)}
                    onPress={() => void faire(idArret(courant))}
                  />
                  <View style={styles.rangee}>
                    <Bouton
                      titre="Arrêt précédent"
                      variante="discret"
                      actif={rangCourant > 0}
                      onPress={() => suivi.aller(-1)}
                    />
                    <Bouton
                      titre="Arrêt suivant"
                      variante="discret"
                      actif={rangCourant >= 0 && rangCourant < total - 1}
                      onPress={() => suivi.aller(1)}
                    />
                  </View>
                </View>
              ) : null}

              {partiel ? (
                <View accessibilityRole="alert" style={styles.rangee}>
                  <Bouton
                    titre={`Réessayer l'arrêt ${partiel.rang}`}
                    variante="discret"
                    actif={!occupe}
                    onPress={() => void faire(idArret(partiel))}
                  />
                </View>
              ) : null}
              {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}

              <ThemedText type="smallBold" accessibilityRole="header">
                Arrêts restants ({restants.length})
              </ThemedText>
              {restants.map((a) => (
                <ThemedText
                  key={idArret(a)}
                  type="small"
                  accessibilityLabel={`Arrêt ${a.rang}, passage prévu à ${formaterHeure(a.arrivee_prevue)}, ${formaterNombre(a.signalement_ids.length, 'signalement', 'signalements')}`}>
                  {a.rang}. {formaterHeure(a.arrivee_prevue)} ·{' '}
                  {formaterNombre(a.signalement_ids.length, 'signalement', 'signalements')}
                </ThemedText>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
  remplissage: { height: 10, borderRadius: 5 },
  carte: { height: 300 },
  carteArret: { padding: 14, borderRadius: 14, gap: 10 },
});
