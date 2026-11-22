import AsyncStorage from '@react-native-async-storage/async-storage';

import { ajouter, lister, marquerEchec, retirer, vider } from '../file-attente';
import { sig } from '../test-utils/fabrique';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('file-attente', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('ajoute, liste, retire et vide', async () => {
    const a = sig();
    const b = sig();
    expect(await lister()).toEqual([]);
    await ajouter({ signalement: a });
    await ajouter({ signalement: b, photoUri: 'file:///x.jpg' });
    expect((await lister()).map((e) => e.signalement.id)).toEqual([a.id, b.id]);
    await retirer(a.id);
    expect((await lister()).map((e) => e.signalement.id)).toEqual([b.id]);
    await vider();
    expect(await lister()).toEqual([]);
  });

  it('ne met pas deux fois le même signalement', async () => {
    const a = sig();
    await ajouter({ signalement: a });
    await ajouter({ signalement: a });
    expect(await lister()).toHaveLength(1);
  });

  it('ajouts et retraits simultanés : rien ne se perd', async () => {
    const base = sig();
    await ajouter({ signalement: base });
    const nouveaux = Array.from({ length: 10 }, () => sig());
    await Promise.all([retirer(base.id), ...nouveaux.map((n) => ajouter({ signalement: n }))]);
    const ids = (await lister()).map((e) => e.signalement.id).sort();
    expect(ids).toEqual(nouveaux.map((n) => n.id).sort());
  });

  it('une file abîmée lève une erreur et la valeur stockée reste intacte', async () => {
    await AsyncStorage.setItem('signalement-mtl:file', '{pas du json');
    await expect(lister()).rejects.toThrow();
    await expect(ajouter({ signalement: sig() })).rejects.toThrow();
    await expect(retirer('x')).rejects.toThrow();
    expect(await AsyncStorage.getItem('signalement-mtl:file')).toBe('{pas du json');
  });

  it('une valeur qui n’est pas une liste est refusée sans être écrasée', async () => {
    await AsyncStorage.setItem('signalement-mtl:file', '{"a":1}');
    await expect(ajouter({ signalement: sig() })).rejects.toThrow();
    expect(await AsyncStorage.getItem('signalement-mtl:file')).toBe('{"a":1}');
  });

  it('marquerEchec garde l’élément avec son motif', async () => {
    const a = sig();
    await ajouter({ signalement: a });
    await marquerEchec(a.id, 'Photo trop lourde.');
    expect((await lister())[0]).toMatchObject({ echec: 'Photo trop lourde.' });
  });
});
