-- Deux nouvelles catégories de signalement, choisies par le citoyen sur l'écran « Quel problème avez-vous observé ? ».
-- Les anciennes catégories restent valides pour les signalements déjà enregistrés.
-- Peut être relancée sans danger.

alter type categorie add value if not exists 'affaissement';
alter type categorie add value if not exists 'grille_endommagee';
