-- Rapport de l'employé : à chaque arrêt, le responsable d'équipe dit si le problème est réglé
-- (sinon un commentaire est obligatoire), puis le rapport de la tournée est envoyé au superviseur.
-- Demande les migrations 0002 et 0006. Peut être relancée sans danger.

-- Évaluation d'un arrêt, faite sur place. « fait » garde son sens : l'arrêt est réglé et ses signalements aussi.
alter table arrets add column if not exists regle boolean;
alter table arrets add column if not exists commentaire text;
alter table arrets add column if not exists evalue_le timestamptz;

alter table arrets drop constraint if exists arrets_commentaire_longueur;
alter table arrets add constraint arrets_commentaire_longueur
  check (commentaire is null or char_length(commentaire) <= 500);

-- « Pas réglé » demande un commentaire.
alter table arrets drop constraint if exists arrets_commentaire_si_non_regle;
alter table arrets add constraint arrets_commentaire_si_non_regle
  check (regle is distinct from false or char_length(coalesce(trim(commentaire), '')) > 0);

-- Moment où le rapport de la tournée a été envoyé au superviseur.
alter table tournees add column if not exists rapport_envoye_le timestamptz;

-- Envoi du rapport : seulement par le compte de l'équipe de cette tournée, ou par un superviseur.
-- (Les arrêts sont déjà modifiables par ces mêmes comptes : politique arrets_modification de la migration 0006.)
create or replace function envoyer_rapport(p_tournee uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_maintenant timestamptz := now();
begin
  if not (
    est_superviseur()
    or exists (
      select 1 from tournees t join equipes e on e.id = t.equipe_id
      where t.id = p_tournee and e.compte_id = auth.uid()
    )
  ) then
    raise exception 'Seul le compte de l''équipe ou un superviseur peut envoyer ce rapport.';
  end if;

  update tournees set rapport_envoye_le = v_maintenant where id = p_tournee;
  if not found then
    raise exception 'Tournée introuvable.';
  end if;
  return v_maintenant;
end $$;

revoke all on function envoyer_rapport(uuid) from public;
grant execute on function envoyer_rapport(uuid) to authenticated;
