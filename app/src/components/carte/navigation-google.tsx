import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type * as Nav from '@googlemaps/react-native-navigation-sdk';

import { useJetonsNavigation } from '@/hooks/use-jetons-navigation';
import { useThemeCarte } from '@/hooks/use-theme-carte';
import { assombrir } from '@/marque/couleurs';
import { essayerLancer, type EtatLancement } from '@/lib/lancer-navigation';
import { choisirIdCarte, envCarte } from '@/lib/carte-reglages';
import { nomImageRepere } from '@/lib/images-reperes';
import type { Coordonnees } from '@/types';

import { NAVIGATION_GOOGLE } from './reglage';

export { NAVIGATION_GOOGLE };

/** Chargement tardif : un import statique ferait planter les builds et Expo Go qui n'ont pas le module natif. */
function biblio(): typeof Nav {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@googlemaps/react-native-navigation-sdk');
}

export type CibleNavigation = {
  /** Identifiant stable de la destination (arrêt ou garage). */
  cle: string;
  numero: number;
  titre: string;
  position: Coordonnees;
};

/** Repère d'arrêt dessiné sur la vue de navigation (numéro, état). */
export type RepereNavigation = { cle: string; numero: number; position: Coordonnees; etat: 'normal' | 'prochain' | 'fait' | 'attenue' };

const COULEUR_ARRETS = '#0072B2';

type Props = {
  /** Nos repères numérotés, posés sur la carte de navigation. */
  reperes?: RepereNavigation[];
  /** Une destination à la fois : le prochain arrêt, puis le garage. Null = rien à rejoindre. */
  cible: CibleNavigation | null;
  onArrivee: (cle: string) => void;
  /** Appelé quand la navigation Google ne peut pas servir (clé refusée, quota, conditions refusées, position refusée) : l'écran bascule sur notre guidage. */
  onIndisponible?: (message: string) => void;
  /** Écran d'aperçu, posé par-dessus la carte tant que la navigation n'a pas démarré. */
  apercu: (session: SessionNavigation) => ReactNode;
  /** Barre d'actions fixe sous la carte pendant la navigation (la carte de Google reste entière au-dessus). */
  barre: (session: SessionNavigation) => ReactNode;
  /** Vrai seulement quand l'écran est une route plein écran (sans en-tête) : le bord haut prend alors la couleur du bandeau de manœuvre. */
  pleinEcran?: boolean;
};

/** Ce que l'écran peut lire et commander pendant la session de navigation. */
export type SessionNavigation = {
  etat: 'init' | 'conditions_refusees' | 'indisponible' | 'pret' | 'guidage';
  message: string | null;
  occupe: boolean;
  enGuidage: boolean;
  /** Temps et distance restants jusqu'au prochain arrêt, donnés par Google pendant le guidage (null avant la première mesure). */
  restant: { secondes: number; metres: number } | null;
  /** Demande l'itinéraire vers la destination et lance le guidage (une destination demandée). */
  demarrer: () => void;
  arreter: () => void;
  /** Remet la caméra à la suite du véhicule (le bouton de Google peut se cacher derrière notre panneau). */
  recentrer: () => void;
};

type Etat = SessionNavigation['etat'];

const MESSAGES_ROUTE: Record<string, string> = {
  NO_ROUTE_FOUND: "Aucune route n'a été trouvée vers cet arrêt.",
  NETWORK_ERROR: 'Le réseau ne répond pas : la route ne peut pas être calculée.',
  QUOTA_CHECK_FAILED: 'Le service de navigation est indisponible pour le moment.',
  LOCATION_DISABLED: "La position de l'appareil est désactivée.",
  LOCATION_UNKNOWN: "La position de l'appareil n'est pas encore connue. Réessayez dans un instant.",
};

const MESSAGES_SESSION: Record<string, string> = {
  notAuthorized: "Le service de navigation n'est pas autorisé pour cette clé.",
  termsNotAccepted: "Les conditions d'utilisation de la navigation n'ont pas été acceptées.",
  networkError: 'Le réseau ne répond pas : la navigation ne peut pas démarrer.',
  locationPermissionMissing: "La position de l'appareil n'est pas autorisée.",
};

