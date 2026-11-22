import { libelleResteCourt, MARGE_HAUTE_PANNEAU, RECOUVREMENT_PANNEAU, reglagesVueNavigation } from '../disposition-navigation';
import { formaterDuree } from '../interventions';

describe('disposition de la navigation', () => {
  it('le panneau est sous la carte : seuls ses coins arrondis (30) mordent sur elle, aucune marge de carte n’est demandée au SDK', () => {
    expect(RECOUVREMENT_PANNEAU).toBe(30);
    expect(MARGE_HAUTE_PANNEAU).toBe(-30);
    expect(reglagesVueNavigation(false).mapPadding).toEqual({ top: 0, left: 0, right: 0, bottom: 0 });
    expect(reglagesVueNavigation(true).mapPadding).toEqual({ top: 0, left: 0, right: 0, bottom: 0 });
  });

  it('la boussole est d’abord déclarée visible puis masquée une fois la carte prête (sinon aucun appel natif ne la masque)', () => {
    const avant = reglagesVueNavigation(false);
    const apres = reglagesVueNavigation(true);
    expect(avant.compassEnabled).toBe(true);
    expect(apres.compassEnabled).toBe(false);
    expect(avant.compassEnabled).not.toBe(apres.compassEnabled); // un changement de valeur : l'appel natif a lieu
  });

  it('pied, barre de progression, vitesse, limite, messages de circulation masqués ; recentrage de Google gardé', () => {
    const r = reglagesVueNavigation(true);
    expect([r.footerEnabled, r.tripProgressBarEnabled, r.speedometerEnabled, r.speedLimitIconEnabled, r.trafficPromptsEnabled, r.trafficIncidentCardsEnabled, r.reportIncidentButtonEnabled]).toEqual(Array(7).fill(false));
    expect(r.recenterButtonEnabled).toBe(true);
  });

  it('« reste 6 h 21 » : court, sans « estimé » ni nombre d’arrêts', () => {
    expect(libelleResteCourt(6 * 3600 + 21 * 60, formaterDuree)).toBe('reste 6 h 21');
    expect(libelleResteCourt(18 * 60, formaterDuree)).toBe('reste 18 min');
  });
});
