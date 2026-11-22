-- Tournées : équipes, incidents, demandes d'optimisation, tournées, arrêts, organisations.
-- Le service de calcul écrit avec la clé de service, qui ne va jamais dans le dépôt.

create type statut_demande as enum ('en_attente', 'en_cours', 'terminee', 'echec', 'remplacee');
create type type_incident as enum ('accident', 'rue_fermee', 'autre');

-- Organisations et thèmes (Défi Intact) : schéma seulement, écrans au frontend.
create table organisations (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  nom_app text not null default 'Signalement MTL',
  logo_url text,
  couleurs jsonb not null default '{}'::jsonb, -- jetons de design : { "primaire": "#...", ... }
  police text,
  theme_defaut text not null default 'montreal',
  modifie_le timestamptz not null default now()
);

create table equipes (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 60),
  membres text[] not null default '{}',
  vehicule text,
  garage_nom text check (char_length(garage_nom) <= 80),
  garage_latitude double precision not null check (garage_latitude between 45.40 and 45.71),
  garage_longitude double precision not null check (garage_longitude between -73.98 and -73.47),
  debut_quart time not null default '08:00',
  fin_quart time not null default '16:00' check (fin_quart > debut_quart),
  active boolean not null default true,
  exemple_demo boolean not null default false,
  cree_le timestamptz not null default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  type type_incident not null,
  latitude double precision not null check (latitude between 45.40 and 45.71),
  longitude double precision not null check (longitude between -73.98 and -73.47),
  rayon_m integer not null default 100 check (rayon_m between 10 and 1000),
  description text check (char_length(description) <= 200),
  actif boolean not null default true,
  simule boolean not null default true,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid() references auth.users (id)
);

create table demandes_optimisation (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid() references auth.users (id),
  statut statut_demande not null default 'en_attente',
  parametres jsonb not null default '{}'::jsonb, -- ParametresOptimisation (contracts/optimisation.md)
  message text,
  commence_le timestamptz,
  termine_le timestamptz,
  comparaison jsonb,           -- Comparaison (contracts/optimisation.md)
  non_servis jsonb not null default '[]'::jsonb,
  source_matrice text          -- 'osrm_cache', 'osrm', 'vol_oiseau'
);

create index demandes_cree_le on demandes_optimisation (cree_le desc);

create table tournees (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes_optimisation (id) on delete cascade,
  equipe_id uuid not null references equipes (id) on delete cascade,
  distance_m integer not null,
  duree_s integer not null,
  debut_prevu timestamptz not null,
  fin_prevue timestamptz not null,
  geometrie jsonb               -- GeoJSON LineString, ou null (segments droits côté app)
);

create table arrets (
  id uuid primary key default gen_random_uuid(),
  tournee_id uuid not null references tournees (id) on delete cascade,
  demande_id uuid not null references demandes_optimisation (id) on delete cascade,
  rang integer not null check (rang >= 1),
  cle_endroit text not null,
  signalement_ids uuid[] not null,
  latitude double precision not null,
  longitude double precision not null,
  arrivee_prevue timestamptz not null,
  depart_prevu timestamptz not null,
  fait boolean not null default false,
  fait_le timestamptz,
  unique (tournee_id, rang)
);

create index arrets_signalements on arrets using gin (signalement_ids);
create index tournees_demande on tournees (demande_id);
create index arrets_demande on arrets (demande_id);

-- Règles d'accès
alter table organisations enable row level security;
alter table equipes enable row level security;
alter table incidents enable row level security;
alter table demandes_optimisation enable row level security;
alter table tournees enable row level security;
alter table arrets enable row level security;

create policy organisations_lecture on organisations for select using (true);
create policy organisations_employe on organisations for update using (est_employe()) with check (est_employe());

-- Les noms des membres restent réservés aux employés.
create policy equipes_employe_lecture on equipes for select using (est_employe());
create policy equipes_employe_creation on equipes for insert with check (est_employe());
create policy equipes_employe_modification on equipes for update using (est_employe()) with check (est_employe());

create policy incidents_lecture on incidents for select using (est_employe());
create policy incidents_creation on incidents for insert with check (est_employe() and simule);
create policy incidents_modification on incidents for update using (est_employe()) with check (est_employe());

create policy demandes_lecture on demandes_optimisation for select using (est_employe());
create policy demandes_creation on demandes_optimisation for insert
  with check (est_employe() and statut = 'en_attente');

create policy tournees_lecture on tournees for select using (est_employe());

-- Le service de calcul efface les tournées et arrêts des demandes précédentes avant d'écrire
-- les nouvelles : il ne reste jamais d'heure de passage périmée.
-- Le citoyen lit les arrêts (position, rang, heure) pour l'heure de passage ; aucun nom n'y figure.
create policy arrets_lecture on arrets for select using (true);
-- Marquer un arrêt fait (si le temps le permet) : employés seulement, colonnes fait et fait_le.
create policy arrets_modification on arrets for update using (est_employe()) with check (est_employe());
revoke update on arrets from anon, authenticated;
grant update (fait, fait_le) on arrets to authenticated;

-- Realtime : l'app et le service s'abonnent à ces tables.
alter publication supabase_realtime add table demandes_optimisation, tournees, arrets, incidents, organisations, signalements;
