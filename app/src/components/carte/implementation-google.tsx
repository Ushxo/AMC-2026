import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type * as Nav from '@googlemaps/react-native-navigation-sdk';

import { useOngletActifRef } from '@/components/mouvement/onglets-gardes';
import { useThemeCarte } from '@/hooks/use-theme-carte';
import { deltasPourRayon } from '@/lib/position-citoyen';
import { cadrerPoints, regionDepuisCamera, zoomDepuisDelta } from '@/lib/camera';
import { choisirIdCarte, envCarte } from '@/lib/carte-reglages';
import { NOM_IMAGE_VEHICULE, nomImageGroupe, nomImageGroupeInfo, nomImageInfo, nomImageRepere } from '@/lib/images-reperes';
import type { Coordonnees } from '@/types';

import type { CarteProps, CercleProps, RepereGroupeProps, RepereInfoProps, RepereProps, TraceProps, VehiculeProps, ZoneProps } from './types';

/** Chargement tardif : la bibliothèque n'existe que dans une build faite avec NAVIGATION_GOOGLE=1. */
function biblio(): typeof Nav {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@googlemaps/react-native-navigation-sdk');
}

type Gestionnaires = { onPress?: () => void; onBulle?: () => void };

type Contexte = {
  controleur: Nav.MapViewController | null;
  inscrire: (id: string, g: Gestionnaires | null) => void;
};

const ContexteCarte = createContext<Contexte>({ controleur: null, inscrire: () => {} });

const PREFIXE_REPERE = 'r:';
const PREFIXE_ZONE = 'z:';
const PREFIXE_TRACE = 't:';
const PREFIXE_CERCLE = 'c:';
const PERIODE_RAFALE_MS = 100;
const RAFALE_APRES_GESTE_MS = 1000;
const PERIODE_REPOS_MS = 600;
/** Un repère retiré l'est après ce délai : les nouveaux repères sont posés d'abord, pas de trou à l'écran. */
const DELAI_RETRAIT_MS = 80;
const ZOOM_SUIVI = 17;
const INCLINAISON_SUIVI = 55;

/**
 * Pose un repère. Si son image n'est pas dans la build (« Failed to load image from the provided path »), on le pose avec le repère
 * par défaut de la carte : il reste visible et touchable, et aucune promesse rejetée ne traîne (une par repère auparavant).
 */
export function poserRepere(c: Nav.MapViewController, options: Parameters<Nav.MapViewController['addMarker']>[0]): void {
  void Promise.resolve(c.addMarker(options)).catch(() => {
    const { imgPath: _image, ...sansImage } = options as typeof options & { imgPath?: string };
    return Promise.resolve(c.addMarker(sansImage as typeof options)).catch(() => {});
  });
}

/** Une forme (tracé, secteur, cercle) qui ne peut pas être posée n'est qu'ignorée : jamais de promesse rejetée sans traitement. */
function sansErreur(p: unknown): void {
  void Promise.resolve(p).catch(() => {});
}

function ll(c: Coordonnees): Nav.LatLng {
  return { lat: c.latitude, lng: c.longitude };
}

