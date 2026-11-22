import {
  abonnerBrouillon,
  DUREE_BROUILLON_MS,
  DUREE_DEMANDE_FEUILLE_MS,
  ecrireBrouillon,
  lireBrouillon,
  viderBrouillon,
} from '../brouillon-signalement';

describe('brouillon du signalement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    viderBrouillon();
  });
  afterEach(() => jest.useRealTimers());

  it('part vide, garde ce qu’on écrit et le rend tel quel', () => {
    expect(lireBrouillon()).toMatchObject({ feuilleOuverte: false, categorie: null, photoUri: null, commentaire: '' });
    ecrireBrouillon({ categorie: 'grille_bouchee', lieu: { latitude: 45.5, longitude: -73.57 }, photoUri: 'file:///p.jpg', commentaire: 'depuis hier' });
    ecrireBrouillon({ feuilleOuverte: true });
    expect(lireBrouillon()).toMatchObject({
      feuilleOuverte: true,
      categorie: 'grille_bouchee',
      lieu: { latitude: 45.5, longitude: -73.57 },
      photoUri: 'file:///p.jpg',
      commentaire: 'depuis hier',
    });
  });

  it('notifie les abonnés seulement quand une valeur change, et plus après le désabonnement', () => {
    const f = jest.fn();
    const arret = abonnerBrouillon(f);
    ecrireBrouillon({ commentaire: 'a' });
    ecrireBrouillon({ commentaire: 'a' });
    const avant = lireBrouillon();
    ecrireBrouillon({ lieu: null });
    expect(lireBrouillon()).toBe(avant);
    expect(f).toHaveBeenCalledTimes(1);
    arret();
    ecrireBrouillon({ commentaire: 'b' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('vider remet tout à zéro', () => {
    ecrireBrouillon({ categorie: 'grille_bouchee', photoUri: 'file:///p.jpg', feuilleOuverte: true });
    viderBrouillon();
    expect(lireBrouillon()).toMatchObject({ feuilleOuverte: false, categorie: null, photoUri: null });
  });

  it('un brouillon trop vieux est oublié', () => {
    ecrireBrouillon({ categorie: 'grille_bouchee', photoUri: 'file:///p.jpg' });
    jest.advanceTimersByTime(DUREE_BROUILLON_MS + 1000);
    expect(lireBrouillon().categorie).toBeNull();
    expect(lireBrouillon().photoUri).toBeNull();
  });

  it('une demande de rouvrir la feuille que personne n’a prise tombe vite (la carte n’était pas là)', () => {
    ecrireBrouillon({ categorie: 'grille_bouchee', photoUri: 'file:///p.jpg', feuilleOuverte: true });
    expect(lireBrouillon().feuilleOuverte).toBe(true);
    jest.advanceTimersByTime(DUREE_DEMANDE_FEUILLE_MS + 100);
    expect(lireBrouillon().feuilleOuverte).toBe(false);
    expect(lireBrouillon().photoUri).toBe('file:///p.jpg'); // le reste du brouillon est gardé
    ecrireBrouillon({ feuilleOuverte: true });
    expect(lireBrouillon().feuilleOuverte).toBe(true);
  });
});
