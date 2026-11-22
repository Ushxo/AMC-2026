import { poserRepere } from '../implementation-google';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('pose d’un repère sur la carte Google', () => {
  it('une image absente de la build : le repère est posé avec le repère par défaut, sans promesse rejetée', async () => {
    const addMarker = jest.fn().mockRejectedValueOnce(new Error('Failed to load image from the provided path')).mockResolvedValueOnce({});
    poserRepere({ addMarker } as never, { id: 'r:1', position: { lat: 45.5, lng: -73.57 }, imgPath: 'info_chantier' });
    await new Promise((r) => setTimeout(r, 0));
    expect(addMarker).toHaveBeenCalledTimes(2);
    expect(addMarker.mock.calls[0][0].imgPath).toBe('info_chantier');
    expect(addMarker.mock.calls[1][0]).toEqual({ id: 'r:1', position: { lat: 45.5, lng: -73.57 } });
  });

  it('un échec définitif est avalé (rien ne remonte)', async () => {
    const addMarker = jest.fn().mockRejectedValue(new Error('carte détruite'));
    expect(() => poserRepere({ addMarker } as never, { id: 'r:2', position: { lat: 0, lng: 0 } })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(addMarker).toHaveBeenCalledTimes(2);
  });
});
