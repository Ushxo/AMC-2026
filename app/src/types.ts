import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';

export type Origine = 'officiel' | 'citoyen';
export type Gravite = 'faible' | 'moyenne' | 'elevee';
export type Categorie =
  | 'grille_bouchee'
  | 'eau_accumulee'
  | 'affaissement'
  | 'grille_endommagee'
  | 'eau_douteuse'
  | 'absence_eau'
  | 'autre';

/** Les catégories proposées au citoyen. Les autres ne servent qu'à lire d'anciens signalements. */
export const CATEGORIES_PROPOSEES: Categorie[] = ['grille_bouchee', 'eau_accumulee', 'affaissement', 'grille_endommagee'];
/** Toutes les catégories lisibles (les anciennes servent à relire d'anciens signalements). */
export const CATEGORIES_TOUTES: Categorie[] = [
  'grille_bouchee',
  'eau_accumulee',
  'affaissement',
  'grille_endommagee',
  'eau_douteuse',
  'absence_eau',
  'autre',
];
export type Etat = 'nouveau' | 'pris_en_charge' | 'regle' | 'rejete';
export type TypeAvisEau = 'ebullition' | 'coupure';
export type EtatSource = 'en_ligne' | 'repli';

export const ORDRE_GRAVITE: Record<Gravite, number> = { faible: 0, moyenne: 1, elevee: 2 };

export const LIBELLES_GRAVITE: Record<Gravite, string> = {
  faible: 'Faible',
  moyenne: 'Moyenne',
  elevee: 'Élevée',
};

export const LIBELLES_CATEGORIE: Record<Categorie, string> = {
  grille_bouchee: 'Égout bouché',
  eau_accumulee: "Accumulation d'eau ou inondation",
  affaissement: "Affaissement autour d'un égout",
  grille_endommagee: "Grille d'égout endommagée",
  eau_douteuse: "Eau du robinet douteuse",
  absence_eau: "Pas d'eau",
  autre: 'Autre',
};

export const LIBELLES_ETAT: Record<Etat, string> = {
  nouveau: 'Nouveau',
  pris_en_charge: 'Pris en charge',
  regle: 'Réglé',
  rejete: 'Rejeté',
};

export type Coordonnees = { latitude: number; longitude: number };

// Éléments officiels : propriétés des Feature des fichiers de app/src/donnees/.
type BaseOfficielle = { id: string; origine: 'officiel'; gravite: Gravite };

export type ProprietesGrille = BaseOfficielle & {
  adresse: string | null;
  provenance: string | null;
};

export type ProprietesAvisEau = BaseOfficielle & {
  type: TypeAvisEau;
  titre: string;
  adresse: string | null;
  debut: string; // date ISO
  fin: string | null;
  placement: 'geometrie_source' | 'adresse' | 'aucun';
};

export type ProprietesChantier = BaseOfficielle & {
  entreprise: string | null;
  debut: string | null;
  fin: string | null;
};

export type ProprietesZoneInondable = BaseOfficielle & { source: string };

export type CoucheGrilles = FeatureCollection<Point, ProprietesGrille>;
export type CoucheAvisEau = FeatureCollection<Point | Polygon | MultiPolygon | null, ProprietesAvisEau>;
export type CoucheChantiers = FeatureCollection<Point, ProprietesChantier>;
export type CoucheZonesInondables = FeatureCollection<Polygon | MultiPolygon, ProprietesZoneInondable>;
export type AvisEau = Feature<Point | Polygon | MultiPolygon | null, ProprietesAvisEau>;

export type Couches = {
  grilles: CoucheGrilles;
  avisEau: CoucheAvisEau;
  chantiers: CoucheChantiers;
  zonesInondables: CoucheZonesInondables;
  copieDu: string; // date ISO de la copie locale (meta.json)
};

export type NomCouche = 'grilles' | 'avisEau' | 'chantiers' | 'zonesInondables' | 'signalements';

// Éléments citoyens.
export type Signalement = {
  id: string; // UUID créé par l'app
  origine: 'citoyen';
  cree_le: string;
  latitude: number;
  longitude: number;
  categorie: Categorie;
  gravite: Gravite; // choisie par le citoyen
  commentaire: string | null;
  photo_url: string | null;
  grille_id: string | null;
  etat: Etat;
  etat_change_le: string;
  exemple_demo: boolean;
  en_attente?: boolean; // vrai tant qu'il est dans la file d'attente hors réseau (jamais stocké en base)
  echec_envoi?: string; // motif lisible quand l'envoi est refusé pour de bon (jamais stocké en base)
};

export type NouveauSignalement = {
  latitude: number;
  longitude: number;
  categorie: Categorie;
  gravite: Gravite;
  commentaire?: string;
  photoUri?: string; // fichier local de l'appareil photo
};

