-- Départ et fin de chaque tournée, arrêts déjà faits gardés à la republication d'un plan,
-- et droits du compte d'une équipe sur sa propre tournée. Demande les migrations 0004 et 0005.
-- Peut être relancée sans danger.

-- D'où part et où finit la tournée, et si elle vient d'un recalcul partiel.
alter table tournees add column if not exists details jsonb not null default '{}'::jsonb;

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
  v_faits jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Réservé au service de calcul.';
  end if;

  perform 1 from demandes_optimisation where id = p_demande and statut = 'en_cours' for update;
  if not found then
    raise exception 'La demande n''est plus en cours.';
  end if;

  -- Les arrêts déjà faits au moment de publier : une validation reçue pendant le calcul n'est pas perdue.
  select coalesce(jsonb_object_agg(cle_endroit, fait_le), '{}'::jsonb) into v_faits
  from (select cle_endroit, max(fait_le) as fait_le from arrets where fait group by cle_endroit) x;

  delete from tournees where true;

  for t in select * from jsonb_array_elements(p_tournees) loop
    insert into tournees (demande_id, equipe_id, distance_m, duree_s, debut_prevu, fin_prevue, geometrie, details)
    values (
      p_demande,
      (t ->> 'equipe_id')::uuid,
      (t ->> 'distance_m')::integer,
      (t ->> 'duree_s')::integer,
      (t ->> 'debut_prevu')::timestamptz,
      (t ->> 'fin_prevue')::timestamptz,
      nullif(t -> 'geometrie', 'null'::jsonb),
      jsonb_strip_nulls(jsonb_build_object(
        'depart', t -> 'depart',
        'depart_position', t -> 'depart_position',
        'fin', t -> 'fin',
        'fin_position', t -> 'fin_position',
        'conservee', t -> 'conservee',
        'recalculee', t -> 'recalculee',
        'faits_conserves', t -> 'faits_conserves'
      ))
    )
    returning id into v_tournee;

    insert into arrets (
      tournee_id, demande_id, rang, cle_endroit, signalement_ids,
      latitude, longitude, arrivee_prevue, depart_prevu, fait, fait_le
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
      (a ->> 'depart_prevu')::timestamptz,
      coalesce((a ->> 'fait')::boolean, false),
      nullif(a ->> 'fait_le', '')::timestamptz
    from jsonb_array_elements(t -> 'arrets') a;

    -- Tournée gardée ou recalculée en partie : ses arrêts déjà faits le restent.
    if coalesce((t ->> 'conservee')::boolean, false) or coalesce((t ->> 'recalculee')::boolean, false) then
      update arrets a
      set fait = true,
          fait_le = coalesce(a.fait_le, nullif(v_faits ->> a.cle_endroit, '')::timestamptz)
      where a.tournee_id = v_tournee and not a.fait and (v_faits -> a.cle_endroit) is not null;
    end if;
  end loop;

  update demandes_optimisation
  set statut = 'terminee',
      comparaison = p_comparaison,
      non_servis = coalesce(p_non_servis, '[]'::jsonb),
      source_matrice = p_source_matrice,
      termine_le = now()
  where id = p_demande;
end $$;

-- Le compte d'une équipe peut demander le recalcul de SA tournée, et de celle-là seulement.
drop policy if exists demandes_creation_equipe on demandes_optimisation;
create policy demandes_creation_equipe on demandes_optimisation for insert
  with check (
    statut = 'en_attente'
    and mon_equipe() is not null
    and parametres -> 'equipe_ids' = jsonb_build_array(mon_equipe()::text)
    and parametres ->> 'recalcul' = 'tournee'
  );

-- Un arrêt n'est marqué fait que par un superviseur ou par le compte de l'équipe qui a cette tournée.
drop policy if exists arrets_modification on arrets;
create policy arrets_modification on arrets for update
  using (
    est_superviseur()
    or exists (
      select 1 from tournees t join equipes e on e.id = t.equipe_id
      where t.id = arrets.tournee_id and e.compte_id = auth.uid()
    )
  )
  with check (
    est_superviseur()
    or exists (
      select 1 from tournees t join equipes e on e.id = t.equipe_id
      where t.id = arrets.tournee_id and e.compte_id = auth.uid()
    )
  );
