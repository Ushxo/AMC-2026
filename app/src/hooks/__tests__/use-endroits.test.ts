import { renderHook } from '@testing-library/react-native';

import { sig } from '../../lib/test-utils/fabrique';
import { useEndroits } from '../use-endroits';

const mockListe = [
  sig({ grille_id: 'a', photo_verifiee: false }),
  sig({ grille_id: 'b', photo_verifiee: true }),
  sig({ grille_id: 'c' }),
];
jest.mock('../use-signalements', () => ({
  useSignalements: () => ({ signalements: mockListe, chargement: false, erreur: null, rafraichir: async () => {} }),
}));

describe('useEndroits : seuil selon la photo', () => {
  it('par défaut, rend seulement les endroits confirmés', async () => {
    const { result } = await renderHook(() => useEndroits());
    expect(result.current.endroits.map((e) => e.cle).sort()).toEqual(['grille:b', 'grille:c']);
  });
  it('avec tout: true, rend aussi les endroits non confirmés', async () => {
    const { result } = await renderHook(() => useEndroits(undefined, { tout: true }));
    expect(result.current.endroits).toHaveLength(3);
  });
});