/** Implémentation Google (bibliothèque de navigation, MapView) : style par identifiant de carte, clair et sombre. */
export function Carte({ commandes, children, regionInitiale, onPress, onRegionChangeComplete, onTaille, style, accessibilityLabel, positionUtilisateur }: CarteProps) {
  const nav = biblio();
  const theme = useThemeCarte();
  // Carte cachée par une coquille à onglets : on ne relit pas la caméra. La visibilité se lit dans le minuteur, SANS rendu ni effet
  // relancé : une rafale de bascules ne coûte rien à la carte (ni redémarrage de minuteur, ni lecture native au retour).
  const ongletActif = useOngletActifRef();
  const mapId = choisirIdCarte(envCarte(), theme);
  const cleVue = `google-${theme}-${mapId ?? 'defaut'}`;
  // Chaque vue native (recréée quand le style change) a son propre contrôleur et son propre « prête » : l'état d'une ancienne vue ne compte jamais.
  const [vue, setVue] = useState<{ cle: string; controleur: Nav.MapViewController | null; prete: boolean }>({ cle: '', controleur: null, prete: false });
  // Le contrôleur n'est utilisable qu'une fois la carte native prête (sinon « No view controller found »).
  const controleur = vue.cle === cleVue && vue.prete ? vue.controleur : null;
  const taille = useRef({ largeur: 360, hauteur: 360 });
  const [mesure, setMesure] = useState<{ largeur: number; hauteur: number } | null>(null);
  const gestionnaires = useRef(new Map<string, Gestionnaires>());
  const derniereRegion = useRef<string>('');
  const surRegion = useRef(onRegionChangeComplete);
  const surPress = useRef(onPress);
  const touche = useRef(false);
  const finGeste = useRef(0);
  const derniereLecture = useRef(0);
  const lectureEnVol = useRef(false); // une seule lecture de caméra en vol à la fois
  const declencher = () => {
    finGeste.current = Date.now();
  };
  // Cadrage demandé avant que la carte soit prête : appliqué dès qu'elle l'est.
  const [enAttente, setEnAttente] = useState<{ position: Coordonnees; rayonM: number } | null>(null);

  useEffect(() => {
    surRegion.current = onRegionChangeComplete;
    surPress.current = onPress;
  }, [onRegionChangeComplete, onPress]);

  const inscrire = useCallback((id: string, g: Gestionnaires | null) => {
    if (g) gestionnaires.current.set(id, g);
    else gestionnaires.current.delete(id);
  }, []);
  const contexte = useMemo(() => ({ controleur, inscrire }), [controleur, inscrire]);

  useImperativeHandle(commandes, () => ({
    surPosition: (position, rayonM) => {
      if (!controleur) {
        setEnAttente({ position, rayonM });
        return;
      }
      const d = deltasPourRayon(position, rayonM);
      const { zoom } = cadrerPoints(
        [
          { latitude: position.latitude - d.latitudeDelta / 2, longitude: position.longitude },
          { latitude: position.latitude + d.latitudeDelta / 2, longitude: position.longitude },
          { latitude: position.latitude, longitude: position.longitude - d.longitudeDelta / 2 },
          { latitude: position.latitude, longitude: position.longitude + d.longitudeDelta / 2 },
        ],
        taille.current.largeur,
        taille.current.hauteur,
        19,
      );
      controleur.moveCamera({ target: ll(position), zoom, tilt: 0, bearing: 0 });
      declencher();
    },
    cadrer: (points) => {
      if (!controleur || points.length === 0) return;
      const { centre, zoom } = cadrerPoints(points, taille.current.largeur, taille.current.hauteur);
      controleur.moveCamera({ target: ll(centre), zoom, tilt: 0, bearing: 0 });
      declencher();
    },
    zoomer: (points) => {
      if (!controleur || points.length === 0) return;
      const { centre, zoom } = cadrerPoints(points, taille.current.largeur, taille.current.hauteur, 19);
      controleur.moveCamera({ target: ll(centre), zoom: Math.max(2, zoom - 0.6), tilt: 0, bearing: 0 });
      declencher();
    },
    centrer: (position) => {
      if (!controleur) return;
      void controleur
        .getCameraPosition()
        .then((c) => {
          controleur.moveCamera({ target: ll(position), zoom: c.zoom, tilt: c.tilt, bearing: c.bearing });
          declencher();
        })
        .catch(() => {});
    },
    suivre: (position, cap) => {
      controleur?.moveCamera({ target: ll(position), zoom: ZOOM_SUIVI, tilt: INCLINAISON_SUIVI, bearing: cap ?? 0 });
      declencher();
    },
  }));

  useEffect(() => {
    if (!controleur || !enAttente) return;
    const d = deltasPourRayon(enAttente.position, enAttente.rayonM);
    const { zoom } = cadrerPoints(
      [
        { latitude: enAttente.position.latitude - d.latitudeDelta / 2, longitude: enAttente.position.longitude - d.longitudeDelta / 2 },
        { latitude: enAttente.position.latitude + d.latitudeDelta / 2, longitude: enAttente.position.longitude + d.longitudeDelta / 2 },
      ],
      taille.current.largeur,
      taille.current.hauteur,
      19,
    );
    controleur.moveCamera({ target: ll(enAttente.position), zoom, tilt: 0, bearing: 0 });
    finGeste.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnAttente(null);
  }, [controleur, enAttente]);

  // La bibliothèque n'a pas d'événement de caméra : on relit la caméra par rafales courtes pendant un geste (toutes les
  // 100 ms) et 1 s après sa fin, puis très rarement au repos (filet de sécurité, pour un déplacement qui ne passe pas par un toucher).
  // Le minuteur n'est créé qu'une fois par contrôleur ; carte cachée, il ne fait rien.
  useEffect(() => {
    if (!controleur) return;
    const minuteur = setInterval(() => {
      if (!ongletActif.current()) return; // onglet caché : aucune lecture native
      if (!surRegion.current || lectureEnVol.current) return;
      const maintenant = Date.now();
      const rafale = touche.current || maintenant - finGeste.current < RAFALE_APRES_GESTE_MS;
      if (!rafale && maintenant - derniereLecture.current < PERIODE_REPOS_MS) return;
      derniereLecture.current = maintenant;
      lectureEnVol.current = true;
      void controleur
        .getCameraPosition()
        .then((c) => {
          if (!ongletActif.current()) return; // le résultat arrive alors que l'onglet est caché : ignoré
          const r = regionDepuisCamera({ latitude: c.target.lat, longitude: c.target.lng }, c.zoom ?? 12, taille.current.largeur, taille.current.hauteur);
          const cle = `${r.latitude.toFixed(5)}|${r.longitude.toFixed(5)}|${r.longitudeDelta.toFixed(5)}`;
          if (cle === derniereRegion.current) return; // caméra inchangée : ni regroupement ni mise à jour des repères
          derniereRegion.current = cle;
          surRegion.current?.(r);
        })
        .catch(() => {})
        .finally(() => {
          lectureEnVol.current = false;
        });
    }, PERIODE_RAFALE_MS);
    return () => clearInterval(minuteur);
  }, [controleur, ongletActif]);

  const Vue = nav.MapView;
  return (
    <View
      style={style}
      accessibilityLabel={accessibilityLabel}
      onTouchStart={() => {
        touche.current = true;
      }}
      onTouchEnd={() => {
        touche.current = false;
        declencher();
      }}
      onTouchCancel={() => {
        touche.current = false;
        declencher();
      }}
      onLayout={(e: LayoutChangeEvent) => {
        const m = { largeur: e.nativeEvent.layout.width, hauteur: e.nativeEvent.layout.height };
        taille.current = m;
        setMesure((avant) => avant ?? m);
        onTaille?.(m);
      }}>
      {mesure ? (
      <Vue
        key={cleVue}
        style={{ flex: 1 }}
        mapId={mapId}
        mapColorScheme={theme === 'dark' ? nav.MapColorScheme.DARK : nav.MapColorScheme.LIGHT}
        initialCameraPosition={{ target: { lat: regionInitiale.latitude, lng: regionInitiale.longitude }, zoom: zoomDepuisDelta(regionInitiale.longitudeDelta, mesure.largeur) }}
        compassEnabled={false}
        mapToolbarEnabled={false}
        myLocationEnabled={!!positionUtilisateur}
        myLocationButtonEnabled={false}
        indoorEnabled={false}
        onMapViewControllerCreated={(c) => setVue((v) => ({ cle: cleVue, controleur: c, prete: v.cle === cleVue ? v.prete : false }))}
        onMapReady={() => setVue((v) => ({ cle: cleVue, controleur: v.cle === cleVue ? v.controleur : null, prete: true }))}
        onMapClick={(p) => surPress.current?.({ latitude: p.lat, longitude: p.lng })}
        onMarkerClick={(m) => gestionnaires.current.get(m.id)?.onPress?.()}
        onMarkerInfoWindowTapped={(m) => gestionnaires.current.get(m.id)?.onBulle?.()}
        onPolygonClick={(p) => gestionnaires.current.get(p.id)?.onPress?.()}
        onPolylineClick={(p) => gestionnaires.current.get(p.id)?.onPress?.()}
        onCircleClick={(c) => gestionnaires.current.get(c.id)?.onPress?.()}
      />
      ) : null}
      <ContexteCarte.Provider value={contexte}>{children as ReactNode}</ContexteCarte.Provider>
    </View>
  );
}

