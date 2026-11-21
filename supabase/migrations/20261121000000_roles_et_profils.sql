-- Rôles des utilisateurs et profils.
-- Le login lui-même passe par Supabase Auth (email + mot de passe) ; cette
-- migration ajoute le rôle de chaque compte et les règles d'accès.

create type public.role_utilisateur as enum ('citoyen', 'employe', 'admin');

-- Type d'employé. Pour en ajouter un : alter type public.poste_employe add value '...';
create type public.poste_employe as enum ('superviseur', 'commis');

create table public.profils (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.role_utilisateur not null default 'citoyen',
  poste      public.poste_employe,
  prenom     text,
  nom        text,
  created_at timestamptz not null default now(),
  -- Un employé a toujours un poste ; les citoyens et admins n'en ont pas.
  constraint poste_si_employe check ((role = 'employe') = (poste is not null))
);

alter table public.profils enable row level security;

-- Rôle de l'utilisateur connecté. security definer pour que les politiques
-- RLS puissent l'appeler sans boucler sur elles-mêmes.
create function public.mon_role()
returns public.role_utilisateur
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profils where id = auth.uid();
$$;

-- Profil de l'utilisateur connecté, pour l'app après le login.
create function public.mon_profil()
returns public.profils
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.profils where id = auth.uid();
$$;

-- Création automatique du profil à chaque nouveau compte.
-- Le rôle vient uniquement de app_metadata, que seul le serveur (clé
-- service_role) peut écrire. Une inscription publique (signUp) n'y a pas
-- accès : elle donne donc toujours un citoyen, même si le client envoie
-- un rôle dans ses métadonnées.
create function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (id, role, poste, prenom, nom)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.role_utilisateur, 'citoyen'),
    (new.raw_app_meta_data ->> 'poste')::public.poste_employe,
    new.raw_user_meta_data ->> 'prenom',
    new.raw_user_meta_data ->> 'nom'
  );
  return new;
end;
$$;

create trigger a_la_creation_du_compte
  after insert on auth.users
  for each row execute function public.creer_profil();

-- Lecture : chacun voit son profil, un admin voit tous les profils.
create policy "lire son profil"
  on public.profils for select
  to authenticated
  using (id = (select auth.uid()));

create policy "admin lit tous les profils"
  on public.profils for select
  to authenticated
  using ((select public.mon_role()) = 'admin');

-- Modification : chacun peut changer son prénom et son nom, jamais son rôle ni son poste.
create policy "modifier son profil"
  on public.profils for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profils from anon, authenticated;
grant select on public.profils to authenticated;
grant update (prenom, nom) on public.profils to authenticated;

revoke execute on function public.mon_role() from public, anon;
revoke execute on function public.mon_profil() from public, anon;
revoke execute on function public.creer_profil() from public, anon, authenticated;
grant execute on function public.mon_role() to authenticated;
grant execute on function public.mon_profil() to authenticated;
