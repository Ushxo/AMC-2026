import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { BarreProgression } from '@/components/ville/barre-progression';
import { Bouton } from '@/components/ville/bouton';
import { CarteTournees } from '@/components/ville/carte-tournees';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteNeutre } from '@/components/ville/etiquette';
import { SelectionEndroits } from '@/components/ville/selection-endroits';
import { couleurEquipe } from '@/components/ville/style';
import { useEndroits } from '@/hooks/use-endroits';
import { useEquipes } from '@/hooks/use-equipes';
import { useIncidents } from '@/hooks/use-incidents';
import { useOptimisation } from '@/hooks/use-optimisation';
import { useProgressionOptimisation } from '@/hooks/use-progression-optimisation';
import { useSelectionEndroits } from '@/hooks/use-selection-endroits';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { useTheme } from '@/hooks/use-theme';
import { useTournees } from '@/hooks/use-tournees';
import {
  MESSAGE_AUCUNE_TOURNEE,
  MESSAGE_HYPOTHESES_DEMO,
  MESSAGE_INCIDENT_SIMULE,
  MESSAGE_OPTIMISATION_ECHEC,
  MESSAGE_OPTIMISATION_EN_COURS,
  MESSAGE_OPTIMISATION_PRECALCULEE,
  MESSAGE_PRECALCULE_TOUS_ENDROITS,
  MESSAGE_SELECTION_CHIFFRES,
  MESSAGE_SELECTION_VIDE,
  MESSAGE_PRECALCULE_AVEC_INCIDENT,
  MESSAGE_REGLE_COMPARAISON,
  MESSAGE_REOPTIMISER,
  MESSAGE_ROLE_SUPERVISEUR,
  MESSAGE_RESULTAT_PRECALCULE,
} from '@/lib/messages';
import { formaterNombre } from '@/lib/format';
import { chargerRegion } from '@/lib/officiel';
import { endroitsOuverts, selectionAEnvoyer } from '@/lib/selection';
import { dateProchainQuart, formaterHeure, formaterKm, libelleJour } from '@/lib/temps';
import { resumerGain } from '@/lib/tournees';
import { LIBELLES_INCIDENT } from '@/types';

