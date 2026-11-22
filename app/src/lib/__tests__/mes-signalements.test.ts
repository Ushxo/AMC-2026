import AsyncStorage from '@react-native-async-storage/async-storage';

import { abonnerMesIds, ajouterMonId, lireMesIds, mesIdsNonGardes, reinitialiserMesIds } from '../mes-signalements';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('mes signalements', () => {
  beforeEach(async () => {
    reinitialiserMesIds();
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

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

  it('stockage qui refuse l’écriture : le signalement reste dans « Mes alertes » pendant la session, et on le dit', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('plein'));
    await ajouterMonId('x');
    expect(await lireMesIds()).toEqual(['x']);
    expect(mesIdsNonGardes()).toBe(true);
  });

  it('stockage illisible : seul ce qui est en mémoire est listé, rien ne casse', async () => {
    await ajouterMonId('a');
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('illisible'));
    expect(await lireMesIds()).toEqual(['a']);
  });

  it('quand le stockage remarche, l’avertissement tombe', async () => {
    const espion = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('plein'));
    await ajouterMonId('x');
    expect(mesIdsNonGardes()).toBe(true);
    espion.mockRestore();
    await ajouterMonId('y');
    expect(mesIdsNonGardes()).toBe(false);
    expect(await lireMesIds()).toEqual(['y', 'x']);
  });
});