function Interieur({ cible, onArrivee, onIndisponible, reperes = [], apercu, barre, pleinEcran = false }: Props) {
  const nav = biblio();
  const theme = useThemeCarte();
  const { navigationController, removeAllListeners, setOnArrival, setOnLocationChanged, setOnRemainingTimeOrDistanceChanged } = nav.useNavigation();
  const J = useJetonsNavigation();
  const { top } = useSafeAreaInsets();
  const [restant, setRestant] = useState<{ secondes: number; metres: number } | null>(null);
  const [hauteurPanneau, setHauteurPanneau] = useState(0);
  const vueNavigation = useRef<Nav.NavigationViewController | null>(null);
  const [etat, setEtat] = useState<Etat>('init');
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [carte, setCarte] = useState<Nav.MapViewController | null>(null);
  const [cartePrete, setCartePrete] = useState(false);
  const posees = useRef(new Set<string>());
  const position = useRef(false); // vrai dès qu'une position valide est arrivée
  const enNavigation = useRef(false);
  const aRelancer = useRef(false);
  const etatLancement = useRef<EtatLancement>({ verrou: false, derniere: null }); // verrou + dernière destination démarrée
  const cibleRef = useRef(cible);
  const onArriveeRef = useRef(onArrivee);

  useEffect(() => {
    cibleRef.current = cible;
    onArriveeRef.current = onArrivee;
  }, [cible, onArrivee]);

  // Navigation Google impossible : on prévient l'écran, qui montre notre guidage à la place.
  useEffect(() => {
    if (etat === 'indisponible' || etat === 'conditions_refusees') {
      onIndisponible?.(message ?? MESSAGES_SESSION.termsNotAccepted);
    }
  }, [etat, message, onIndisponible]);

  // Écouteurs : arrivée à la destination, première position.
  useEffect(() => {
    setOnLocationChanged(() => {
      position.current = true;
    });
    setOnArrival(() => {
      const c = cibleRef.current;
      if (c) onArriveeRef.current(c.cle);
    });
    // Temps et distance jusqu'au prochain arrêt : c'est notre panneau qui les affiche (le pied de Google est masqué).
    setOnRemainingTimeOrDistanceChanged((t) => setRestant({ secondes: t.seconds, metres: t.meters }));
    return () => removeAllListeners();
  }, [setOnArrival, setOnLocationChanged, setOnRemainingTimeOrDistanceChanged, removeAllListeners]);

  // Initialisation : position, conditions d'utilisation de Google, session, voix coupée.
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const droit = await Location.requestForegroundPermissionsAsync();
        if (!droit.granted) {
          if (vivant) {
            setEtat('indisponible');
            setMessage(MESSAGES_SESSION.locationPermissionMissing);
          }
          return;
        }
        const acceptees = await navigationController.showTermsAndConditionsDialog();
        if (!vivant) return;
        if (!acceptees) {
          setEtat('conditions_refusees');
          return;
        }
        const statut = await navigationController.init();
        if (!vivant) return;
        if (statut !== nav.NavigationSessionStatus.OK) {
          setEtat('indisponible');
          setMessage(MESSAGES_SESSION[String(statut)] ?? 'La navigation ne peut pas démarrer.');
          return;
        }
        // Le propriétaire ne veut pas de guidage vocal.
        await navigationController.setAudioGuidanceSettings({
          guidanceMode: nav.AudioGuidanceMode.SILENT,
          vibrationEnabled: false,
          bluetoothAudioEnabled: false,
        });
        navigationController.setBackgroundLocationUpdatesEnabled(false);
        if (vivant) setEtat('pret');
      } catch {
        if (vivant) {
          setEtat('indisponible');
          setMessage('La navigation ne peut pas démarrer.');
        }
      }
    })();
    return () => {
      vivant = false;
      void navigationController.stopGuidance().catch(() => {});
      void navigationController.cleanup().catch(() => {});
    };
    // Une seule initialisation par écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Une destination à la fois (chaque destination demandée compte dans la facturation Google : pas de répétition).
   * Un verrou couvre la demande ; la destination n'est retenue qu'après un démarrage réussi, donc un échec laisse « Démarrer » utilisable.
   */
  const lancer = useCallback(
    async (c: CibleNavigation) => {
      if (etatLancement.current.derniere === c.cle || etatLancement.current.verrou) return;
      setOccupe(true);
      setMessage(null);
      let messageRoute: string | null = null;
      const resultat = await essayerLancer(etatLancement.current, c.cle, {
        definirRoute: async () => {
          const statut = await navigationController.setDestination(
            { title: c.titre, position: { lat: c.position.latitude, lng: c.position.longitude } },
            {
              routingOptions: { travelMode: nav.TravelMode.DRIVING },
              // Nos repères numérotés remplacent les repères de destination de Google.
              displayOptions: { showDestinationMarkers: false },
            },
          );
          if (statut === nav.RouteStatus.OK) return true;
          if (String(statut) === 'QUOTA_CHECK_FAILED') setEtat('indisponible'); // quota ou clé : notre guidage prend le relais
          messageRoute = MESSAGES_ROUTE[String(statut)] ?? 'La route ne peut pas être calculée.';
          return false;
        },
        demarrer: () => navigationController.startGuidance(),
      });
      if (resultat === 'ok') {
        enNavigation.current = true;
        setEtat('guidage');
      } else if (resultat === 'route') setMessage(messageRoute);
      else if (resultat === 'echec') setMessage('La navigation ne peut pas démarrer. Réessayez.');
      setOccupe(false);
      // L'arrêt a changé pendant la demande : on rejoint la destination actuelle.
      const actuelle = cibleRef.current;
      if (resultat !== 'ignore' && enNavigation.current && actuelle && actuelle.cle !== c.cle) aRelancer.current = true;
    },
    [navigationController, nav],
  );
  // Une fois le verrou libéré, on rejoint la destination demandée entre-temps (une seule fois, pas de boucle).
  useEffect(() => {
    if (occupe || !aRelancer.current) return;
    aRelancer.current = false;
    const c = cibleRef.current;
    if (c) void lancer(c);
  }, [occupe, lancer]);

  // « Arrêt fait » change la destination : on passe tout de suite à la suivante, ou on arrête à la fin.
  const cleCible = cible?.cle ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestant(null); // la mesure du nouvel arrêt arrive avec le nouvel itinéraire
    if (!enNavigation.current) return;
    const c = cibleRef.current;
    const t = setTimeout(() => {
      if (c) void lancer(c);
      else {
        enNavigation.current = false;
        etatLancement.current.derniere = null;
        void navigationController.stopGuidance().catch(() => {});
        void navigationController.clearDestinations().catch(() => {});
        setEtat('pret');
      }
    }, 0);
    return () => clearTimeout(t);
  }, [cleCible, lancer, navigationController]);

  // Nos repères numérotés (par identifiant : mise à jour par différence, retrait de ceux qui disparaissent).
  const signature = reperes.map((r) => `${r.cle}:${r.numero}:${r.etat}:${r.position.latitude}:${r.position.longitude}`).join('|');
  useEffect(() => {
    if (!carte || !cartePrete) return;
    const voulus = new Set<string>();
    for (const r of reperes) {
      const id = `a:${r.cle}`;
      voulus.add(id);
      void carte
        .addMarker({
          id,
          position: { lat: r.position.latitude, lng: r.position.longitude },
          imgPath: nomImageRepere(COULEUR_ARRETS, r.etat, r.numero),
          anchor: { u: 0.5, v: 75 / 84 },
        })
        .catch(() => {});
    }
    for (const id of posees.current) if (!voulus.has(id)) carte.removeMarker(id);
    posees.current = voulus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carte, cartePrete, signature]);

  function arreter() {
    enNavigation.current = false;
    etatLancement.current.derniere = null;
    void navigationController.stopGuidance().catch(() => {});
    void navigationController.clearDestinations().catch(() => {});
    setEtat('pret');
  }

  const View_ = nav.NavigationView;
  const mapId = choisirIdCarte(envCarte(), theme);
  const session: SessionNavigation = {
    etat,
    message,
    occupe,
    enGuidage: etat === 'guidage',
    restant,
    demarrer: () => {
      if (cible) void lancer(cible);
    },
    arreter,
    recentrer: () => {
      void vueNavigation.current?.setFollowingPerspective(nav.CameraPerspective.TILTED)?.catch?.(() => {});
    },
  };
  // Le bandeau de manœuvre de Google prend les couleurs du thème : le bord haut (zone de l'heure) a la même couleur, sans barre de titre.
  const entete = J.header;
  const stylage = {
    navigationHeaderPrimaryBackgroundColor: J.header,
    navigationHeaderSecondaryBackgroundColor: assombrir(J.header, 0.2),
    navigationHeaderPrimaryBackgroundColorNightMode: J.header,
    navigationHeaderSecondaryBackgroundColorNightMode: assombrir(J.header, 0.2),
    navigationHeaderLargeManeuverIconColor: J.onHeader,
    navigationHeaderSmallManeuverIconColor: J.onHeader,
    navigationHeaderGuidanceRecommendedLaneColor: J.onHeader,
    navigationHeaderNextStepTextColor: J.onHeaderSoft,
    navigationHeaderDistanceValueTextColor: J.onHeader,
    navigationHeaderDistanceUnitsTextColor: J.onHeaderSoft,
    navigationHeaderInstructionsTextColor: J.onHeader,
  };
  return (
    <View style={[styles.racine, pleinEcran && etat === 'guidage' ? { backgroundColor: entete, paddingTop: top } : null]}>
      {/* La carte est toujours montée (la session de Google survit au changement d'écran) : plein cadre, sous l'aperçu. */}
      <View style={styles.vue}>
        <View_
          style={styles.vue}
          mapId={mapId}
          mapColorScheme={theme === 'dark' ? nav.MapColorScheme.DARK : nav.MapColorScheme.LIGHT}
          navigationNightMode={theme === 'dark' ? nav.NavigationNightMode.FORCE_NIGHT : nav.NavigationNightMode.FORCE_DAY}
          iOSStylingOptions={stylage}
          // Notre panneau remplace le pied de Google (la carte noire « 4 min ») et sa barre de progression ; pas de boussole, de limite de
          // vitesse, de compteur ni de messages de circulation par-dessus les nôtres ; le bouton de recentrage reste, au-dessus du panneau.
          footerEnabled={false}
          tripProgressBarEnabled={false}
          compassEnabled={false}
          speedometerEnabled={false}
          speedLimitIconEnabled={false}
          trafficPromptsEnabled={false}
          trafficIncidentCardsEnabled={false}
          recenterButtonEnabled
          mapPadding={{ top: 0, left: 0, right: 0, bottom: etat === 'guidage' ? hauteurPanneau : 0 }}
          // Pas de signalement d'incident de la circulation par Google : l'équipe signale par notre app.
          reportIncidentButtonEnabled={false}
          onMapViewControllerCreated={setCarte}
          onMapReady={() => setCartePrete(true)}
          onNavigationViewControllerCreated={(c) => {
            vueNavigation.current = c;
          }}
        />
      </View>
      {/* Notre panneau se pose PAR-DESSUS le bas de la carte (coins arrondis sur la carte) ; la carte réserve sa hauteur pour que le logo
          et le recentrage de Google restent visibles au-dessus. */}
      {/* Les fonctions d'écran passées en propriété ne lisent aucune référence pendant le rendu. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {session.enGuidage ? (
        <View style={styles.panneau} onLayout={(e: LayoutChangeEvent) => setHauteurPanneau(Math.round(e.nativeEvent.layout.height))}>
          {/* eslint-disable-next-line react-hooks/refs */}
          {barre(session)}
        </View>
      ) : null}
      {/* eslint-disable-next-line react-hooks/refs */}
      {!session.enGuidage ? <View style={StyleSheet.absoluteFill}>{apercu(session)}</View> : null}
    </View>
  );
}

/** Vue de navigation Google : une destination à la fois, voix coupée, conditions de Google acceptées au premier usage. */
export function NavigationGoogle(props: Props) {
  const nav = biblio();
  const Fournisseur = nav.NavigationProvider;
  return (
    <Fournisseur
      termsAndConditionsDialogOptions={{ title: "Conditions d'utilisation de la navigation", companyName: 'Priorix', showOnlyDisclaimer: false }}
      taskRemovedBehavior={nav.TaskRemovedBehavior.QUIT_SERVICE}>
      <Interieur {...props} />
    </Fournisseur>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  vue: { flex: 1 },
  panneau: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
