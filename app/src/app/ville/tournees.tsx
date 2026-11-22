import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { useZonesSignalements } from '@/hooks/use-zones-signalements';
import { useEquipes } from '@/hooks/use-equipes';
import { useIncidents } from '@/hooks/use-incidents';
import { useOptimisation } from '@/hooks/use-optimisation';
import { usePositionsEquipes } from '@/hooks/use-positions-equipes';
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
import { resumeToutesEquipes, resumeTotalTournee } from '@/lib/durees';
import { formaterNombre } from '@/lib/format';
import { chargerRegion } from '@/lib/officiel';
import { finIncomplete, OPTIONS_PAR_DEFAUT, parametresDesOptions, type OptionsCalcul as Options } from '@/lib/options-calcul';
import { endroitsOuverts, selectionAEnvoyer } from '@/lib/selection';
import { OptionsCalcul } from '@/components/ville/options-calcul';
import { dateProchainQuart, formaterHeure, formaterKm, libelleJour } from '@/lib/temps';
import {
  estPartiel,
  libelleArriveePlan,
  libelleDepartPlan,
  MESSAGE_POSITION_TROP_ANCIENNE,
  positionTropAncienne,
  resumerGain,
} from '@/lib/tournees';
import { LIBELLES_INCIDENT } from '@/types';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

/** Route classique. */
export default function Tournees() {
  return <EcranTournees />;
}

