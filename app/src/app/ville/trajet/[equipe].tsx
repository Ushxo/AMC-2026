import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type MapView from 'react-native-maps';
import { Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  NAVIGATION_GOOGLE,
  NavigationGoogle,
  type CibleNavigation,
  type SessionNavigation,
} from '@/components/carte/navigation-google';
import { BarreNavigation } from '@/components/ville/barre-navigation';
import { FeuilleArrets } from '@/components/ville/feuille-arrets';
import { Carte as CarteGoogleOuMaps, Repere as RepereCommun, Trace as TraceCommune, Vehicule as VehiculeCommun, type CarteCommandes } from '@/components/carte';
import { BandeauGuidage } from '@/components/ville/bandeau-guidage';
import { BandeauNavigation } from '@/components/ville/bandeau-navigation';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { CarteCommune } from '@/components/ville/carte-commune';
import { Chargement, Vide } from '@/components/ville/etat-ecran';
import { EtiquetteNeutre } from '@/components/ville/etiquette';
import { MarqueurEgout } from '@/components/ville/marqueur-egout';
import { MarqueurVehicule } from '@/components/ville/marqueur-vehicule';
import { SelecteurCarte } from '@/components/ville/selecteur-carte';
import { COULEUR_ACCENT, COULEUR_ARRET_FAIT, COULEUR_TRACE_ATTENUE, couleurEquipe } from '@/components/ville/style';
import { useEquipes } from '@/hooks/use-equipes';
import { useMonEquipe } from '@/hooks/use-mon-equipe';
import { usePositionSuivie } from '@/hooks/use-position-suivie';
import { usePositionsEquipes } from '@/hooks/use-positions-equipes';
import { useOptimisation } from '@/hooks/use-optimisation';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';
import { useSuiviTrajet } from '@/hooks/use-suivi-trajet';
import { useTheme } from '@/hooks/use-theme';
import { useTournees } from '@/hooks/use-tournees';
import { useTraceTournee } from '@/hooks/use-trace-tournee';
import { useTroncon } from '@/hooks/use-troncon';
import { libelleReste, resteEstime, resumeTotalTournee } from '@/lib/durees';
import { formaterNombre } from '@/lib/format';
import {
  MESSAGE_ARRET_FAIT,
  ETIQUETTE_DEMONSTRATION,
  MESSAGE_ARRET_FAIT_LOCAL,
  MESSAGE_ORDRE_ESTIME,
  MESSAGE_RECALCUL_INDISPONIBLE,
  MESSAGE_SEUL_SUPERVISEUR_OU_EQUIPE,
  MESSAGE_RECALCUL_DEMANDE,
  MESSAGE_POSITION_LOCALE,
  MESSAGE_POSITION_PARTAGEE,
  MESSAGE_TOURNEE_TERMINEE,
  MESSAGE_TRAJET_SANS_POSITION,
} from '@/lib/messages';
import { calculerGuidage, guidageDroit, messageArrivee, projeterSurTrace, type DestinationNommee } from '@/lib/guidage';
import { distanceM } from '@/lib/geo';
import { distanceAuTrace, distanceCourte, dureeCourte } from '@/lib/navigation';
import { chargerRegion } from '@/lib/officiel';
import { proposerRecalcul } from '@/lib/reordre';
import { formaterHeure } from '@/lib/temps';
import { cibleFinTournee, libelleArriveePlan, libelleDepartPlan } from '@/lib/tournees';
import { arretSurPlace, idArret, messageApresRecalcul, peutMarquerFait, peutPublierPosition, regionAutour } from '@/lib/trajet';

const ECART_ROUTE_VALABLE_M = 150;
const NOM_GARAGE: DestinationNommee = { arrivee: 'au garage', direction: 'du garage' };
const NOM_FIN: DestinationNommee = { arrivee: 'à la fin de la tournée', direction: 'de la fin de la tournée' };
const ZOOM_SUIVI = 17; // Google
const ALTITUDE_SUIVI_M = 700; // Apple Plans n'a pas de zoom : on règle l'altitude de la caméra
const INCLINAISON_SUIVI = 55;

