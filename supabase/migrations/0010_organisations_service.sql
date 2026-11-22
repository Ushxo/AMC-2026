-- Priorix sert plusieurs organisations : chacune a sa marque, son service et ses mots.
-- Demande la migration 0009. Peut être relancée sans danger.

-- Le nom de l'app d'une organisation est son propre nom.
update organisations set nom_app = 'Ville de Montréal', modifie_le = now()
where code = 'montreal' and nom_app is distinct from 'Ville de Montréal';

-- Ce que l'organisation fait traiter par ses équipes, et les mots affichés au citoyen.
alter table organisations add column if not exists service text check (char_length(service) <= 60);
alter table organisations add column if not exists textes jsonb not null default '{}'::jsonb;

update organisations
set service = 'Égouts et avis d''eau',
    textes = '{"titreCarte": "Carte des égouts", "rechercheAdresse": "Rechercher une adresse à Montréal"}'::jsonb
where code in ('priorix', 'montreal') and service is null;

-- Priorix montre tous les signalements, pas seulement les égouts.
update organisations
set textes = textes || '{"titreCarte": "Carte des signalements"}'::jsonb
where code = 'priorix' and textes ->> 'titreCarte' = 'Carte des égouts';

-- Un admin crée une organisation (avant : seulement la modifier).
drop policy if exists organisations_creation on organisations;
create policy organisations_creation on organisations for insert
  with check (est_admin());