export default function Tournees() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const { etat } = useSource();
  const { demoHorsLigne, peutGerer } = useSessionEmploye();
  const { resultat, source, chargement, erreur, rafraichir } = useTournees();
  const { equipes } = useEquipes();
  const { incidents, ajouter, retirer } = useIncidents();
  const { lancer, demande, enCours, basculeSurPrecalcule, message: messageCalcul } = useOptimisation();
  const { endroits } = useEndroits();
  const ouverts = useMemo(() => endroitsOuverts(endroits), [endroits]);
  const selection = useSelectionEndroits(ouverts);
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [equipeActive, setEquipeActive] = useState<string | null>(null);
  const region = useMemo(() => chargerRegion(), []);
  const repli = etat === 'repli';

  // On planifie toujours le PROCHAIN quart : une réoptimisation ne tombe jamais dans le passé.
  function prochainQuart() {
    return dateProchainQuart(
      Date.now(),
      equipes.filter((e) => e.active).map((e) => e.debut_quart),
    );
  }

  // La sélection part avec chaque calcul ; absente quand tout est choisi (= tous les endroits ouverts).
  function parametresCalcul() {
    const cles = selectionAEnvoyer(selection.cles, ouverts);
    return cles ? { date: prochainQuart(), cles_endroits: cles } : { date: prochainQuart() };
  }
  const selectionVide = ouverts.length > 0 && selection.nombre === 0;

  async function optimiser() {
    if (selectionVide) {
      setMessage(MESSAGE_SELECTION_VIDE);
      return;
    }
    setMessage(await lancer(parametresCalcul()));
  }

  async function ajouterIncident() {
    if (!repli && !point) {
      setMessage("Touchez la carte pour placer l'incident.");
      return;
    }
    const erreurAjout = await ajouter({ type: 'rue_fermee', position: point ?? region });
    if (erreurAjout) {
      setMessage(erreurAjout);
      return;
    }
    setPoint(null);
    setMessage(MESSAGE_REOPTIMISER);
    if (!repli) await lancer(parametresCalcul()); // réoptimisation tout de suite, avec l'incident
  }

  async function retirerIncident() {
    const incident = incidents[0];
    if (!incident) return; // déjà retiré (double appui)
    const erreurRetrait = await retirer(incident.id);
    if (erreurRetrait) {
      setMessage(erreurRetrait);
      return;
    }
    setMessage(null);
    if (!repli) await lancer(parametresCalcul()); // retirer relance un calcul, comme l'ajout
  }

  const tracesEnAttente =
    source === 'direct' &&
    demande?.statut === 'terminee' &&
    resultat?.demande_id === demande.id &&
    resultat.tournees.some((t) => !t.geometrie);
  const progression = useProgressionOptimisation(demande, { envoi: enCours && !demande, tracesEnAttente });
  const montrerProgression = (enCours && !basculeSurPrecalcule) || tracesEnAttente;
  const selectionPartielle = (demande?.parametres.cles_endroits?.length ?? 0) > 0;
  const gain = resultat ? resumerGain(resultat.comparaison) : null;
  const echecDemande = demande?.statut === 'echec' ? (demande.message ?? MESSAGE_OPTIMISATION_ECHEC) : null;

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: peutGerer ? 24 : bottom + 24 }]}>
          <BandeauSource etat={etat} simule={demoHorsLigne} />
          {peutGerer && ouverts.length > 0 ? (
            <SelectionEndroits
              endroits={ouverts}
              region={region}
              cles={selection.cles}
              estChoisi={selection.estChoisi}
              choisirGravite={selection.choisirGravite}
              basculer={selection.basculer}
              toutes={selection.toutes}
              vider={selection.vider}
            />
          ) : null}
          <View style={styles.rangee}>
            {peutGerer ? (
              <>
                {incidents.length === 0 ? (
                  <Bouton titre="Ajouter un incident simulé" variante="discret" onPress={() => void ajouterIncident()} />
                ) : (
                  <Bouton titre="Retirer l'incident" variante="discret" onPress={() => void retirerIncident()} />
                )}
              </>
            ) : null}
            <Bouton titre="Équipes" variante="discret" onPress={() => router.push('/ville/equipes')} />
          </View>

          {!peutGerer ? (
            <ThemedText type="small" themeColor="textSecondary">
              {MESSAGE_ROLE_SUPERVISEUR}
            </ThemedText>
          ) : null}
          {basculeSurPrecalcule && !repli ? (
            <ThemedText accessibilityRole="alert">{MESSAGE_OPTIMISATION_PRECALCULEE}</ThemedText>
          ) : null}
          {echecDemande ? <ThemedText accessibilityRole="alert">{echecDemande}</ThemedText> : null}
          {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}
          {messageCalcul ? <ThemedText accessibilityRole="alert">{messageCalcul}</ThemedText> : null}
          {(resultat?.incidents ?? []).filter(Boolean).map((i) => (
            <ThemedText key={i.id} type="smallBold">
              {LIBELLES_INCIDENT[i.type]} : {MESSAGE_INCIDENT_SIMULE}
            </ThemedText>
          ))}

          {chargement ? (
            <Chargement texte="Chargement des tournées…" />
          ) : erreur ? (
            <Erreur message={erreur} onReessayer={() => void rafraichir()} />
          ) : !resultat ? (
            <Vide texte={MESSAGE_AUCUNE_TOURNEE} />
          ) : (
            <>
              {resultat.tournees[0] ? (
                <ThemedText type="smallBold" accessibilityRole="header">
                  Tournées du {libelleJour(resultat.tournees[0].debut_prevu)}
                </ThemedText>
              ) : null}
              {source === 'precalcule' ? <EtiquetteNeutre texte={MESSAGE_PRECALCULE_TOUS_ENDROITS} /> : null}
              {source === 'precalcule' ? (
                <EtiquetteNeutre
                  texte={resultat.incidents.length > 0 ? MESSAGE_PRECALCULE_AVEC_INCIDENT : MESSAGE_RESULTAT_PRECALCULE}
                />
              ) : null}
              <CarteTournees
                resultat={resultat}
                equipes={equipes}
                region={region}
                choisi={point}
                equipeActive={equipeActive}
                onToucherCarte={(e) => setPoint(e.nativeEvent.coordinate)}
              />
              {!repli && peutGerer ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Pour un incident : touchez la carte à l&apos;endroit voulu, puis « Ajouter un incident simulé ».
                </ThemedText>
              ) : null}

              <ThemedText type="smallBold" accessibilityRole="header">
                Équipes
              </ThemedText>
              <View style={styles.rangee}>
                <Bouton
                  titre="Toutes"
                  variante="discret"
                  selectionne={equipeActive === null}
                  onPress={() => setEquipeActive(null)}
                />
              </View>
              {resultat.tournees.map((t, i) => (
                <View key={t.equipe_id} style={[styles.carteEquipe, { backgroundColor: theme.backgroundElement }]}>
                  <View
                    accessible
                    accessibilityLabel={`${t.equipe_nom} : ${t.arrets.length} arrêts, ${formaterKm(t.distance_m)}, de ${formaterHeure(t.debut_prevu)} à ${formaterHeure(t.fin_prevue)}`}>
                    <View style={styles.entete}>
                      <View
                        style={[styles.pastille, { backgroundColor: couleurEquipe(i) }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                      <ThemedText type="smallBold">{t.equipe_nom}</ThemedText>
                    </View>
                    <ThemedText type="small">
                      {t.arrets.length} arrêts, {formaterKm(t.distance_m)}, de {formaterHeure(t.debut_prevu)} à{' '}
                      {formaterHeure(t.fin_prevue)}
                    </ThemedText>
                  </View>
                  <Bouton
                    titre={equipeActive === t.equipe_id ? 'Voir toutes les équipes' : 'Voir ses arrêts'}
                    variante="discret"
                    onPress={() => setEquipeActive(equipeActive === t.equipe_id ? null : t.equipe_id)}
                  />
                  {peutGerer ? (
                    <Bouton
                      titre="Suivre ce trajet"
                      variante="discret"
                      onPress={() => router.push({ pathname: '/ville/trajet/[equipe]', params: { equipe: t.equipe_id } })}
                    />
                  ) : null}
                  {equipeActive === t.equipe_id
                    ? t.arrets.map((a) => (
                        <ThemedText key={a.rang} type="small">
                          {a.rang}. {formaterHeure(a.arrivee_prevue)} · {a.signalement_ids.length} signalement
                          {a.signalement_ids.length > 1 ? 's' : ''}
                        </ThemedText>
                      ))
                    : null}
                </View>
              ))}

              {gain ? (
                <View style={[styles.carteEquipe, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold" accessibilityRole="header">
                    Gain à travail égal
                  </ThemedText>
                  {gain.egal.map((l) => (
                    <ThemedText key={l.etiquette}>
                      {l.etiquette} : {l.valeur}
                    </ThemedText>
                  ))}
                  <ThemedText>{gain.dansLeQuart}</ThemedText>
                  {selectionPartielle && source === 'direct' ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {MESSAGE_SELECTION_CHIFFRES}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {MESSAGE_REGLE_COMPARAISON}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {MESSAGE_HYPOTHESES_DEMO}
                  </ThemedText>
                </View>
              ) : null}
              {resultat.non_servis.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {resultat.non_servis.length} endroits non servis dans le quart (les moins graves en premier).
                </ThemedText>
              ) : null}
            </>
          )}
        </ScrollView>
        {peutGerer ? (
          <View
            style={[
              styles.barre,
              { paddingBottom: 12 + bottom, backgroundColor: theme.background, borderTopColor: theme.backgroundSelected },
            ]}>
          {peutGerer && selectionVide ? (
            <ThemedText type="small" themeColor="textSecondary">
              {MESSAGE_SELECTION_VIDE}
            </ThemedText>
          ) : null}
          {montrerProgression ? (
            <>
              <ThemedText accessibilityLiveRegion="polite">{MESSAGE_OPTIMISATION_EN_COURS}</ThemedText>
              <BarreProgression etape={progression.etape} fraction={progression.fraction} />
            </>
          ) : null}
            <Bouton
              pleineLargeur
              titre={
                enCours
                  ? 'Calcul…'
                  : ouverts.length > 0
                    ? `Optimiser (${formaterNombre(selection.nombre, 'endroit', 'endroits')})`
                    : 'Optimiser'
              }
              onPress={() => void optimiser()}
              actif={!enCours && !selectionVide}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  barre: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carteEquipe: { padding: 14, borderRadius: 14, gap: 6 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastille: { width: 16, height: 16, borderRadius: 8 },
});
