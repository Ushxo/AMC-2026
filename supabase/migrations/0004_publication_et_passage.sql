-- Publication des tournées en une transaction, réservation d'une demande, passage d'un
-- signalement pour le citoyen. Le profil a priorité sur la table employes.
-- Peut être relancée sans danger.

-- Le profil décide. La table employes ne sert que pour un compte qui n'a aucun profil.
create or replace function est_employe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profils
    where id = auth.uid() and role::text in ('employe', 'superviseur', 'admin')
  ) or (
    not exists (select 1 from profils where id = auth.uid())
    and exists (select 1 from employes where user_id = auth.uid())
  );
$$;

create or replace function est_superviseur() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profils
    where id = auth.uid()
      and (
        role::text in ('superviseur', 'admin')
        or (role::text = 'employe' and poste::text = 'superviseur')
      )
  ) or (
    not exists (select 1 from profils where id = auth.uid())
    and exists (select 1 from employes where user_id = auth.uid())
  );
$$;

-- Les arrêts ne sont plus lisibles par tous : ils donnent le plan de passage des équipes.
-- Les employés les lisent ; le citoyen demande seulement le passage de son signalement.
drop policy if exists arrets_lecture on arrets;
drop policy if exists arrets_lecture_employe on arrets;
create policy arrets_lecture_employe on arrets for select using (est_employe());

create or replace function passage_signalement(p_signalement uuid)
returns table (rang integer, arrivee_prevue timestamptz, depart_prevu timestamptz, fait boolean, fait_le timestamptz)
language sql stable security definer set search_path = public as $$
  select a.rang, a.arrivee_prevue, a.depart_prevu, a.fait, a.fait_le
  from arrets a
  where a.signalement_ids @> array[p_signalement]
  order by a.arrivee_prevue desc
  limit 1;
$$;
revoke execute on function passage_signalement(uuid) from public;
grant execute on function passage_signalement(uuid) to anon, authenticated, service_role;

-- Le service de calcul réserve une demande à la fois. Une demande restée « en_cours » plus de
-- deux minutes (service arrêté en plein calcul) est remise en attente. Les demandes en attente
-- plus anciennes que la plus récente sont remplacées.
create or replace function reserver_demande() returns setof demandes_optimisation
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Réservé au service de calcul.';
  end if;

  update demandes_optimisation
  set statut = 'en_attente', commence_le = null
  where statut = 'en_cours' and commence_le < now() - interval '2 minutes';

  select id into v_id
  from demandes_optimisation
  where statut = 'en_attente'
  order by cree_le desc
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  update demandes_optimisation
  set statut = 'remplacee', termine_le = now()
  where statut = 'en_attente' and id <> v_id;

  return query
  update demandes_optimisation
  set statut = 'en_cours', commence_le = now()
  where id = v_id
  returning *;
end $$;
revoke execute on function reserver_demande() from public, anon, authenticated;
grant execute on function reserver_demande() to service_role;

-- Publication d'un résultat en une seule transaction : les anciennes tournées sont effacées,
-- les nouvelles écrites et la demande terminée, ou rien ne change. L'ancien plan reste donc
-- visible si l'écriture échoue.
create or replace function publier_tournees(
  p_demande uuid,
  p_tournees jsonb,
  p_comparaison jsonb,
  p_non_servis jsonb,
  p_source_matrice text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  t jsonb;
  v_tournee uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Réservé au service de calcul.';
  end if;

  perform 1 from demandes_optimisation where id = p_demande and statut = 'en_cours' for update;
  if not found then
    raise exception 'La demande n''est plus en cours.';
  end if;

  delete from tournees where true;

  for t in select * from jsonb_array_elements(p_tournees) loop
    insert into tournees (demande_id, equipe_id, distance_m, duree_s, debut_prevu, fin_prevue, geometrie)
    values (
      p_demande,
      (t ->> 'equipe_id')::uuid,
      (t ->> 'distance_m')::integer,
      (t ->> 'duree_s')::integer,
      (t ->> 'debut_prevu')::timestamptz,
      (t ->> 'fin_prevue')::timestamptz,
      nullif(t -> 'geometrie', 'null'::jsonb)
    )
    returning id into v_tournee;

    insert into arrets (
      tournee_id, demande_id, rang, cle_endroit, signalement_ids,
      latitude, longitude, arrivee_prevue, depart_prevu
    )
    select
      v_tournee,
      p_demande,
      (a ->> 'rang')::integer,
      a ->> 'cle_endroit',
      array(select jsonb_array_elements_text(a -> 'signalement_ids'))::uuid[],
      (a -> 'position' ->> 'latitude')::double precision,
      (a -> 'position' ->> 'longitude')::double precision,
      (a ->> 'arrivee_prevue')::timestamptz,
      (a ->> 'depart_prevu')::timestamptz
    from jsonb_array_elements(t -> 'arrets') a;
  end loop;

  update demandes_optimisation
  set statut = 'terminee',
      comparaison = p_comparaison,
      non_servis = coalesce(p_non_servis, '[]'::jsonb),
      source_matrice = p_source_matrice,
      termine_le = now()
  where id = p_demande;
end $$;
revoke execute on function publier_tournees(uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function publier_tournees(uuid, jsonb, jsonb, jsonb, text) to service_role;
