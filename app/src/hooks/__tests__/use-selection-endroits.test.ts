import { act, renderHook } from '@testing-library/react-native';

import type { Endroit, Gravite } from '../../types';
import { useSelectionEndroits } from '../use-selection-endroits';

function e(cle: string, gravite: Gravite, nombre = 1): Endroit {
  return {
    cle, position: { latitude: 45.5, longitude: -73.56 }, nombre, gravite_choisie_max: gravite,
    gravite_par_nombre: 'faible', gravite_affichee: gravite, etat_dominant: 'nouveau', signalements: [],
  };
}

const liste = [e('a', 'elevee'), e('b', 'elevee'), e('c', 'moyenne'), e('d', 'faible')];

describe('useSelectionEndroits', () => {
  it('par défaut tout est sélectionné ; les actions modifient la sélection', async () => {
    const { result } = await renderHook(() => useSelectionEndroits(liste));
    expect(result.current.nombre).toBe(4);
    expect(result.current.estChoisi('a')).toBe(true);

    await act(async () => result.current.vider());
    expect(result.current.nombre).toBe(0);

    await act(async () => result.current.choisirGravite('elevee'));
    expect(result.current.cles.sort()).toEqual(['a', 'b']);

    await act(async () => result.current.basculer('c'));
    expect(result.current.estChoisi('c')).toBe(true);
    await act(async () => result.current.basculer('a'));
    expect(result.current.estChoisi('a')).toBe(false);

    await act(async () => result.current.toutes());
    expect(result.current.nombre).toBe(4);
  });

  it('les endroits qui disparaissent sortent de la sélection', async () => {
    const { result, rerender } = await renderHook(({ l }: { l: Endroit[] }) => useSelectionEndroits(l), {
      initialProps: { l: liste },
    });
    await act(async () => result.current.vider());
    await act(async () => result.current.basculer('a'));
    await rerender({ l: liste.filter((x) => x.cle !== 'a') });
    expect(result.current.cles).toEqual([]);
  });
});
