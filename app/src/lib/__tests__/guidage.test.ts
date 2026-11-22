import {
  calculerGuidage,
  directionCardinale,
  etapesDepuisOsrm,
  guidageDroit,
  messageArrivee,
  projeterSurTrace,
  traduireManoeuvre,
} from '../guidage';
import { tronconDepuisOsrm } from '../troncon';

// Vraie réponse du service OSRM (route avec steps=true, Montréal), réduite aux champs utiles. Enregistrée hors dépôt.
const REPONSE_OSRM = {"code": "Ok", "routes": [{"distance": 523.7, "duration": 88.3, "geometry": {"coordinates": [[-73.569835, 45.507668], [-73.56961, 45.507559], [-73.569586, 45.507549], [-73.569517, 45.507515], [-73.569461, 45.507569], [-73.569441, 45.507588], [-73.569228, 45.50782], [-73.569096, 45.50797], [-73.568793, 45.508308], [-73.56878, 45.508323], [-73.568734, 45.508376], [-73.568809, 45.508412], [-73.569276, 45.508637], [-73.570134, 45.509035], [-73.570299, 45.509114], [-73.570501, 45.509211], [-73.570582, 45.509247], [-73.57064, 45.50927], [-73.570676, 45.509281], [-73.570808, 45.509316], [-73.570778, 45.509395], [-73.570769, 45.509418], [-73.570561, 45.509898], [-73.570534, 45.50996], [-73.570501, 45.510037], [-73.570326, 45.510435], [-73.57023, 45.510666], [-73.570116, 45.510925]], "type": "LineString"}, "legs": [{"steps": [{"maneuver": {"bearing_after": 125, "bearing_before": 0, "location": [-73.569835, 45.507668], "modifier": "right", "type": "depart"}, "name": "Rue De Bleury", "distance": 30.1, "duration": 10.8, "geometry": {"coordinates": [[-73.569835, 45.507668], [-73.56961, 45.507559], [-73.569586, 45.507549], [-73.569517, 45.507515]], "type": "LineString"}}, {"maneuver": {"bearing_after": 32, "bearing_before": 123, "location": [-73.569517, 45.507515], "modifier": "left", "type": "turn"}, "name": "Avenue du Président-Kennedy", "distance": 113.6, "duration": 26.1, "geometry": {"coordinates": [[-73.569517, 45.507515], [-73.569461, 45.507569], [-73.569441, 45.507588], [-73.569228, 45.50782], [-73.569096, 45.50797], [-73.568793, 45.508308], [-73.56878, 45.508323], [-73.568734, 45.508376]], "type": "LineString"}}, {"maneuver": {"bearing_after": 303, "bearing_before": 30, "location": [-73.568734, 45.508376], "modifier": "left", "type": "turn"}, "name": "Rue Jeanne-Mance", "distance": 193.1, "duration": 32.7, "geometry": {"coordinates": [[-73.568734, 45.508376], [-73.568809, 45.508412], [-73.569276, 45.508637], [-73.570134, 45.509035], [-73.570299, 45.509114], [-73.570501, 45.509211], [-73.570582, 45.509247], [-73.57064, 45.50927], [-73.570676, 45.509281], [-73.570808, 45.509316]], "type": "LineString"}}, {"maneuver": {"bearing_after": 15, "bearing_before": 289, "location": [-73.570808, 45.509316], "modifier": "right", "type": "turn"}, "name": "Rue Sherbrooke Ouest", "distance": 186.8, "duration": 18.7, "geometry": {"coordinates": [[-73.570808, 45.509316], [-73.570778, 45.509395], [-73.570769, 45.509418], [-73.570561, 45.509898], [-73.570534, 45.50996], [-73.570501, 45.510037], [-73.570326, 45.510435], [-73.57023, 45.510666], [-73.570116, 45.510925]], "type": "LineString"}}, {"maneuver": {"bearing_after": 0, "bearing_before": 17, "location": [-73.570116, 45.510925], "modifier": "right", "type": "arrive"}, "name": "Rue Sherbrooke Ouest", "distance": 0, "duration": 0, "geometry": {"coordinates": [[-73.570116, 45.510925], [-73.570116, 45.510925]], "type": "LineString"}}]}]}]};

const DESTINATION = { latitude: 45.5109, longitude: -73.57 };

