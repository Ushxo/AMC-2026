-- Photo vérifiée : un signalement dont la photo a été acceptée par l'analyse compte plus
-- pour faire apparaître un endroit qu'un signalement sans photo.
-- Peut être relancée sans danger.

alter table signalements add column if not exists photo_verifiee boolean;

-- Les signalements déjà enregistrés gardent leur poids d'avant : ils comptent comme confirmés.
update signalements set photo_verifiee = true where photo_verifiee is null;

alter table signalements alter column photo_verifiee set default false;
alter table signalements alter column photo_verifiee set not null;