export type ErreurValidation = { champ: keyof NouveauSignalement; message: string };

export type ResultatEnvoi =
  | { statut: 'envoye'; signalement: Signalement; sansPhoto?: boolean }
  | { statut: 'en_attente'; signalement: Signalement; sansPhoto?: boolean }
  | { statut: 'invalide'; erreurs: ErreurValidation[] }
  | { statut: 'echec'; message: string };

export type Endroit = {
  cle: string;
  position: Coordonnees;
  nombre: number;
  gravite_choisie_max: Gravite;
  gravite_par_nombre: Gravite;
  gravite_affichee: Gravite;
  etat_dominant: Etat;
  signalements: Signalement[];
};

export type ChangementEtat = {
  id: string;
  signalement_id: string;
  ancien_etat: Etat;
  nouvel_etat: Etat;
  change_le: string;
  change_par: string | null;
};

export type Employe = { user_id: string; nom: string; courriel: string };

export type ResultatRecherche = { libelle: string; position: Coordonnees; source: 'local' | 'telephone' };

export type ZoneEauTrouvee = { dansZone: boolean; avis: AvisEau[] };

export type ResumeVille = {
  parEtat: Record<Etat, number>;
  parCategorie: Record<Categorie, number>;
};

// ---------- Après le pivot : tournées des équipes ----------

export type StatutDemande = 'en_attente' | 'en_cours' | 'terminee' | 'echec' | 'remplacee';
export type TypeIncident = 'accident' | 'rue_fermee' | 'autre';
export type SourceMatrice = 'osrm_cache' | 'osrm' | 'vol_oiseau';
export type SourceTournees = 'direct' | 'precalcule';

export const LIBELLES_INCIDENT: Record<TypeIncident, string> = {
  accident: 'Accident',
  rue_fermee: 'Rue fermée',
  autre: 'Autre',
};

export type Equipe = {
  id: string;
  nom: string;
  membres: string[];
  vehicule: string | null;
  garage: Coordonnees;
  garage_nom?: string;
  garage_adresse?: string | null;
  // Adresse d'arrivée de l'équipe ; absente = retour au garage.
  arrivee?: Coordonnees | null;
  arrivee_nom?: string | null;
  arrivee_adresse?: string | null;
  // Compte qui suit le trajet de cette équipe et partage sa position (absent si aucun).
  compte_id?: string | null;
  debut_quart: string; // "08:00"
  fin_quart: string; // "16:00"
  active: boolean;
  exemple_demo: boolean;
};

export type NouvelleEquipe = Omit<Equipe, 'id' | 'exemple_demo' | 'active'> & { active?: boolean };

export type Incident = {
  id: string;
  type: TypeIncident;
  position: Coordonnees;
  rayon_m: number;
  description: string | null;
  actif: boolean;
  simule: true; // tout incident ajouté dans l'app est simulé
  cree_le: string;
};

export type NouvelIncident = { type: TypeIncident; position: Coordonnees; rayon_m?: number; description?: string };

export type ParametresOptimisation = {
  version: 1;
  equipe_ids: string[];
  date?: string;
  debut_au_plus_tot?: string;
  incident_ids: string[];
  // Endroits choisis par le superviseur (clés d'endroit). Absent ou vide = tous les endroits ouverts.
  cles_endroits?: string[];
  // Départ des tournées : le garage de chaque équipe (défaut) ou sa dernière position connue.
  depart?: 'garage' | 'position';
  // Fin des tournées : retour au garage (défaut), fin libre au dernier arrêt, ou un endroit choisi.
  fin?: 'garage' | 'libre' | 'endroit';
  // Endroit de fin commun quand fin vaut 'endroit' (clé d'endroit).
  fin_cle_endroit?: string;
  // 'tournee' : recalcul de la tournée des équipes de equipe_ids, arrêts faits gardés en tête. Défaut : 'global'.
  recalcul?: 'global' | 'tournee';
  // Choix par équipe, qui l'emporte sur depart et fin : clé = identifiant de l'équipe.
  // Départ : son garage ou sa dernière position connue. Fin : son adresse d'arrivée (le garage si elle n'en a pas) ou fin libre.
  depart_par_equipe?: Record<string, 'garage' | 'position'>;
  fin_par_equipe?: Record<string, 'arrivee' | 'libre'>;
  // Position de départ donnée avec la demande (celle du téléphone qui demande le recalcul), par équipe.
  // Elle l'emporte sur la dernière position partagée quand depart vaut 'position' pour cette équipe.
  positions_depart?: Record<string, Coordonnees>;
  // Répartir le travail entre les équipes (réduire la tournée la plus longue) plutôt que de minimiser seulement les kilomètres.
  repartir?: boolean;
  affectations_forcees: { cle_endroit: string; equipe_id: string }[];
  limite_secondes: number;
};

