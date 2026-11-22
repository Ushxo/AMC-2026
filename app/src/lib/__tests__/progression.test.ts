import {
  calculerFraction,
  DUREE_ATTENDUE_MS,
  etapeDepuisStatut,
  FRACTION_MAX_AVANT_FIN,
  LIBELLES_ETAPE,
} from '../progression';

describe('progression du calcul', () => {
  it('les étapes viennent du statut réel de la demande', () => {
    expect(etapeDepuisStatut(null, { envoi: true })).toBe('envoi');
    expect(etapeDepuisStatut('en_attente')).toBe('en_attente');
    expect(etapeDepuisStatut('en_cours')).toBe('en_cours');
    expect(etapeDepuisStatut('terminee')).toBe('terminee');
    expect(etapeDepuisStatut('terminee', { tracesEnAttente: true })).toBe('trace');
    expect(etapeDepuisStatut('echec')).toBe('echec');
    expect(etapeDepuisStatut('en_cours', { precalcule: true })).toBe('precalcule');
  });

  it('les libellés sont ceux de la maquette', () => {
    expect(LIBELLES_ETAPE.en_attente).toBe('Demande envoyée');
    expect(LIBELLES_ETAPE.en_cours).toBe('Calcul en cours');
    expect(LIBELLES_ETAPE.terminee).toBe('Tournées prêtes');
    expect(LIBELLES_ETAPE.trace).toBe('Tracé des rues');
  });

  it('la fraction avance avec le temps et ne dépasse jamais 0,95 avant le vrai résultat', () => {
    expect(calculerFraction('en_cours', 0)).toBe(0);
    const milieu = calculerFraction('en_cours', DUREE_ATTENDUE_MS / 2);
    expect(milieu).toBeGreaterThan(0.4);
    expect(milieu).toBeLessThan(0.5);
    expect(calculerFraction('en_cours', DUREE_ATTENDUE_MS * 10)).toBe(FRACTION_MAX_AVANT_FIN);
    expect(calculerFraction('en_attente', 999999)).toBeLessThan(1);
    expect(calculerFraction('en_cours', -50)).toBe(0);
  });

  it('seule la fin réelle donne 100 %', () => {
    expect(calculerFraction('terminee', 0)).toBe(1);
    expect(calculerFraction('echec', 5000)).toBe(0);
  });
});
