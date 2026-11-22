export const MESSAGE_REPLI =
  'Hors ligne : vous voyez une copie locale. Vos signalements partiront plus tard.';
export const MESSAGE_ENVOYE = 'Merci, votre signalement est envoyé.';
export const MESSAGE_EN_ATTENTE = 'Signalement gardé. Il sera envoyé au retour du réseau.';
export const MESSAGE_HORS_MONTREAL = 'Ce point est hors de Montréal. Déplacez-le sur la carte.';
export const MESSAGE_CONNEXION_REFUSEE = 'Courriel ou mot de passe incorrect.';
export const MESSAGE_CONNEXION_RESEAU =
  'Connexion impossible pour le moment. Vérifiez votre réseau.';
export const MESSAGE_PAS_EMPLOYE = "Ce compte n'a pas accès à l'espace du personnel.";
export const MESSAGE_SESSION_EXPIREE = 'Votre session a expiré. Connectez-vous de nouveau.';
export const MESSAGE_SESSION_REQUISE = 'Connectez-vous comme employé pour changer un état.';
export const MESSAGE_CHANGEMENT_REFUSE = "Le changement d'état n'a pas été accepté.";
export const MESSAGE_CHANGEMENT_ECHEC = "Le changement d'état a échoué. Réessayez.";
export const MESSAGE_LECTURE_ECHEC = 'Impossible de charger les signalements. Réessayez.';
export const MESSAGE_DEMO_SIMULEE =
  'Démonstration hors ligne : simulation. Les changements restent sur ce téléphone.';
export const MESSAGE_POSITION_REFUSEE = 'Position refusée : la carte montre le centre-ville.';

export const MESSAGE_ENVOYE_SANS_PHOTO = 'Votre signalement est envoyé, mais sans photo : la photo est introuvable.';
export const MESSAGE_EN_ATTENTE_SANS_PHOTO =
  'Signalement gardé sans photo (photo introuvable). Il sera envoyé au retour du réseau.';
export const MESSAGE_ECHEC_ENVOI = "L'envoi a été refusé :";

export const LIBELLE_STATUT = {
  envoye: MESSAGE_ENVOYE,
  en_attente: MESSAGE_EN_ATTENTE,
} as const;
export const MESSAGE_PHOTO_TROP_LOURDE = 'La photo est trop lourde (5 Mo au plus). Reprenez-la plus petite.';
export const MESSAGE_ENVOI_REFUSE = "Le serveur a refusé ce signalement. Il n'a pas été envoyé.";
export const MESSAGE_FILE_ILLISIBLE = "Impossible de garder le signalement sur ce téléphone. Réessayez.";
export const MESSAGE_CHANGEMENT_HORS_LIGNE =
  "Pas de réseau : le changement n'a pas été fait. Réessayez au retour du réseau.";
export const MESSAGE_PHOTO_PERDUE = 'La photo est introuvable : le signalement est gardé sans photo.';
export const MESSAGE_PANNE_EMPLOYES = 'Le service est indisponible pour le moment. Réessayez dans un instant.';

// --- Tournées des équipes ---
export const MESSAGE_OPTIMISATION_EN_COURS = 'Calcul des tournées en cours…';
export const MESSAGE_OPTIMISATION_PRECALCULEE = 'Le calcul ne répond pas : voici un résultat précalculé.';
export const MESSAGE_OPTIMISATION_ECHEC = 'Le calcul des tournées a échoué. Réessayez.';
export const MESSAGE_AUCUNE_EQUIPE = 'Ajoutez au moins une équipe active pour optimiser.';
export const MESSAGE_AUCUN_ENDROIT = 'Aucun signalement ouvert à planifier.';
export const MESSAGE_INCIDENT_SIMULE = 'Incident simulé pour la démonstration.';
export const MESSAGE_RESULTAT_PRECALCULE = 'Résultat précalculé';
export const MESSAGE_REGLE_COMPARAISON =
  "L'ordre d'arrivée est notre règle de comparaison, pas une pratique de votre organisation.";
export const MESSAGE_HYPOTHESES_DEMO =
  "Garages, équipes, durée d'intervention et quart sont des hypothèses de démonstration.";
export const MESSAGE_AUCUNE_TOURNEE = "Aucune tournée pour le moment. Lancez l'optimisation.";
export const MESSAGE_EQUIPES_LECTURE_SEULE =
  'Démonstration hors ligne : les équipes sont en lecture seule.';
export const MESSAGE_EQUIPE_INVALIDE = "Le nom de l'équipe est obligatoire (60 caractères au plus).";
export const MESSAGE_EQUIPE_ECHEC = "L'équipe n'a pas pu être enregistrée. Réessayez.";
export const MESSAGE_INCIDENT_ECHEC = "L'incident n'a pas pu être enregistré. Réessayez.";
export const MESSAGE_REOPTIMISER = 'Incident ajouté : relancez l’optimisation pour recalculer les tournées.';

export function messageHeureEstimee(heure: string): string {
  return `Passage estimé vers ${heure}. C'est une estimation.`;
}

