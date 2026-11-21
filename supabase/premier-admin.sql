-- À lancer UNE fois dans le SQL Editor du dashboard Supabase, après avoir créé
-- le compte dans Authentication > Users > Add user (cocher "Auto Confirm User").
-- Remplacer ADMIN_EMAIL_ICI par l'email du compte (3 endroits).

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
where email = 'ADMIN_EMAIL_ICI';

update public.profils
set role = 'admin', poste = null
where id = (select id from auth.users where email = 'ADMIN_EMAIL_ICI');

-- Ligne dans employes, pour que est_employe() le reconnaisse.
insert into public.employes (user_id, nom)
select p.id, coalesce(nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''), u.email)
from public.profils p join auth.users u on u.id = p.id
where u.email = 'ADMIN_EMAIL_ICI'
on conflict do nothing;

select u.email, p.role, (e.user_id is not null) as dans_employes
from auth.users u
join public.profils p on p.id = u.id
left join public.employes e on e.user_id = u.id
where u.email = 'ADMIN_EMAIL_ICI';
