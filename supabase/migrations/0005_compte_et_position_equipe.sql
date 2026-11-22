-- Compte d'une équipe et position de son véhicule pendant la tournée.
-- Peut être relancée sans danger.

-- Un compte (employé) par équipe : c'est ce compte qui suit le trajet et partage sa position.
alter table equipes add column if not exists compte_id uuid references auth.users (id) on delete set null;
create unique index if not exists equipes_compte on equipes (compte_id) where compte_id is not null;

-- Dernière position connue de chaque équipe. Une ligne par équipe, remplacée à chaque envoi.
create table if not exists positions_equipes (
  equipe_id uuid primary key references equipes (id) on delete cascade,
  latitude double precision not null check (latitude between 45.40 and 45.71),
  longitude double precision not null check (longitude between -73.98 and -73.47),
  cap double precision check (cap is null or (cap >= 0 and cap < 360)),
  maj_le timestamptz not null default now(),
  compte_id uuid default auth.uid() references auth.users (id) on delete set null
);

alter table positions_equipes enable row level security;

-- Les employés voient où sont les équipes ; le citoyen ne le voit jamais.
drop policy if exists positions_lecture on positions_equipes;
create policy positions_lecture on positions_equipes for select using (est_employe());

-- Seul le compte de l'équipe (ou un superviseur) envoie la position de cette équipe.
drop policy if exists positions_envoi on positions_equipes;
create policy positions_envoi on positions_equipes for insert with check (
  est_superviseur()
  or exists (select 1 from equipes e where e.id = equipe_id and e.compte_id = auth.uid())
);
drop policy if exists positions_mise_a_jour on positions_equipes;
create policy positions_mise_a_jour on positions_equipes for update using (
  est_superviseur()
  or exists (select 1 from equipes e where e.id = equipe_id and e.compte_id = auth.uid())
) with check (
  est_superviseur()
  or exists (select 1 from equipes e where e.id = equipe_id and e.compte_id = auth.uid())
);

-- L'heure et l'auteur d'une position viennent du serveur, jamais du téléphone.
create or replace function horodater_position() returns trigger language plpgsql as $$
begin
  new.maj_le := now();
  new.compte_id := auth.uid();
  return new;
end $$;
drop trigger if exists positions_horodatage on positions_equipes;
create trigger positions_horodatage before insert or update on positions_equipes
for each row execute function horodater_position();

-- L'équipe du compte connecté, ou rien.
create or replace function mon_equipe() returns uuid
language sql stable security definer set search_path = public as $$
  select id from equipes where compte_id = auth.uid() limit 1;
$$;
revoke execute on function mon_equipe() from public, anon;
grant execute on function mon_equipe() to authenticated, service_role;

-- Le superviseur associe un compte existant à une équipe, par son courriel.
-- Le compte devient employé s'il était citoyen. Un compte ne suit qu'une équipe à la fois.
create or replace function associer_compte_equipe(p_courriel text, p_equipe uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_compte uuid;
begin
  if not est_superviseur() then
    raise exception 'Réservé aux superviseurs.';
  end if;

  select id into v_compte from auth.users
  where lower(email) = lower(trim(p_courriel)) and deleted_at is null
  limit 1;
  if v_compte is null then
    raise exception 'Aucun compte avec ce courriel.';
  end if;
  if not exists (select 1 from equipes where id = p_equipe) then
    raise exception 'Équipe introuvable.';
  end if;

  update equipes set compte_id = null where compte_id = v_compte and id <> p_equipe;
  update equipes set compte_id = v_compte where id = p_equipe;
  -- Nouveau compte : l'ancienne position de l'équipe ne vaut plus.
  delete from positions_equipes where equipe_id = p_equipe;

  update profils set role = 'employe' where id = v_compte and role::text = 'citoyen';
end $$;
revoke execute on function associer_compte_equipe(text, uuid) from public, anon;
grant execute on function associer_compte_equipe(text, uuid) to authenticated, service_role;

-- Retirer le compte d'une équipe (le compte reste employé).
create or replace function dissocier_compte_equipe(p_equipe uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_superviseur() then
    raise exception 'Réservé aux superviseurs.';
  end if;
  update equipes set compte_id = null where id = p_equipe;
  delete from positions_equipes where equipe_id = p_equipe;
end $$;
revoke execute on function dissocier_compte_equipe(uuid) from public, anon;
grant execute on function dissocier_compte_equipe(uuid) to authenticated, service_role;

-- Les positions arrivent en direct chez le superviseur.
do $$
begin
  alter publication supabase_realtime add table positions_equipes;
exception when duplicate_object then null;
end $$;