export const MESSAGE_ROLE_SUPERVISEUR =
  'Seuls les superviseurs lancent l\u2019optimisation, gèrent les équipes et ajoutent un incident.';
export const MESSAGE_PRECALCULE_AVEC_INCIDENT = 'Résultat précalculé avec l\u2019incident de démo (sans nouveau calcul).';
export const MESSAGE_RESULTAT_ARRIVE = 'Le calcul est terminé : voici le vrai résultat.';

// --- Création de compte ---
export const MESSAGE_COMPTE_CREE =
  "Votre compte est créé. Un administrateur doit vous donner le rôle d'employé avant d'entrer dans l'espace du personnel.";
export const MESSAGE_CONFIRMER_COURRIEL =
  "Votre compte est créé. Confirmez votre courriel avec le message que nous venons de vous envoyer. Ensuite, un administrateur doit vous donner le rôle d'employé avant d'entrer dans l'espace du personnel.";
export const MESSAGE_COURRIEL_UTILISE = 'Ce courriel est déjà utilisé. Essayez de vous connecter.';
export const MESSAGE_MOT_DE_PASSE_COURT = 'Le mot de passe doit avoir 8 caractères au moins.';
export const MESSAGE_COURRIEL_INVALIDE = 'Entrez un courriel valide.';
export const MESSAGE_INSCRIPTION_ECHEC = "Le compte n'a pas pu être créé. Réessayez.";

// --- Sélection des endroits, progression, suivi du trajet ---
export const MESSAGE_SELECTION_VIDE = 'Sélectionnez au moins un endroit.';
export const MESSAGE_SELECTION_FERMEE = "Aucun des endroits sélectionnés n'est encore ouvert.";
export const MESSAGE_SELECTION_CHIFFRES = 'Comparaison calculée sur votre sélection.';
export const MESSAGE_PRECALCULE_TOUS_ENDROITS = 'Résultat précalculé sur tous les endroits.';
export const MESSAGE_ARRET_FAIT = 'Arrêt fait. Les signalements de cet endroit sont réglés.';
export const MESSAGE_ARRET_FAIT_LOCAL =
  'Arrêt noté sur ce téléphone seulement : rien n’est envoyé à la base en démonstration.';
export const MESSAGE_ARRET_FAIT_PARTIEL =
  "L'arrêt est noté, mais certains signalements n'ont pas pu être réglés. Touchez « Arrêt fait » pour réessayer.";
export const MESSAGE_ARRET_ECHEC = "L'arrêt n'a pas pu être noté. Réessayez.";
export const MESSAGE_TOURNEE_TERMINEE = 'Tournée terminée : retour au garage.';

// --- Compte d'équipe, position et trajet ---
export const MESSAGE_COMPTE_AUCUN = 'Aucun compte avec ce courriel. Le compte se crée d’abord par « Créer un compte ».';
export const MESSAGE_COMPTE_RESERVE = 'Réservé aux superviseurs.';
export const MESSAGE_COMPTE_INDISPONIBLE = "Cette fonction n'est pas encore disponible sur la base.";
export const MESSAGE_COMPTE_ECHEC = "Le compte n'a pas pu être changé. Réessayez.";
export const MESSAGE_COMPTE_ASSOCIE = 'Compte associé à cette équipe.';
export const MESSAGE_COMPTE_RETIRE = 'Compte retiré de cette équipe.';
export const MESSAGE_COMPTE_RAPPEL = "Le compte se crée d'abord par « Créer un compte » (écran de connexion).";
export const MESSAGE_POSITION_PARTAGEE = 'Votre position est partagée avec le superviseur pendant le trajet.';
export const MESSAGE_POSITION_LOCALE = 'Démonstration : votre position reste sur ce téléphone, rien n’est envoyé.';
export const MESSAGE_POSITION_NON_PARTAGEE = "Votre position n'est pas partagée avec le superviseur.";
export const MESSAGE_TRAJET_SANS_POSITION = "La position de l'appareil n'est pas autorisée : le trajet part du premier arrêt.";
export const MESSAGE_TRONCON_DROITE = 'Tracé en ligne droite : le service de routes ne répond pas.';

// --- Zones de signalements ---
export const MESSAGE_ZONE_ESTIMEE = 'Zones de signalements : étendue estimée';

export const MESSAGE_ORDRE_ESTIME = "Ordre estimé sur ce téléphone, à vol d'oiseau (sans les routes). Ce n'est pas un calcul du service d'optimisation.";
export const MESSAGE_RECALCUL_DEMANDE = "Recalcul demandé depuis votre position. Le nouvel ordre arrive dans un instant.";

/** Étiquette unique pour tout ce qui est simulé ou issu de la démonstration. */
export const ETIQUETTE_DEMONSTRATION = 'Démonstration';

export const MESSAGE_RECALCUL_INDISPONIBLE = 'Le recalcul en ligne n’est pas disponible pour le moment.';
export const MESSAGE_SEUL_SUPERVISEUR_OU_EQUIPE = 'Seul le superviseur ou le compte de cette équipe peut marquer un arrêt fait.';
