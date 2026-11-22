-- Lien avec la table public.employes (user_id, nom).
-- Les règles d'accès des autres tables passent par public.est_employe(), qui
-- regarde si l'utilisateur a une ligne dans employes. Un compte employé ou
-- admin doit donc y avoir sa ligne, sinon il ne peut rien faire dans l'app.

create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  public.role_utilisateur :=
    coalesce((new.raw_app_meta_data ->> 'role')::public.role_utilisateur, 'citoyen');
  v_prenom text := new.raw_user_meta_data ->> 'prenom';
  v_nom    text := new.raw_user_meta_data ->> 'nom';
begin
  insert into public.profils (id, role, poste, prenom, nom)
  values (
    new.id,
    v_role,
    (new.raw_app_meta_data ->> 'poste')::public.poste_employe,
    v_prenom,
    v_nom
  );

  if v_role in ('employe', 'admin') then
    insert into public.employes (user_id, nom)
    values (
      new.id,
      coalesce(nullif(trim(concat_ws(' ', v_prenom, v_nom)), ''), new.email)
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- Rattrapage : employés et admins déjà créés sans ligne dans employes.
insert into public.employes (user_id, nom)
select p.id, coalesce(nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''), u.email)
from public.profils p
join auth.users u on u.id = p.id
where p.role in ('employe', 'admin')
  and not exists (select 1 from public.employes e where e.user_id = p.id);