describe('traduction des manœuvres', () => {
  it('virages, avec ou sans nom de rue', () => {
    expect(traduireManoeuvre('turn', 'left', 'rue Wellington')).toEqual({ icone: 'gauche', texte: 'Tournez à gauche sur rue Wellington' });
    expect(traduireManoeuvre('turn', 'right', '')).toEqual({ icone: 'droite', texte: 'Tournez à droite' });
    expect(traduireManoeuvre('turn', 'slight left', 'rue A').icone).toBe('leger-gauche');
    expect(traduireManoeuvre('turn', 'sharp right', 'rue A').texte).toBe('Tournez franchement à droite sur rue A');
    expect(traduireManoeuvre('turn', 'uturn', '')).toEqual({ icone: 'demi-tour', texte: 'Faites demi-tour' });
    expect(traduireManoeuvre('turn', 'straight', 'rue A').texte).toBe('Continuez tout droit sur rue A');
  });

  it('continuer, changer de nom, départ, fusion, fourche, bout de rue', () => {
    expect(traduireManoeuvre('new name', 'straight', 'rue B').texte).toBe('Continuez sur rue B');
    expect(traduireManoeuvre('new name', 'straight', '').texte).toBe('Continuez');
    expect(traduireManoeuvre('continue', 'straight', '').texte).toBe('Continuez');
    expect(traduireManoeuvre('depart', 'right', 'rue C').texte).toBe('Partez sur rue C');
    expect(traduireManoeuvre('merge', 'slight left', 'autoroute 20').texte).toBe('Insérez-vous sur autoroute 20');
    expect(traduireManoeuvre('fork', 'slight right', 'rue D').texte).toBe('Gardez votre droite sur rue D');
    expect(traduireManoeuvre('end of road', 'left', 'rue E').texte).toBe('Au bout de la rue, tournez à gauche sur rue E');
    expect(traduireManoeuvre('on ramp', 'right', '').texte).toBe('Prenez la bretelle');
    expect(traduireManoeuvre('off ramp', 'right', 'sortie 5').texte).toBe('Prenez la sortie sur sortie 5');
  });

  it('ronds-points avec le numéro de sortie, et arrivée', () => {
    expect(traduireManoeuvre('roundabout', 'right', 'rue F', 1)).toEqual({ icone: 'rond-point', texte: 'Au rond-point, prenez la 1re sortie sur rue F' });
    expect(traduireManoeuvre('rotary', 'left', '', 3).texte).toBe('Au rond-point, prenez la 3e sortie');
    expect(traduireManoeuvre('roundabout', undefined, '').texte).toBe('Au rond-point, continuez');
    expect(traduireManoeuvre('exit roundabout', 'right', 'rue G').texte).toBe('Sortez du rond-point sur rue G');
    expect(traduireManoeuvre('arrive', 'right', '')).toEqual({ icone: 'arrivee', texte: 'Votre destination est sur votre droite' });
    expect(traduireManoeuvre('arrive', 'straight', '').texte).toBe('Vous arrivez à destination');
    expect(traduireManoeuvre('inconnu', undefined, '').texte).toBe('Continuez');
  });
});