export type DemandeOptimisation = {
  id: string;
  cree_le: string;
  statut: StatutDemande;
  parametres: ParametresOptimisation;
  message: string | null;
  commence_le: string | null;
  termine_le: string | null;
};

export type Arret = {
  id?: string; // absent dans un résultat précalculé
  rang: number;
  cle_endroit: string;
  signalement_ids: string[];
  position: Coordonnees;
  arrivee_prevue: string;
  depart_prevu: string;
  fait?: boolean;
  fait_le?: string | null;
  /** Évaluation sur place par l'équipe (migration 0009) : réglé ou non, commentaire si non réglé. */
  regle?: boolean | null;
  commentaire?: string | null;
  evalue_le?: string | null;
};

export type Tournee = {
  id?: string;
  equipe_id: string;
  equipe_nom: string;
  distance_m: number;
  duree_s: number;
  debut_prevu: string;
  fin_prevue: string;
  geometrie: { type: 'LineString'; coordinates: [number, number][] } | null;
  arrets: Arret[];
  /** Moment où l'équipe a envoyé son rapport au superviseur (migration 0009). */
  rapport_envoye_le?: string | null;
  // D'où part et où finit la tournée. Absents dans les anciens résultats : garage et garage.
  depart?: 'garage' | 'position';
  depart_position?: Coordonnees;
  fin?: 'garage' | 'arrivee' | 'libre' | 'endroit';
  fin_position?: Coordonnees;
  // Nom de l'adresse d'arrivée quand fin vaut 'arrivee'.
  fin_nom?: string | null;
  // Recalcul pour une partie des équipes : tournée republiée telle quelle, ou recalculée en gardant ses arrêts faits en tête.
  conservee?: boolean;
  recalculee?: boolean;
  faits_conserves?: number;
};

export type NonServi = { cle_endroit: string; gravite: Gravite; raison: string };

export type PlanCompare = { distance_m: number; duree_s: number; arrets_servis: number };

// Comparaison à travail égal : les deux plans servent les mêmes arrêts.
// « ordre_arrivee » suit l'ordre des signalements, sans limite de quart.
export type Comparaison = {
  ordre_arrivee: PlanCompare & { depassement_quart_s: number };
  optimise: PlanCompare;
  gain_distance_m: number;
  gain_duree_s: number;
  // Mesure à part : arrêts servis dans le quart par chaque méthode.
  dans_le_quart: { ordre_arrivee: number; optimise: number; arrets_en_plus: number };
  // 'partiel' : calcul sur une partie des équipes ou des endroits ; ne vaut pas pour le plan complet. Absent = complet.
  portee?: 'complet' | 'partiel';
};

export type ResultatOptimisation = {
  version: 1;
  demande_id: string;
  statut: 'terminee' | 'echec';
  message: string | null;
  calcule_le: string;
  duree_calcul_ms: number;
  source_matrice: SourceMatrice;
  precalcule: boolean;
  incidents: Pick<Incident, 'id' | 'type' | 'position' | 'rayon_m' | 'simule'>[];
  tournees: Tournee[];
  non_servis: NonServi[];
  comparaison: Comparaison;
  // Totaux de toutes les tournées (absents dans les anciens résultats).
  totaux?: { distance_m: number; duree_s: number; arrets_servis: number };
  // 'partiel' quand le calcul ne portait que sur une partie des équipes : la comparaison ne vaut pas pour le plan complet.
  portee?: 'complet' | 'partiel';
};

// Fichiers précalculés embarqués (app/src/donnees/tournees-demo*.json).
export type ResultatPrecalcule = ResultatOptimisation & { precalcule: true; equipes: Equipe[] };

export type EtapeSuivi = 'recu' | 'planifie' | 'pris_en_charge' | 'regle' | 'rejete';

export const LIBELLES_SUIVI: Record<EtapeSuivi, string> = {
  recu: 'Reçu',
  planifie: 'Planifié',
  pris_en_charge: 'Pris en charge',
  regle: 'Réglé',
  rejete: 'Rejeté',
};

export type SuiviSignalement = {
  etape: EtapeSuivi;
  heure_estimee: string | null; // arrondie au quart d'heure, seulement à l'étape planifie
  rang: number | null; // rang de l'arrêt dans la tournée, sans nom d'équipe ni de membre
  depuis: string | null; // date du dernier changement (état ou planification)
  precalcule: boolean; // vrai si l'heure vient d'un résultat précalculé
};

// Dernière position connue d'une équipe pendant sa tournée (visible des employés seulement).
export type PositionEquipe = {
  equipe_id: string;
  position: Coordonnees;
  cap: number | null;
  maj_le: string;
};
