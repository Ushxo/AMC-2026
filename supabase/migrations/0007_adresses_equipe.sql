-- Adresse de départ (le garage) et adresse d'arrivée de chaque équipe, choisies par le superviseur.
-- Sans adresse d'arrivée, l'équipe revient à son garage. Demande la migration 0006.
-- Peut être relancée sans danger.

alter table equipes add column if not exists garage_adresse text check (char_length(garage_adresse) <= 160);
alter table equipes add column if not exists arrivee_nom text check (char_length(arrivee_nom) <= 80);
alter table equipes add column if not exists arrivee_adresse text check (char_length(arrivee_adresse) <= 160);
alter table equipes add column if not exists arrivee_latitude double precision
  check (arrivee_latitude is null or arrivee_latitude between 45.40 and 45.71);
alter table equipes add column if not exists arrivee_longitude double precision
  check (arrivee_longitude is null or arrivee_longitude between -73.98 and -73.47);

-- Les deux coordonnées d'arrivée vont ensemble.
alter table equipes drop constraint if exists equipes_arrivee_complete;
alter table equipes add constraint equipes_arrivee_complete
  check ((arrivee_latitude is null) = (arrivee_longitude is null));

-- La publication garde aussi le nom de l'adresse d'arrivée de chaque tournée.
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
        'fin_nom', t -> 'fin_nom',
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