describe('guidage sur une vraie réponse OSRM', () => {
  const etapes = etapesDepuisOsrm(REPONSE_OSRM);

  it('lit les étapes avec leurs points', () => {
    expect(etapes).toHaveLength(5);
    expect(etapes[0].texte).toBe('Partez sur Rue De Bleury');
    expect(etapes[1].texte).toBe('Tournez à gauche sur Avenue du Président-Kennedy');
    expect(etapes[1].icone).toBe('gauche');
    expect(etapes[3].texte).toBe('Tournez à droite sur Rue Sherbrooke Ouest');
    expect(etapes[4].icone).toBe('arrivee');
    expect(etapes[1].points.length).toBeGreaterThan(2);
  });

  it('le tronçon garde les étapes (steps=true) ; une réponse sans étapes donne une liste vide', () => {
    expect(tronconDepuisOsrm(REPONSE_OSRM)?.etapes).toHaveLength(5);
    const sans = { routes: [{ distance: 1, duration: 1, geometry: { coordinates: [[-73.57, 45.5], [-73.56, 45.51]] } }] };
    expect(tronconDepuisOsrm(sans)?.etapes).toEqual([]);
  });

  it('au départ : la première manœuvre avec sa distance', () => {
    const g = calculerGuidage({ position: etapes[0].points[0], etapes, numeroArret: 1, destination: DESTINATION });
    expect(g.statut).toBe('etapes');
    expect(g.icone).toBe('gauche');
    expect(g.instruction).toMatch(/^Dans \d+ m, tournez à gauche sur Avenue du Président-Kennedy$/);
    expect(g.suivante).toBe('Ensuite : tournez à gauche sur Rue Jeanne-Mance');
    expect(g.distanceManoeuvre_m).toBeGreaterThan(20);
    expect(g.distanceManoeuvre_m).toBeLessThan(40);
  });

  it('avance d’étape en étape quand on passe le point de manœuvre', () => {
    const enMilieu = etapes[2].points[Math.floor(etapes[2].points.length / 2)];
    const g2 = calculerGuidage({ position: enMilieu, etapes, numeroArret: 1, destination: DESTINATION });
    expect(g2.index).toBe(2);
    expect(g2.instruction).toMatch(/ournez à droite sur Rue Sherbrooke Ouest/);
    expect(g2.suivante).toBe('Ensuite : votre destination est sur votre droite');
    // juste après le point de manœuvre de l'étape 1, on est sur l'étape 1
    const apres = etapes[1].points[1];
    expect(calculerGuidage({ position: apres, etapes, numeroArret: 1, destination: DESTINATION }).index).toBe(1);
    // à moins de 12 m de la manœuvre : elle est passée
    const fin1 = etapes[1].points[etapes[1].points.length - 1];
    expect(calculerGuidage({ position: fin1, etapes, numeroArret: 1, destination: DESTINATION }).index).toBe(2);
  });

  it('près de la manœuvre, plus de « Dans … m »', () => {
    const pts = etapes[1].points;
    const a = pts[pts.length - 4];
    const b = pts[pts.length - 3];
    const pres = { latitude: a.latitude + (b.latitude - a.latitude) * 0.8, longitude: a.longitude + (b.longitude - a.longitude) * 0.8 };
    const g = calculerGuidage({ position: pres, etapes, numeroArret: 1, destination: DESTINATION });
    expect(g.index).toBe(1);
    expect(g.distanceManoeuvre_m).toBeLessThan(30);
    expect(g.instruction).toBe('Tournez à gauche sur Rue Jeanne-Mance');
  });

  it('arrivée à moins de 30 m de l’arrêt', () => {
    const g = calculerGuidage({ position: { latitude: 45.51085, longitude: -73.57 }, etapes, numeroArret: 3, destination: DESTINATION });
    expect(g.statut).toBe('arrive');
    expect(g.instruction).toBe(messageArrivee(3));
    expect(messageArrivee(3)).toBe("Vous êtes arrivé à l'arrêt 3");
  });

  it('écart au tracé et distance restante', () => {
    const p = etapes[1].points[0];
    const sur = projeterSurTrace(p, etapes[1].points);
    expect(sur.ecartM).toBeLessThan(1);
    expect(sur.restantM).toBeGreaterThan(100);
    const loin = projeterSurTrace({ latitude: p.latitude + 0.001, longitude: p.longitude }, etapes[1].points);
    expect(loin.ecartM).toBeGreaterThan(50);
  });
});

describe('sans route', () => {
  it('direction de l’arrêt, jamais de plantage', () => {
    const g = guidageDroit({ latitude: 45.5, longitude: -73.57 }, { latitude: 45.51, longitude: -73.57 }, 2);
    expect(g.statut).toBe('droite');
    expect(g.instruction).toContain('Guidage indisponible : direction de l\'arrêt 2, vers le nord');
    const sansEtapes = calculerGuidage({ position: { latitude: 45.5, longitude: -73.57 }, etapes: [], numeroArret: 2, destination: { latitude: 45.51, longitude: -73.57 } });
    expect(sansEtapes.statut).toBe('droite');
    expect(guidageDroit({ latitude: 45.5, longitude: -73.57 }, { latitude: 45.50005, longitude: -73.57 }, 2).statut).toBe('arrive');
  });

  it('points cardinaux', () => {
    expect(directionCardinale(0)).toBe('nord');
    expect(directionCardinale(100)).toBe('est');
    expect(directionCardinale(225)).toBe('sud-ouest');
    expect(directionCardinale(359)).toBe('nord');
  });
});
