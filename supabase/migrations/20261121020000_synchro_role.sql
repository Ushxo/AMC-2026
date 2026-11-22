-- Synchronise le rôle et le poste du profil avec app_metadata.
--
-- auth.admin.createUser (utilisé par la fonction creer-utilisateur) crée le
-- compte en deux écritures : d'abord avec un app_metadata par défaut, puis
-- une mise à jour qui ajoute role et poste. Le trigger d'insertion voit donc
-- un citoyen ; celui-ci rattrape la mise à jour.
-- Seul le serveur (clé service_role) peut écrire app_metadata : un
-- utilisateur ne peut pas s'en servir pour changer son propre rôle.

create function public.synchro_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  public.role_utilisateur :=
    coalesce((new.raw_app_meta_data ->> 'role')::public.role_utilisateur, 'citoyen');
  v_poste public.poste_employe :=
    case when v_role = 'employe'
         then (new.raw_app_meta_data ->> 'poste')::public.poste_employe end;
begin
  update public.profils
  set role = v_role, poste = v_poste
  where id = new.id
    and (role is distinct from v_role or poste is distinct from v_poste);

  if v_role in ('employe', 'admin') then
    insert into public.employes (user_id, nom)
    select p.id, coalesce(nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''), new.email)
    from public.profils p
    where p.id = new.id
    on conflict do nothing;
  else
    delete from public.employes where user_id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.synchro_role() from public, anon, authenticated;

create trigger a_la_modification_du_role
  after update of raw_app_meta_data on auth.users
  for each row
  when (
    (old.raw_app_meta_data ->> 'role') is distinct from (new.raw_app_meta_data ->> 'role')
    or (old.raw_app_meta_data ->> 'poste') is distinct from (new.raw_app_meta_data ->> 'poste')
  )
  execute function public.synchro_role();

-- Rattrapage des comptes déjà créés par la fonction avec le mauvais rôle.
update public.profils p
set role  = (u.raw_app_meta_data ->> 'role')::public.role_utilisateur,
    poste = case when u.raw_app_meta_data ->> 'role' = 'employe'
                 then (u.raw_app_meta_data ->> 'poste')::public.poste_employe end
from auth.users u
where u.id = p.id
  and u.raw_app_meta_data ->> 'role' in ('citoyen', 'employe', 'admin')
  and p.role is distinct from (u.raw_app_meta_data ->> 'role')::public.role_utilisateur;

insert into public.employes (user_id, nom)
select p.id, coalesce(nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''), u.email)
from public.profils p
join auth.users u on u.id = p.id
where p.role in ('employe', 'admin')
on conflict do nothing;
