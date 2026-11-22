import { abonnerMesIds, ajouterMonId, lireMesIds } from '../mes-signalements';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('mes signalements', () => {
  it('garde les identifiants créés depuis ce téléphone, le plus récent en premier, sans doublon', async () => {
    expect(await lireMesIds()).toEqual([]);
    await ajouterMonId('a');
    await ajouterMonId('b');
    await ajouterMonId('a');
    expect(await lireMesIds()).toEqual(['a', 'b']);
  });

  it('prévient les écrans quand un identifiant est ajouté', async () => {
    const f = jest.fn();
    const arret = abonnerMesIds(f);
    await ajouterMonId('c');
    expect(f).toHaveBeenCalled();
    arret();
  });
});