/** Version de chaque élément posé : un retrait différé n'a d'effet que si l'élément n'a pas été reposé entre-temps. */
const versions = new Map<string, number>();

/** Ajoute ou met à jour un élément par identifiant ; le retire (avec un léger délai) au démontage. */
function useElement(id: string, ajouter: (c: Nav.MapViewController) => void, retirer: (c: Nav.MapViewController) => void, deps: unknown[]) {
  const { controleur } = useContext(ContexteCarte);
  useEffect(() => {
    if (controleur) {
      versions.set(id, (versions.get(id) ?? 0) + 1);
      ajouter(controleur);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controleur, ...deps]);
  useEffect(
    () => () => {
      if (!controleur) return;
      const version = versions.get(id) ?? 0;
      // Retrait différé : les nouveaux repères (autre niveau de regroupement) sont posés avant, sans trou d'image.
      setTimeout(() => {
        if ((versions.get(id) ?? 0) !== version) return; // reposé entre-temps : on garde le nouveau
        try {
          retirer(controleur);
        } catch {
          // carte déjà détruite
        }
      }, DELAI_RETRAIT_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controleur, id],
  );
}

export function Repere({ id, position, couleur, etat, numero, titre, description, onPress, onBulle }: RepereProps) {
  const { inscrire } = useContext(ContexteCarte);
  const cle = `${PREFIXE_REPERE}${id}`;
  useElement(
    cle,
    (c) => {
      poserRepere(c, {
        id: cle,
        position: ll(position),
        imgPath: nomImageRepere(couleur, etat, numero),
        title: titre,
        snippet: description,
        anchor: { u: 0.5, v: 75 / 84 }, // la pointe du dessin tombe sur la position
      });
    },
    (c) => c.removeMarker(cle),
    [position.latitude, position.longitude, couleur, etat, numero, titre, description],
  );
  useEffect(() => {
    inscrire(cle, { onPress, onBulle });
    return () => inscrire(cle, null);
  }, [inscrire, cle, onPress, onBulle]);
  return null;
}

export function RepereGroupe({ id, position, couleur, nombre, pointEleve, marque, information, onPress }: RepereGroupeProps) {
  const { inscrire } = useContext(ContexteCarte);
  const cle = `${PREFIXE_REPERE}${id}`;
  useElement(
    cle,
    (c) => {
      poserRepere(c, {
        id: cle,
        position: ll(position),
        imgPath: information ? nomImageGroupeInfo(nombre) : nomImageGroupe(couleur, nombre, !!pointEleve),
        // Sélection d'un groupe sans image de plus : opacité (tous 1, certains 0,8, aucun 0,5).
        alpha: marque === 'aucune' ? 0.5 : marque === 'tiret' ? 0.8 : 1,
        anchor: { u: 0.5, v: 75 / 84 },
      });
    },
    (c) => c.removeMarker(cle),
    [position.latitude, position.longitude, couleur, nombre, pointEleve, marque, information],
  );
  useEffect(() => {
    inscrire(cle, { onPress });
    return () => inscrire(cle, null);
  }, [inscrire, cle, onPress]);
  return null;
}

export function Vehicule({ id, position, cap, titre, description }: VehiculeProps) {
  const cle = `v:${id}`;
  useElement(
    cle,
    (c) => {
      poserRepere(c, {
        id: cle,
        position: ll(position),
        imgPath: NOM_IMAGE_VEHICULE,
        title: titre,
        snippet: description,
        rotation: cap ?? 0,
        flat: true,
        anchor: { u: 0.5, v: 0.5 },
      });
    },
    (c) => c.removeMarker(cle),
    [position.latitude, position.longitude, cap, titre, description],
  );
  return null;
}

export function Trace({ id, points, couleur, epaisseur, onPress }: TraceProps) {
  const { inscrire } = useContext(ContexteCarte);
  const cle = `${PREFIXE_TRACE}${id}`;
  useElement(
    cle,
    (c) => {
      sansErreur(c.addPolyline({ id: cle, points: points.map(ll), color: couleur, width: epaisseur, clickable: !!onPress }));
    },
    (c) => c.removePolyline(cle),
    [points, couleur, epaisseur, !!onPress],
  );
  useEffect(() => {
    inscrire(cle, { onPress });
    return () => inscrire(cle, null);
  }, [inscrire, cle, onPress]);
  return null;
}

/** Petit repère d'information (image embarquée par genre) : le plus sûr des chemins de toucher, comme les repères de signalement. */
export function RepereInfo({ id, position, genre, onPress }: RepereInfoProps) {
  const { inscrire } = useContext(ContexteCarte);
  const cle = `${PREFIXE_REPERE}${id}`;
  useElement(
    cle,
    (c) => {
      poserRepere(c, { id: cle, position: ll(position), imgPath: nomImageInfo(genre), anchor: { u: 0.5, v: 75 / 84 } });
    },
    (c) => c.removeMarker(cle),
    [position.latitude, position.longitude, genre],
  );
  useEffect(() => {
    inscrire(cle, { onPress });
    return () => inscrire(cle, null);
  }, [inscrire, cle, onPress]);
  return null;
}

export function Zone({ id, exterieur, trous, fond, contour, epaisseur, onPress }: ZoneProps) {
  const { inscrire } = useContext(ContexteCarte);
  const cle = `${PREFIXE_ZONE}${id}`;
  useElement(
    cle,
    (c) => {
      sansErreur(c.addPolygon({
        id: cle,
        points: exterieur.map(ll),
        holes: (trous ?? []).map((t) => t.map(ll)),
        fillColor: fond,
        strokeColor: contour,
        strokeWidth: epaisseur,
        clickable: !!onPress,
      }));
    },
    (c) => c.removePolygon(cle),
    [exterieur, trous, fond, contour, epaisseur],
  );
  useEffect(() => {
    inscrire(cle, { onPress });
    return () => inscrire(cle, null);
  }, [inscrire, cle, onPress]);
  return null;
}

export function Cercle({ id, centre, rayonM, fond, contour, epaisseur, onPress }: CercleProps) {
  const { inscrire } = useContext(ContexteCarte);
  const cle = `${PREFIXE_CERCLE}${id}`;
  useElement(
    cle,
    (c) => {
      sansErreur(c.addCircle({ id: cle, center: ll(centre), radius: rayonM, fillColor: fond, strokeColor: contour, strokeWidth: epaisseur, clickable: !!onPress }));
    },
    (c) => c.removeCircle(cle),
    [centre.latitude, centre.longitude, rayonM, fond, contour, epaisseur, !!onPress],
  );
  useEffect(() => {
    inscrire(cle, { onPress });
    return () => inscrire(cle, null);
  }, [inscrire, cle, onPress]);
  return null;
}
