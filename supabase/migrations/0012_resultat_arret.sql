-- Résultat d'un arrêt : l'équipe dit si l'arrêt est fait ou non, avec un commentaire
-- (par exemple : grille brisée, à réparer). Demande la migration 0007.
-- Peut être relancée sans danger.

alter table arrets add column if not exists non_fait boolean not null default false;
alter table arrets add column if not exists commentaire text check (char_length(commentaire) <= 500);
alter table arrets add column if not exists traite_le timestamptz;

-- Un arrêt est fait, non fait, ou pas encore traité : jamais les deux à la fois.
alter table arrets drop constraint if exists arrets_resultat_coherent;
alter table arrets add constraint arrets_resultat_coherent check (not (fait and non_fait));

-- L'équipe (ou le superviseur) peut écrire le résultat de l'arrêt. La règle de 0006 limite déjà les lignes.
grant update (fait, fait_le, non_fait, commentaire, traite_le) on arrets to authenticated;

-- La publication garde le résultat et le commentaire de chaque arrêt.
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
  v_non_faits jsonb;
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

  -- Les arrêts déclarés non faits et leurs commentaires, pour ne pas les perdre au recalcul.
  select coalesce(jsonb_object_agg(cle_endroit, jsonb_build_object('commentaire', commentaire, 'traite_le', traite_le)), '{}'::jsonb)
  into v_non_faits
  from (
    select distinct on (cle_endroit) cle_endroit, commentaire, traite_le
    from arrets where non_fait order by cle_endroit, traite_le desc nulls last
  ) y;

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
      latitude, longitude, arrivee_prevue, depart_prevu, fait, fait_le,
      non_fait, commentaire, traite_le
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
      nullif(a ->> 'fait_le', '')::timestamptz,
      coalesce((a ->> 'non_fait')::boolean, false) and not coalesce((a ->> 'fait')::boolean, false),
      nullif(left(a ->> 'commentaire', 500), ''),
      nullif(a ->> 'traite_le', '')::timestamptz
    from jsonb_array_elements(t -> 'arrets') a;

    -- Tournée gardée ou recalculée en partie : ses arrêts déjà faits le restent.
    if coalesce((t ->> 'conservee')::boolean, false) or coalesce((t ->> 'recalculee')::boolean, false) then
      update arrets a
      set fait = true,
          fait_le = coalesce(a.fait_le, nullif(v_faits ->> a.cle_endroit, '')::timestamptz)
      where a.tournee_id = v_tournee and not a.fait and (v_faits -> a.cle_endroit) is not null;

      -- Même chose pour les arrêts déclarés non faits : le commentaire de l'équipe reste.
      update arrets a
      set non_fait = true,
          commentaire = coalesce(a.commentaire, v_non_faits -> a.cle_endroit ->> 'commentaire'),
          traite_le = coalesce(a.traite_le, nullif(v_non_faits -> a.cle_endroit ->> 'traite_le', '')::timestamptz)
      where a.tournee_id = v_tournee and not a.fait and not a.non_fait and (v_non_faits -> a.cle_endroit) is not null;
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
