-- Rôles : citoyen, employé, superviseur, admin (maintenance), lus dans la table profils.
-- Un superviseur est un profil « employe » dont le poste est « superviseur »,
-- ou un profil dont le rôle est « superviseur » si ce rôle est ajouté plus tard.
-- La table employes reste acceptée pour les comptes de démo créés avant les profils :
-- ces comptes ont les droits d'un superviseur.

-- Employé au sens large : employé, superviseur ou admin. Lit les équipes et les tournées,
-- change l'état d'un signalement, marque un arrêt comme fait.
create or replace function est_employe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profils
    where id = auth.uid() and role::text in ('employe', 'superviseur', 'admin')
  ) or exists (
    select 1 from employes where user_id = auth.uid()
  );
$$;

-- Superviseur ou admin : gère les équipes, lance l'optimisation, ajoute un incident.
create or replace function est_superviseur() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profils
    where id = auth.uid()
      and (
        role::text in ('superviseur', 'admin')
        or (role::text = 'employe' and poste::text = 'superviseur')
      )
  ) or exists (
    select 1 from employes where user_id = auth.uid()
  );
$$;

-- Admin : s'occupe de la maintenance. L'organisation (nom de l'app, logo, couleurs)
-- est modifiable par l'admin et par le superviseur.
create or replace function est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profils where id = auth.uid() and role::text = 'admin');
$$;

drop policy equipes_employe_creation on equipes;
drop policy equipes_employe_modification on equipes;
create policy equipes_superviseur_creation on equipes for insert with check (est_superviseur());
create policy equipes_superviseur_modification on equipes for update
  using (est_superviseur()) with check (est_superviseur());

drop policy incidents_creation on incidents;
drop policy incidents_modification on incidents;
create policy incidents_creation on incidents for insert with check (est_superviseur() and simule);
create policy incidents_modification on incidents for update
  using (est_superviseur()) with check (est_superviseur());

drop policy demandes_creation on demandes_optimisation;
create policy demandes_creation on demandes_optimisation for insert
  with check (est_superviseur() and statut = 'en_attente');

drop policy organisations_employe on organisations;
create policy organisations_admin on organisations for update
  using (est_admin() or est_superviseur()) with check (est_admin() or est_superviseur());

-- L'organisation par défaut : sans elle, l'app n'a ni nom ni thème à lire.
insert into organisations (nom, nom_app, theme_defaut)
select 'Ville de Montréal', 'Signalement MTL', 'montreal'
where not exists (select 1 from organisations);

-- Compte superviseur de démo : à faire à la main, une fois le compte créé par l'écran de connexion.
-- update profils set role = 'employe', poste = 'superviseur' where id = '<identifiant du compte>';
