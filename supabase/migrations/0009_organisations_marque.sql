-- Marque par organisation : chaque organisation a son nom d'app, son logo et ses couleurs.
-- Un compte du personnel appartient à une organisation ; après la connexion, l'app prend sa marque.
-- Demande les migrations 0002 et 0003. Peut être relancée sans danger.

alter table organisations alter column nom_app set default 'Priorix';
alter table organisations add column if not exists code text check (code ~ '^[a-z0-9-]{2,30}$');
alter table organisations add column if not exists slogan text check (char_length(slogan) <= 80);
-- Clé d'un logo embarqué dans l'app (pas une adresse) : l'app marche sans réseau.
alter table organisations add column if not exists logo text not null default 'priorix'
  check (logo ~ '^[a-z0-9-]{2,30}$');
create unique index if not exists organisations_code_unique on organisations (code);

-- L'organisation d'origine devient la marque Priorix.
update organisations
set code = 'priorix', nom = 'Priorix', nom_app = 'Priorix', logo = 'priorix',
    slogan = 'Chaque équipe sait par où commencer.', theme_defaut = 'priorix', modifie_le = now()
where code is null
  and id = (select id from organisations order by modifie_le, id limit 1)
  and not exists (select 1 from organisations where code = 'priorix');

-- Une deuxième organisation, avec sa propre marque (rouge et blanc, logo en fleur).
insert into organisations (nom, nom_app, code, logo, slogan, theme_defaut, couleurs)
select 'Ville de Montréal', 'Égouts Montréal', 'montreal', 'fleur', 'Signalez, on s''en occupe.', 'montreal',
  '{
    "text": "#1F1A1A", "textSecondary": "#5E5557",
    "background": "#FBF8F8", "backgroundElement": "#F6E9EA", "backgroundSelected": "#F2CED1",
    "primary": "#B5121B", "onPrimary": "#FFFFFF",
    "accent": "#B5121B", "accentDoux": "#D8343C", "action": "#8F0E15", "onAction": "#FFFFFF",
    "header": "#B5121B", "onHeader": "#FFFFFF",
    "surface": "#FFFFFF", "border": "#E8D5D7", "borderForte": "#8A7577",
    "success": "#2F6B3A", "danger": "#8F0E15"
  }'::jsonb
where not exists (select 1 from organisations where code = 'montreal');

-- Chaque compte du personnel appartient à une organisation.
alter table employes add column if not exists organisation_id uuid references organisations (id) on delete set null;
update employes set organisation_id = (select id from organisations where code = 'priorix')
where organisation_id is null;

-- L'organisation du compte connecté. Un compte sans organisation choisie prend la marque Priorix.
create or replace function mon_organisation() returns organisations
language sql stable security definer set search_path = public as $$
  select o.* from organisations o
  where o.id = coalesce(
    (select e.organisation_id from employes e where e.user_id = auth.uid()),
    (select id from organisations where code = 'priorix')
  );
$$;
revoke execute on function mon_organisation() from public, anon;
grant execute on function mon_organisation() to authenticated, service_role;

-- Un admin range un compte du personnel dans une organisation.
create or replace function definir_organisation_compte(p_courriel text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_compte uuid;
  v_organisation uuid;
begin
  if not est_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  select id into v_organisation from organisations where code = p_code;
  if v_organisation is null then
    raise exception 'Organisation introuvable.';
  end if;
  select id into v_compte from auth.users
  where lower(email) = lower(trim(p_courriel)) and deleted_at is null
  limit 1;
  if v_compte is null then
    raise exception 'Aucun compte avec ce courriel.';
  end if;
  update employes set organisation_id = v_organisation where user_id = v_compte;
  if not found then
    raise exception 'Ce compte ne fait pas partie du personnel.';
  end if;
end $$;
revoke execute on function definir_organisation_compte(text, text) from public, anon;
grant execute on function definir_organisation_compte(text, text) to authenticated, service_role;

-- Seul un admin modifie la marque d'une organisation ; la date suit.
create or replace function organisations_date() returns trigger
language plpgsql as $$
begin
  new.modifie_le := now();
  return new;
end $$;
drop trigger if exists organisations_date on organisations;
create trigger organisations_date before update on organisations
  for each row execute function organisations_date();

-- Seul un admin modifie la marque (avant : un superviseur le pouvait aussi).
drop policy if exists organisations_admin on organisations;
create policy organisations_admin on organisations for update
  using (est_admin()) with check (est_admin());

-- La liste des comptes du personnel, pour l'espace d'administration.
create or replace function liste_comptes_personnel()
returns table (
  user_id uuid, courriel text, role role_utilisateur, poste poste_employe,
  prenom text, nom text, organisation text, equipe text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not est_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select p.id, u.email::text, p.role, p.poste, p.prenom, p.nom, o.nom, eq.nom, p.created_at
    from profils p
    join auth.users u on u.id = p.id
    left join employes e on e.user_id = p.id
    left join organisations o on o.id = e.organisation_id
    left join equipes eq on eq.compte_id = p.id
    where p.role in ('employe', 'admin') and u.deleted_at is null
    order by p.created_at desc;
end $$;
revoke execute on function liste_comptes_personnel() from public, anon;
grant execute on function liste_comptes_personnel() to authenticated, service_role;
