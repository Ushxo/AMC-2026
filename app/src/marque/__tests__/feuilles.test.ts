import { FEUILLE_BASE, VOILE_FEUILLE } from '@/components/ville/style';

describe('feuilles du bas', () => {
  it('coins du haut au rayon 30, contenu coupé, voile sombre uniforme', () => {
    expect(FEUILLE_BASE).toEqual({ borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' });
    expect(VOILE_FEUILLE).toBe('rgba(0,0,0,0.4)');
  });
});