export default function Trajet() {
  const { equipe } = useLocalSearchParams<{ equipe: string }>();
  const { bottom } = useSafeAreaInsets();
  const theme = useTheme();
  const { etat } = useSource();
  const { demoHorsLigne, peutGerer } = useSessionEmploye();
  const { lancer: lancerCalcul, enCours: calculEnCours, demande: demandeCalcul } = useOptimisation();
  const { equipes } = useEquipes();
  const { equipeId: monEquipe } = useMonEquipe();
  const suivi = useSuiviTrajet(equipe ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [enSuivi, setEnSuivi] = useState(false);
  const [libre, setLibre] = useState(false);
  const [arrivee, setArrivee] = useState<string | null>(null);
  const [liste, setListe] = useState(false);
  const [navEchec, setNavEchec] = useState<string | null>(null);
  const [recalculDemande, setRecalculDemande] = useState<{ prochainAvant: string | null } | null>(null);
  const { resultat: resultatLu } = useTournees();
  const routeur = useRouter();
  const carteSecours = useRef<CarteCommandes>(null);
  const carte = useRef<MapView>(null);
  const regionParDefaut = useMemo(() => chargerRegion(), []);

  const { tournee, arrets, courant, faits, total, local, estFait, estPartiel } = suivi;
  // Seul le compte de l'équipe publie la position de l'équipe, et seulement une fois le suivi démarré (visible). Un superviseur qui ouvre l'aperçu ne publie rien.
  const [suiviActif, setSuiviActif] = useState(false);
  const compteDeLEquipe = !!tournee && monEquipe === tournee.equipe_id;
  const envoyer = peutPublierPosition({ suiviActif, compteDeLEquipe, local, demoHorsLigne, repli: etat === 'repli' });
  const pos = usePositionSuivie(tournee?.equipe_id ?? null, envoyer);
  const equipeDuTrajet = equipes.find((e) => e?.id === tournee?.equipe_id) ?? null;
  const garage = equipeDuTrajet?.garage ?? null;
  const arriveeEquipe = equipeDuTrajet?.arrivee ?? null;
  const { positions: positionsEquipes } = usePositionsEquipes(peutGerer);
  const majPosition = positionsEquipes.find((p) => p.equipe_id === tournee?.equipe_id)?.maj_le ?? null;
  const trace = useTraceTournee(tournee, equipeDuTrajet);

  // Départ : la position de l'équipe quand le plan part de là, sinon le garage. Fin : pas de retour au garage si la fin est libre ou à un endroit.
  const departPlan = tournee?.depart === 'position' && tournee.depart_position ? tournee.depart_position : garage;
  // Dernière destination : le garage, l'endroit de fin choisi, ou rien (fin libre).
  const finPlan = tournee?.fin ?? 'garage';
  const finCible = tournee ? cibleFinTournee(tournee, garage, arriveeEquipe) : null;
  const cibleFin = finCible?.position ?? null;
  const nomFin = finCible?.nom === 'fin' ? NOM_FIN : NOM_GARAGE;
  // Avant « Démarrer », le tracé et le premier tronçon partent du DÉPART DU PLAN, pas de la position du téléphone.
  const origine = (enSuivi || suiviActif ? pos.position : null) ?? departPlan ?? pos.position;
  const departAffiche = origine ?? arrets[0]?.position ?? null;
  const finie = suivi.terminee;
  const cible = finie ? cibleFin : (courant?.position ?? null);
  // Pas de requête de route tant qu'on n'a ni la position ni le garage : elle ne servirait à rien.
  const troncon = useTroncon(NAVIGATION_GOOGLE ? null : origine, cible, finie ? 'fin' : courant ? idArret(courant) : null);

  const region = useMemo(
    () => regionAutour(trace.length > 0 ? trace : arrets.map((a) => a.position), regionParDefaut),
    [trace, arrets, regionParDefaut],
  );
  const partiel = arrets.find(estPartiel) ?? null;
  const restants = arrets.filter((a) => !estFait(a));
  const rangCourant = courant ? arrets.findIndex((a) => idArret(a) === idArret(courant)) : -1;

  // Vue d'ensemble : la position (ou le garage) et le prochain arrêt dans le cadre.
  const vueEnsemble = useCallback(() => {
    setEnSuivi(false);
    setLibre(false);
    const points = [departAffiche, cible, ...(troncon?.points ?? [])].filter((p): p is NonNullable<typeof p> => !!p);
    if (points.length < 2) return;
    // regionAutour garde une étendue minimale : un arrêt tout près ne fait pas zoomer au niveau d'un trottoir.
    carte.current?.animateCamera({ pitch: 0, heading: 0 }, { duration: 300 });
    carte.current?.animateToRegion(regionAutour(points, regionParDefaut), 500);
  }, [departAffiche, cible, troncon, regionParDefaut]);

  // Guidage de secours (navigation Google impossible) : la carte suit le véhicule.
  useEffect(() => {
    if (navEchec && pos.position) carteSecours.current?.suivre(pos.position, pos.cap);
  }, [navEchec, pos.position, pos.cap]);

  // Mode suivi : caméra centrée sur le véhicule, inclinée, tournée selon le cap.
  useEffect(() => {
    if (!enSuivi || libre || !pos.position) return;
    carte.current?.animateCamera(
      { center: pos.position, pitch: INCLINAISON_SUIVI, heading: pos.cap ?? 0, zoom: ZOOM_SUIVI, altitude: ALTITUDE_SUIVI_M },
      { duration: 800 },
    );
  }, [enSuivi, libre, pos.position, pos.cap]);

  // Nouvel arrêt (après « Arrêt fait » ou précédent/suivant) : on recadre sur le nouveau tronçon.
  const cleCourante = courant ? idArret(courant) : finie ? 'fin' : null;
  useEffect(() => {
    if (enSuivi || !cleCourante) return;
    const t = setTimeout(vueEnsemble, 400);
    return () => clearTimeout(t);
    // Seul un changement d'arrêt recadre : pas chaque mise à jour de la position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleCourante, enSuivi]);

  // Recalcul de l'ordre depuis la position de l'équipe : en ligne, une demande pour cette équipe ; hors ligne, estimation locale.
  const proposerOrdre = !!tournee && !finie && proposerRecalcul(pos.position, restants) && (peutGerer || local || monEquipe === tournee.equipe_id);
  async function recalculer() {
    if (!tournee || !pos.position) return;
    if (etat === 'repli' || local) {
      suivi.reordonnerDepuis(pos.position);
      setMessage(MESSAGE_ORDRE_ESTIME);
      return;
    }
    // La fin de la tournée en cours est renvoyée avec la demande (sinon le service reprendrait « garage »).
    const cleFin =
      finPlan === 'endroit' && tournee.fin_position
        ? (tournee.arrets.find((a) => distanceM(a.position, tournee.fin_position!) < 30)?.cle_endroit ?? null)
        : null;
    const finIncomplete = finPlan === 'endroit' && !cleFin;
    const erreurCalcul = finIncomplete
      ? MESSAGE_RECALCUL_INDISPONIBLE
      : await lancerCalcul({
          equipe_ids: [tournee.equipe_id],
          recalcul: 'tournee', // exigé pour le compte d'une équipe ; garde les arrêts faits en tête
          depart: 'position',
          // La position du TÉLÉPHONE part avec la demande : le service n'a peut-être aucune position fraîche pour l'équipe.
          positions_depart: { [tournee.equipe_id]: { latitude: pos.position.latitude, longitude: pos.position.longitude } },
          // Une adresse d'arrivée se demande par équipe ; les autres fins sont globales.
          ...(finPlan === 'arrivee'
            ? { fin_par_equipe: { [tournee.equipe_id]: 'arrivee' as const } }
            : { fin: finPlan }),
          ...(cleFin ? { fin_cle_endroit: cleFin } : {}),
          date: tournee.debut_prevu.slice(0, 10),
          debut_au_plus_tot: new Date().toISOString(),
          cles_endroits: restants.map((a) => a.cle_endroit),
        });
    if (erreurCalcul) {
      // La base ou le service ne peut pas prendre la demande : on réordonne ici, et on le dit (jamais de message technique).
      suivi.reordonnerDepuis(pos.position);
      setMessage(`${MESSAGE_RECALCUL_INDISPONIBLE} ${MESSAGE_ORDRE_ESTIME}`);
      return;
    }
    setRecalculDemande({ prochainAvant: courant ? idArret(courant) : null });
    setMessage(MESSAGE_RECALCUL_DEMANDE);
  }

  async function faire(id: string) {
    setOccupe(true);
    const r = await suivi.marquerFait(id);
    setOccupe(false);
    setMessage(r ?? (local ? MESSAGE_ARRET_FAIT_LOCAL : MESSAGE_ARRET_FAIT));
  }

  // Distance et durée RESTANTES jusqu'à l'arrêt (la route est celle du départ : on retire ce qui est déjà fait).
  const restant = useMemo(() => {
    if (!troncon) return null;
    if (!pos.position || troncon.droite) return { distance_m: troncon.distance_m, duree_s: troncon.duree_s };
    const r = projeterSurTrace(pos.position, troncon.points).restantM;
    const part = troncon.distance_m > 0 ? Math.min(1, r / troncon.distance_m) : 1;
    return { distance_m: r, duree_s: troncon.duree_s * part };
  }, [troncon, pos.position]);

  const titreBandeau = finie
    ? [MESSAGE_TOURNEE_TERMINEE.replace(/\.$/, ''), restant ? distanceCourte(restant.distance_m) : '', restant ? dureeCourte(restant.duree_s) : '']
        .filter(Boolean)
        .join(' · ')
    : courant
      ? [
          `Arrêt ${rangCourant + 1} sur ${total}`,
          restant ? distanceCourte(restant.distance_m) : '',
          restant ? dureeCourte(restant.duree_s) : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
  // Navigation Google : une destination à la fois, le prochain arrêt puis le garage.
  const cibleNav: CibleNavigation | null = useMemo(() => {
    if (finie) return cibleFin ? { cle: 'fin', numero: 0, titre: finPlan === 'garage' ? 'Garage' : 'Fin de la tournée', position: cibleFin } : null;
    return courant
      ? { cle: idArret(courant), numero: courant.rang, titre: `Arrêt ${courant.rang}`, position: courant.position }
      : null;
  }, [finie, cibleFin, finPlan, courant]);
  const reperesNav = useMemo(
    () =>
      arrets.map((a) => ({
        cle: idArret(a),
        numero: a.rang,
        position: a.position,
        etat: estFait(a) ? ('fait' as const) : courant && idArret(a) === idArret(courant) ? ('prochain' as const) : ('normal' as const),
      })),
    [arrets, estFait, courant],
  );
  const arriveeNav = NAVIGATION_GOOGLE && !!cibleNav && arrivee === cibleNav.cle;

  const arriveeFin = NAVIGATION_GOOGLE && finie && !!cibleFin && arrivee === 'fin';
  const guidage = useMemo(() => {
    if (!pos.position || !cible || (!courant && !finie)) return null;
    const rang = courant?.rang ?? 0;
    const dest = finie ? nomFin : undefined;
    // Une route vieille (autre position de départ) trop loin de la position n'est pas utilisée : simple direction en attendant la nouvelle.
    const routeValable = !!troncon && !troncon.droite && distanceAuTrace(pos.position, troncon.points) < ECART_ROUTE_VALABLE_M;
    return troncon && routeValable
      ? calculerGuidage({ position: pos.position, etapes: troncon.etapes, numeroArret: rang, destination: cible, dest })
      : guidageDroit(pos.position, cible, rang, dest);
  }, [pos.position, cible, courant, finie, troncon, nomFin]);
  const detailBandeau = courant
    ? `${formaterNombre(courant.signalement_ids.length, 'signalement', 'signalements')} · passage prévu à ${formaterHeure(courant.arrivee_prevue)}`
    : null;

  const arriveA = NAVIGATION_GOOGLE ? arriveeNav : guidage?.statut === 'arrive';
  const messageArriveeEcran = arriveeFin ? messageArrivee(0, nomFin) : arriveA && courant ? messageArrivee(courant.rang) : null;
  // Seul un superviseur ou le compte de l'équipe de cette tournée marque un arrêt fait (démonstration : libre).
  const peutMarquer = peutMarquerFait({ peutGerer, compteDeLEquipe, local });
  // Après « Démarrer », le guidage part de la position réelle : on dit à quelle distance elle est du départ prévu.
  const ecartDepartM = suiviActif && faits === 0 && pos.position && departPlan ? distanceM(pos.position, departPlan) : 0;
  const infoDepart = ecartDepartM > 300 ? `Vous êtes à ${distanceCourte(ecartDepartM)} du départ prévu.` : null;
  // Après un recalcul « depuis ma position » : une fois le nouveau plan lu, on dit si le départ est resté au garage et si l'ordre a changé.
  const nouveauPlanLu = !!recalculDemande && demandeCalcul?.statut === 'terminee' && resultatLu?.demande_id === demandeCalcul.id;
  const messageRecalcul =
    nouveauPlanLu && tournee && recalculDemande
      ? messageApresRecalcul({ departRecu: tournee.depart, prochainAvant: recalculDemande.prochainAvant, prochainApres: courant })
      : null;
  const messageAffiche = messageRecalcul ?? message;
  // L'équipe est à un arrêt non fait qui n'est pas le prochain : on propose de le faire maintenant (l'ordre des autres ne change pas).
  const surPlace = !finie && peutMarquer ? arretSurPlace(pos.position, restants, courant) : null;
  const suggestion = surPlace
    ? { texte: `Vous êtes à l'arrêt ${surPlace.rang} : le faire maintenant ?`, titre: `Arrêt ${surPlace.rang} fait`, onPress: () => void faire(idArret(surPlace)) }
    : null;
  const reste = tournee && !finie ? libelleReste(resteEstime(tournee, estFait)) : null;
  const pastille = finie ? 'Tournée terminée' : courant ? `Arrêt ${rangCourant + 1} sur ${total}` : '';

  // Barre d'actions fixe pendant la navigation : « Arrêt fait » (principal à l'arrivée), « Arrêter », liste des arrêts.
  function barre(arreter: () => void) {
    return (
      <BarreNavigation
        pastille={pastille}
        etiquette={demoHorsLigne ? ETIQUETTE_DEMONSTRATION : null}
        arrivee={messageArriveeEcran}
        reste={reste}
        info={infoDepart}
        suggestion={suggestion}
        titreAction={arriveeFin ? 'Terminer' : 'Arrêt fait'}
        occupe={occupe}
        actionActive={arriveeFin || (peutMarquer && !!courant && !estFait(courant))}
        onAction={() => (arriveeFin ? arreter() : courant ? void faire(idArret(courant)) : undefined)}
        onArreter={arreter}
        onListe={() => setListe(true)}
        message={messageAffiche ?? (peutMarquer ? null : MESSAGE_SEUL_SUPERVISEUR_OU_EQUIPE)}
      />
    );
  }

  const demarrageActif = (session?: SessionNavigation) =>
    NAVIGATION_GOOGLE ? !!session && session.etat === 'pret' && !!cibleNav && !session.occupe : !!pos.position;

  // Aperçu : la tournée, la progression, le démarrage. La carte Google (si active) est dessous, plein cadre.
  function apercu(session?: SessionNavigation) {
    return (
      <ThemedView style={styles.fond}>
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
              {titreBandeau ? <BandeauNavigation titre={titreBandeau} detail={detailBandeau} /> : null}
              <ThemedText type="small">{resumeTotalTournee(tournee)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {libelleDepartPlan(tournee, { garage_adresse: equipeDuTrajet?.garage_adresse }, majPosition, 'Départ prévu')}
                {'\n'}
                {libelleArriveePlan(tournee, { garage_adresse: equipeDuTrajet?.garage_adresse, arrivee: equipeDuTrajet?.arrivee, arrivee_adresse: equipeDuTrajet?.arrivee_adresse })}
              </ThemedText>
              <ThemedText type="smallBold" accessibilityLabel={`${faits} arrêts faits sur ${total}`}>
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

              {!NAVIGATION_GOOGLE ? (
                <>
                  <CarteCommune
                    ref={carte}
                    style={styles.carte}
                    initialRegion={region}
                    accessibilityLabel="Carte du trajet de la tournée">
                    {contenuCarte}
                  </CarteCommune>
                  <SelecteurCarte />
                </>
              ) : session ? (
                <>
                  {/* Aperçu du plan (carte de la couche commune) : le tracé, le départ prévu, l'arrivée et les arrêts. */}
                  <CarteGoogleOuMaps
                    style={styles.carte}
                    regionInitiale={region}
                    accessibilityLabel="Carte du plan de la tournée : départ prévu, arrêts et arrivée">
                    {trace.length > 1 ? <TraceCommune id="plan-apercu" points={trace} couleur={COULEUR_ACCENT} epaisseur={4} /> : null}
                    {arrets.map((a) => (
                      <RepereCommun
                        key={idArret(a)}
                        id={`apercu-${idArret(a)}`}
                        position={a.position}
                        couleur={estFait(a) ? COULEUR_ARRET_FAIT : couleurEquipe(0)}
                        etat={estFait(a) ? 'fait' : 'normal'}
                        numero={a.rang}
                        titre={`Arrêt ${a.rang}`}
                        accessibilityLabel={`Arrêt ${a.rang}${estFait(a) ? ', fait' : ''}`}
                      />
                    ))}
                    {departPlan ? (
                      <RepereCommun
                        id="apercu-depart"
                        position={departPlan}
                        couleur={couleurEquipe(0)}
                        etat="prochain"
                        zIndex={4}
                        titre="Départ prévu"
                        description={libelleDepartPlan(tournee, { garage_adresse: equipeDuTrajet?.garage_adresse }, majPosition, 'Départ prévu')}
                        accessibilityLabel="Départ prévu"
                      />
                    ) : null}
                    {cibleFin ? (
                      <RepereCommun
                        id="apercu-arrivee"
                        position={cibleFin}
                        couleur={couleurEquipe(0)}
                        etat="choisi"
                        zIndex={4}
                        titre="Arrivée"
                        description={libelleArriveePlan(tournee, { garage_adresse: equipeDuTrajet?.garage_adresse, arrivee: equipeDuTrajet?.arrivee, arrivee_adresse: equipeDuTrajet?.arrivee_adresse })}
                        accessibilityLabel="Arrivée"
                      />
                    ) : null}
                  </CarteGoogleOuMaps>
                  {session.etat === 'init' ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Préparation de la navigation…
                    </ThemedText>
                  ) : null}
                  {session.etat === 'conditions_refusees' ? (
                    <ThemedText accessibilityRole="alert">
                      La navigation demande d&apos;accepter les conditions d&apos;utilisation de Google. Rouvrez l&apos;écran pour les revoir.
                    </ThemedText>
                  ) : null}
                  {session.message ? <ThemedText accessibilityRole="alert">{session.message}</ThemedText> : null}
                </>
              ) : null}

              {finie ? (
                <EtiquetteNeutre texte={MESSAGE_TOURNEE_TERMINEE} />
              ) : (
                <Bouton
                  pleineLargeur
                  titre={
                    NAVIGATION_GOOGLE
                      ? session?.occupe
                        ? 'Calcul de la route…'
                        : `Démarrer la navigation vers l'arrêt ${courant?.rang ?? ''}`
                      : 'Démarrer le trajet'
                  }
                  actif={demarrageActif(session) && !!courant}
                  onPress={() => {
                    setSuiviActif(true);
                    if (NAVIGATION_GOOGLE) session?.demarrer();
                    else {
                      setEnSuivi(true);
                      setLibre(false);
                    }
                  }}
                />
              )}
              {!NAVIGATION_GOOGLE && !pos.position ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {pos.autorisee === false
                    ? MESSAGE_TRAJET_SANS_POSITION
                    : 'Position de l’appareil en attente. « Démarrer le trajet » s’active dès qu’elle arrive.'}
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {pos.partage === 'envoye' ? MESSAGE_POSITION_PARTAGEE : MESSAGE_POSITION_LOCALE}
              </ThemedText>

              {courant && !finie ? (
                <View style={[styles.carteArret, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold" accessibilityRole="header">
                    {estFait(courant) ? `Arrêt ${courant.rang} (fait)` : `Prochain arrêt : ${courant.rang}`}
                  </ThemedText>
                  <Bouton
                    pleineLargeur
                    titre={occupe ? 'Enregistrement…' : 'Arrêt fait'}
                    variante="discret"
                    occupe={occupe}
                    actif={peutMarquer && !estFait(courant)}
                    onPress={() => void faire(idArret(courant))}
                  />
                  {!peutMarquer ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {MESSAGE_SEUL_SUPERVISEUR_OU_EQUIPE}
                    </ThemedText>
                  ) : null}
                  <View style={styles.rangee}>
                    <Bouton titre="Arrêt précédent" variante="discret" actif={rangCourant > 0} onPress={() => suivi.aller(-1)} />
                    <Bouton
                      titre="Arrêt suivant"
                      variante="discret"
                      actif={rangCourant >= 0 && rangCourant < total - 1}
                      onPress={() => suivi.aller(1)}
                    />
                  </View>
                </View>
              ) : null}

              {proposerOrdre ? (
                <Bouton
                  pleineLargeur
                  titre={calculEnCours ? 'Calcul…' : "Recalculer l'ordre depuis ma position"}
                  variante="discret"
                  actif={!calculEnCours}
                  onPress={() => void recalculer()}
                />
              ) : null}
              {demandeCalcul?.statut === 'echec' && demandeCalcul.message ? (
                <ThemedText accessibilityRole="alert">{demandeCalcul.message}</ThemedText>
              ) : null}
              {suivi.ordreLocal ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {MESSAGE_ORDRE_ESTIME}
                </ThemedText>
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
              {suggestion ? (
                <View accessibilityRole="alert" style={styles.rangee}>
                  <ThemedText type="smallBold">{suggestion.texte}</ThemedText>
                  <Bouton titre={suggestion.titre} variante="discret" actif={!occupe} onPress={suggestion.onPress} />
                </View>
              ) : null}
              {messageAffiche ? <ThemedText accessibilityRole="alert">{messageAffiche}</ThemedText> : null}

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
              {monEquipe && monEquipe !== tournee.equipe_id ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Ce n&apos;est pas la tournée de votre équipe.
                </ThemedText>
              ) : null}
            </>
          )}
        </ScrollView>
      </ThemedView>
    );
  }

  // Éléments de la carte react-native-maps (aperçu et plein écran) : tracé, tronçon, repères numérotés, véhicule.
  const contenuCarte = (
    <>
      {trace.length > 1 ? <Polyline coordinates={trace} strokeColor={COULEUR_TRACE_ATTENUE} strokeWidth={2} /> : null}
      {troncon ? <Polyline coordinates={troncon.points} strokeColor={COULEUR_ACCENT} strokeWidth={6} lineJoin="round" lineCap="round" /> : null}
      {arrets.map((a) => {
        const fait = estFait(a);
        const actuel = courant ? idArret(a) === idArret(courant) && !fait : false;
        const nombre = formaterNombre(a.signalement_ids.length, 'signalement', 'signalements');
        return (
          <MarqueurEgout
            key={idArret(a)}
            coordinate={a.position}
            couleur={fait ? COULEUR_ARRET_FAIT : couleurEquipe(0)}
            etat={fait ? 'fait' : actuel ? 'prochain' : 'normal'}
            numero={a.rang}
            title={`Arrêt ${a.rang}${fait ? ' (fait)' : actuel ? ' (prochain)' : ''}`}
            description={`Passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
            accessibilityLabel={`Arrêt ${a.rang}, ${fait ? 'fait' : actuel ? 'prochain arrêt' : 'à faire'}, ${nombre}, passage prévu à ${formaterHeure(a.arrivee_prevue)}`}
          />
        );
      })}
      {pos.position ? <MarqueurVehicule coordinate={pos.position} cap={pos.cap} title="Votre véhicule" accessibilityLabel="Votre véhicule" /> : null}
    </>
  );

  const feuille = <FeuilleArrets visible={liste} arrets={restants} onFermer={() => setListe(false)} />;

  // Navigation Google impossible (clé refusée, quota, conditions ou position refusées) : notre guidage simplifié, à vol d'oiseau.
  if (NAVIGATION_GOOGLE && navEchec) {
    return (
      <ThemedView style={styles.fond}>
        <View style={styles.fond}>
          <CarteGoogleOuMaps
            style={styles.fond}
            commandes={carteSecours}
            regionInitiale={region}
            positionUtilisateur
            accessibilityLabel="Carte du trajet de la tournée (guidage simplifié)">
            {trace.length > 1 ? <TraceCommune id="trace-secours" points={trace} couleur={COULEUR_TRACE_ATTENUE} epaisseur={3} /> : null}
            {arrets.map((a) => (
              <RepereCommun
                key={idArret(a)}
                id={`arret-${idArret(a)}`}
                position={a.position}
                couleur={estFait(a) ? COULEUR_ARRET_FAIT : couleurEquipe(0)}
                etat={estFait(a) ? 'fait' : courant && idArret(a) === idArret(courant) ? 'prochain' : 'normal'}
                numero={a.rang}
                titre={`Arrêt ${a.rang}`}
                accessibilityLabel={`Arrêt ${a.rang}${estFait(a) ? ', fait' : ''}`}
              />
            ))}
            {pos.position ? <VehiculeCommun id="vehicule-secours" position={pos.position} cap={pos.cap} titre="Votre véhicule" /> : null}
          </CarteGoogleOuMaps>
          <View style={styles.superposition} pointerEvents="box-none">
            <ThemedText accessibilityRole="alert" style={styles.avisSecours}>
              {navEchec} Guidage simplifié : direction à vol d&apos;oiseau.
            </ThemedText>
            {guidage && titreBandeau ? <BandeauGuidage guidage={guidage} resume={titreBandeau} /> : null}
            {!pos.position ? (
              <ThemedText accessibilityRole="alert" style={styles.avisSecours}>
                {pos.autorisee === false ? MESSAGE_TRAJET_SANS_POSITION : 'Position de l’appareil en attente.'}
              </ThemedText>
            ) : null}
          </View>
        </View>
        {barre(() => routeur.back())}
        {feuille}
      </ThemedView>
    );
  }


  if (NAVIGATION_GOOGLE) {
    return (
      <ThemedView style={styles.fond}>
        <NavigationGoogle
          cible={cibleNav}
          onArrivee={setArrivee}
          onIndisponible={setNavEchec}
          reperes={reperesNav}
          apercu={(session) => apercu(session)}
          barre={(session) => barre(() => {
            setSuiviActif(false);
            session.arreter();
          })}
        />
        {feuille}
      </ThemedView>
    );
  }

  // Navigation visuelle (Apple Plans) : carte plein cadre, bandeau de guidage en haut, barre d'actions en bas.
  if (enSuivi) {
    return (
      <ThemedView style={styles.fond}>
        <View style={styles.fond}>
          <CarteCommune
            ref={carte}
            style={styles.fond}
            initialRegion={region}
            onPanDrag={() => setLibre(true)}
            accessibilityLabel="Carte du trajet de la tournée">
            {contenuCarte}
          </CarteCommune>
          {guidage && titreBandeau ? (
            <View style={styles.superposition} pointerEvents="box-none">
              <BandeauGuidage guidage={guidage} resume={titreBandeau} />
            </View>
          ) : null}
          <View style={styles.commandesCarte} pointerEvents="box-none">
            {libre ? <Bouton titre="Recentrer" onPress={() => setLibre(false)} /> : null}
            <Bouton titre="Vue d'ensemble" variante="discret" onPress={vueEnsemble} />
          </View>
        </View>
        {barre(() => {
          setSuiviActif(false);
          setEnSuivi(false);
        })}
        {feuille}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fond}>
      {apercu()}
      {feuille}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: { padding: 16, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
  remplissage: { height: 10, borderRadius: 5 },
  carte: { height: 380 },
  carteArret: { padding: 14, borderRadius: 14, gap: 10 },
  avisSecours: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)', color: '#1A1A1A' },
  superposition: { position: 'absolute', top: 8, left: 8, right: 8 },
  commandesCarte: { position: 'absolute', right: 8, bottom: 8, gap: 8, alignItems: 'flex-end' },
});
