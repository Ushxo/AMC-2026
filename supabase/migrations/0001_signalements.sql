create type gravite as enum ('faible', 'moyenne', 'elevee');
create type categorie as enum ('grille_bouchee', 'eau_accumulee', 'eau_douteuse', 'absence_eau', 'autre');
create type etat as enum ('nouveau', 'pris_en_charge', 'regle', 'rejete');

create table employes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nom text not null
);

create table signalements (
  id uuid primary key,
  cree_le timestamptz not null default now(),
  latitude double precision not null check (latitude between 45.40 and 45.71),
  longitude double precision not null check (longitude between -73.98 and -73.47),
  categorie categorie not null,
  gravite gravite not null,
  commentaire text check (char_length(commentaire) <= 500),
  photo_url text check (
    photo_url is null
    or photo_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/photos-signalements/'
  ),
  grille_id text,
  etat etat not null default 'nouveau',
  etat_change_le timestamptz not null default now(),
  exemple_demo boolean not null default false
);

create index signalements_cree_le on signalements (cree_le desc);

create table historique_etats (
  id uuid primary key default gen_random_uuid(),
  signalement_id uuid not null references signalements (id) on delete cascade,
  ancien_etat etat not null,
  nouvel_etat etat not null,
  change_le timestamptz not null default now(),
  change_par uuid references auth.users (id)
);

create function est_employe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employes where user_id = auth.uid());
$$;

-- À l'insertion par l'app : état « nouveau », date du serveur, jamais marqué comme exemple.
-- Seul le chargement avec la clé de service garde les valeurs fournies.
create function forcer_nouveau() returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.etat := 'nouveau';
    new.cree_le := now();
    new.etat_change_le := now();
    new.exemple_demo := false;
  end if;
  return new;
end $$;

create trigger signalements_insertion before insert on signalements
for each row execute function forcer_nouveau();

-- À la modification : seul l'état change, et il est historisé.
create function historiser_etat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etat is distinct from old.etat then
    new.etat_change_le := now();
    insert into historique_etats (signalement_id, ancien_etat, nouvel_etat, change_par)
    values (old.id, old.etat, new.etat, auth.uid());
  end if;
  return new;
end $$;

create trigger signalements_modification before update on signalements
for each row execute function historiser_etat();

alter table signalements enable row level security;
alter table historique_etats enable row level security;
alter table employes enable row level security;

create policy lecture_publique on signalements for select using (true);
create policy creation_publique on signalements for insert with check (true);
create policy modification_employe on signalements for update using (est_employe()) with check (est_employe());

-- Un employé ne peut changer que l'état. Les autres colonnes restent celles du citoyen.
revoke update on signalements from anon, authenticated;
grant update (etat) on signalements to authenticated;

-- L'historique nomme le compte qui a fait le changement : il est réservé aux employés.
create policy lecture_historique on historique_etats for select using (est_employe());
create policy lecture_soi on employes for select using (user_id = auth.uid());

-- Les signalements d'exemple (exemple_demo = true) sont chargés par un script de données
-- avec la clé de service, jamais depuis l'app. La clé de service ne va jamais dans le dépôt.

-- Photos : bucket public, images seulement, 5 Mo au plus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-signalements', 'photos-signalements', true, 5242880, array['image/jpeg', 'image/png']);
create policy photos_lecture on storage.objects for select using (bucket_id = 'photos-signalements');
create policy photos_envoi on storage.objects for insert with check (bucket_id = 'photos-signalements');

-- Comptes employés de démo : créés à la main dans Authentication, puis
-- insert into employes (user_id, nom) values ('<uuid>', 'Employé de démo');