/** L'écran des tournées ; dans la coquille de l'app (barre d'onglets dessous), la marge du bas est déjà prise par la barre. */
export function EcranTournees({
  dansCoquille = false,
  clesInitiales,
}: {
  dansCoquille?: boolean;
  /** Sélection de départ (venue de « Interventions à planifier »). */
  clesInitiales?: string[];
}) {
  const styles = useStyles(creerStyles);
  const { bottom: bas } = useSafeAreaInsets();
  const bottom = dansCoquille ? 0 : bas;
  const router = useRouter();
  const theme = useTheme();
  const { etat } = useSource();
  const { demoHorsLigne, peutGerer } = useSessionEmploye();
  const { resultat, source, chargement, erreur, rafraichir } = useTournees();
  const { equipes } = useEquipes();
  const { incidents, ajouter, retirer } = useIncidents();
  const { lancer, demande, enCours, basculeSurPrecalcule, message: messageCalcul } = useOptimisation();
  const { positions } = usePositionsEquipes(peutGerer);
  const { endroits, signalements } = useEndroits();
  const zones = useZonesSignalements(signalements);
  const ouverts = useMemo(() => endroitsOuverts(endroits), [endroits]);
  const selection = useSelectionEndroits(ouverts, clesInitiales);
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [equipeActive, setEquipeActive] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>(OPTIONS_PAR_DEFAUT);
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
    const base = { date: prochainQuart(), ...parametresDesOptions(options) };
    return cles ? { ...base, cles_endroits: cles } : base;
  }
  const selectionVide = ouverts.length > 0 && selection.nombre === 0;

  const endroitFin = options.finCle ? ouverts.find((e) => e.cle === options.finCle) : undefined;
  const texteFin = endroitFin ? `${endroitFin.position.latitude.toFixed(4)}, ${endroitFin.position.longitude.toFixed(4)}` : null;

  async function optimiser() {
    if (finIncomplete(options)) {
      setMessage("Choisissez l'endroit de fin en touchant un repère sur la carte, ou changez l'option « Fin ».");
      return;
    }
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
  // Un recalcul d'une seule équipe est partiel : on n'affiche pas le gain du plan complet à partir de cette demande.
  const partiel = resultat ? estPartiel(resultat) : false;
  const gain = resultat && !partiel ? resumerGain(resultat.comparaison) : null;
  const departDemande = demande?.statut === 'terminee' && resultat?.demande_id === demande.id ? demande.parametres.depart : undefined;
  const echecDemande = demande?.statut === 'echec' ? (demande.message ?? MESSAGE_OPTIMISATION_ECHEC) : null;

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={[]}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: peutGerer ? 24 : bottom + 24 }]}>
          <BandeauSource etat={etat} simule={demoHorsLigne} />
          {peutGerer && ouverts.length > 0 ? (
            <View style={styles.carteBlanche}>
            <SelectionEndroits
              endroits={ouverts}
              region={region}
              cles={selection.cles}
              estChoisi={selection.estChoisi}
              choisirGravite={selection.choisirGravite}
              basculer={selection.basculer}
              basculerZoneEndroits={selection.basculerZoneEndroits}
              modeFin={options.finEndroit}
              cleFin={options.finCle}
              onChoisirFin={(cle) => setOptions((o) => ({ ...o, finCle: cle }))}
              toutes={selection.toutes}
              vider={selection.vider}
              zones={zones}
              signalements={signalements}
              onOuvrirSignalement={(id) => router.push({ pathname: '/ville/signalement/[id]', params: { id } })}
            />
            </View>
          ) : null}
          {peutGerer ? (
            <OptionsCalcul options={options} onChanger={setOptions} equipes={equipes} positions={positions} texteFin={texteFin} onGerer={() => router.push('/ville/equipes')} />
          ) : null}
          {peutGerer ? (
            incidents.length === 0 ? (
              <Pressable accessibilityRole="button" onPress={() => void ajouterIncident()} style={styles.lienIncident}>
                <ThemedText style={styles.lienIncidentTexte}>Simuler une rue barrée (démonstration)</ThemedText>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => void retirerIncident()} style={styles.lienIncident}>
                <ThemedText style={styles.lienIncidentTexte}>Retirer l&apos;incident (rue barrée simulée)</ThemedText>
              </Pressable>
            )
          ) : null}

          {!peutGerer ? (
            <ThemedText type="small" themeColor="textSecondary">
              {MESSAGE_ROLE_SUPERVISEUR}
            </ThemedText>
          ) : null}
          {basculeSurPrecalcule && !repli ? (
            <ThemedText accessibilityRole="alert">{MESSAGE_OPTIMISATION_PRECALCULEE}</ThemedText>
          ) : null}
          {echecDemande ? <ThemedText accessibilityRole="alert">{echecDemande}</ThemedText> : null}
          {montrerProgression ? (
            <ThemedText type="smallBold" accessibilityLiveRegion="polite">
              Nouveau calcul en cours : le plan affiché est le plan en place, il sera remplacé à l&apos;arrivée du résultat.
            </ThemedText>
          ) : null}
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
                vehicules={positions}
                onToucherCarte={(c) => setPoint(c)}
              />
              {positions.length > 0 ? (
                <View accessible accessibilityLabel="Positions des équipes">
                  <ThemedText type="smallBold">Positions des équipes</ThemedText>
                  {positions.map((v) => (
                    <ThemedText key={v.equipe_id} type="small">
                      {resultat.tournees.find((t) => t.equipe_id === v.equipe_id)?.equipe_nom ?? 'Équipe'} : mise à jour à{' '}
                      {formaterHeure(v.maj_le)}
                    </ThemedText>
                  ))}
                </View>
              ) : null}
              {!repli && peutGerer ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Pour un incident : touchez la carte à l&apos;endroit voulu, puis « Ajouter un incident simulé ».
                </ThemedText>
              ) : null}

              <ThemedText type="smallBold" accessibilityRole="header">
                Équipes
              </ThemedText>
              <ThemedText type="small">{resumeToutesEquipes(resultat.tournees, resultat.totaux)}</ThemedText>
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
                    accessibilityLabel={`${t.equipe_nom} : ${t.arrets.length} arrêts, ${formaterKm(t.distance_m)}, de ${formaterHeure(t.debut_prevu)} à ${formaterHeure(t.fin_prevue)}. ${resumeTotalTournee(t)}`}>
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
                    {t.arrets.length === 0 ? (
                      <ThemedText type="small" accessibilityRole="alert">
                        Aucun arrêt pour cette équipe dans ce plan.
                      </ThemedText>
                    ) : (
                      <ThemedText type="small">{resumeTotalTournee(t)}</ThemedText>
                    )}
                    <ThemedText type="small" themeColor="textSecondary">
                      {libelleDepartPlan(t, equipes.find((q) => q?.id === t.equipe_id), positions.find((q) => q.equipe_id === t.equipe_id)?.maj_le)}
                      {'\n'}
                      {libelleArriveePlan(t, equipes.find((q) => q?.id === t.equipe_id))}
                    </ThemedText>
                    {positionTropAncienne(departDemande, t) ? (
                      <ThemedText type="small" accessibilityRole="alert">
                        {MESSAGE_POSITION_TROP_ANCIENNE}
                      </ThemedText>
                    ) : null}
                    {t.recalculee ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Recalculé depuis la position de l&apos;équipe : {t.faits_conserves ?? 0} arrêts déjà faits gardés en tête.
                      </ThemedText>
                    ) : null}
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

              {partiel ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Recalcul d&apos;une seule équipe : le gain du plan complet n&apos;est pas recalculé à partir de cette demande.
                </ThemedText>
              ) : null}
              {gain ? (
                <View style={styles.carteBlanche}>
                  <ThemedText style={{ fontSize: 17, lineHeight: 24, fontWeight: '700' }} accessibilityRole="header">
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${resultat ? 'Relancer le calcul' : 'Calculer le trajet optimal'} pour ${formaterNombre(selection.nombre, 'endroit', 'endroits')}`}
              accessibilityState={{ disabled: selectionVide || enCours, busy: enCours }}
              disabled={selectionVide || enCours}
              onPress={() => void optimiser()}
              style={[styles.relancer, (selectionVide || enCours) && { opacity: 0.5 }]}>
              <ThemedText style={styles.relancerTexte} maxFontSizeMultiplier={1.2}>
                {enCours ? 'Calcul…' : resultat ? 'Relancer le calcul' : 'Calculer le trajet optimal'}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  barre: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carteEquipe: { padding: 14, borderRadius: 14, gap: 6 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastille: { width: 16, height: 16, borderRadius: 8 },
  carteBlanche: { backgroundColor: P.surface, borderRadius: 22, padding: 18, gap: 10 },
  lienIncident: { minHeight: 48, justifyContent: 'center' },
  lienIncidentTexte: { fontSize: 15, fontWeight: '700', color: P.primary, textDecorationLine: 'underline' },
  relancer: { height: 60, borderRadius: 30, backgroundColor: P.action, alignItems: 'center', justifyContent: 'center' },
  relancerTexte: { color: P.onAction, fontSize: 19, lineHeight: 26, fontWeight: '700' },
});
