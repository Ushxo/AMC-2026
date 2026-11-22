import { regrouper } from '../gravite';
import { chargerSignalementsDemo } from '../officiel';

describe('données de démonstration et seuil photo', () => {
  it('aucun champ photo_verifiee : tous les endroits restent confirmés', () => {
    const endroits = regrouper(chargerSignalementsDemo());
    expect(endroits.length).toBeGreaterThan(0);
    expect(endroits.every((e) => e.confirme === true)).toBe(true);
  });
});
