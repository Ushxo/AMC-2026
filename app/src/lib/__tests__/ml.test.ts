jest.mock('expo-file-system', () => ({
  // Comme le vrai File d'expo-file-system, c'est un Blob.
  File: class FauxFichier extends Blob {
    uri: string;
    constructor(chemin: string) {
      if (chemin.includes('introuvable')) throw new Error('fichier introuvable');
      super(['octets de la photo'], { type: 'image/jpeg' });
      this.uri = chemin;
    }
  },
}));

const RESULTAT = {
  valide: true,
  probabilite_valide: 98,
  score_gravite: 87,
  gravite: 'elevee',
  probabilites: { invalide: 2, faible: 3, moyenne: 20, elevee: 75 },
};

function charger(url: string | undefined, cle?: string) {
  jest.resetModules();
  if (url === undefined) delete process.env.EXPO_PUBLIC_ML_URL;
  else process.env.EXPO_PUBLIC_ML_URL = url;
  if (cle === undefined) delete process.env.EXPO_PUBLIC_ML_CLE;
  else process.env.EXPO_PUBLIC_ML_CLE = cle;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- rechargement du module après avoir changé l’env
  return require('../ml') as typeof import('../ml');
}

beforeEach(() => {
  globalThis.fetch = jest.fn();
});

describe('jugerPhoto', () => {
  it('envoie la photo en multipart sur /juger et renvoie le résultat', async () => {
    const { jugerPhoto } = charger('https://ml.example.com/');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => RESULTAT });

    await expect(jugerPhoto('file:///photo.jpg')).resolves.toEqual(RESULTAT);
    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://ml.example.com/juger');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('envoie la clé d’accès dans l’en-tête X-Cle-API', async () => {
    const { jugerPhoto } = charger('https://ml.example.com', 'secret');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => RESULTAT });

    await jugerPhoto('file:///photo.jpg');
    expect((globalThis.fetch as jest.Mock).mock.calls[0][1].headers).toEqual({ 'X-Cle-API': 'secret' });
  });

  it('dit quoi vérifier quand le serveur refuse la clé', async () => {
    const { jugerPhoto } = charger('https://ml.example.com', 'mauvaise');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(jugerPhoto('file:///photo.jpg')).rejects.toThrow('EXPO_PUBLIC_ML_CLE');
  });

  it('envoie un File d’expo-file-system (le fetch d’Expo refuse le format { uri })', async () => {
    const { jugerPhoto } = charger('https://ml.example.com');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => RESULTAT });
    const ajout = jest.spyOn(FormData.prototype, 'append');

    await jugerPhoto('file:///photo.jpg');
    const [champ, valeur, nom] = ajout.mock.calls[0];
    expect(champ).toBe('photo');
    expect(valeur).toBeInstanceOf(Blob);
    expect(valeur).toMatchObject({ uri: 'file:///photo.jpg' });
    expect(nom).toBe('photo.jpg');
    ajout.mockRestore();
  });

  it('signale une photo illisible sans appeler le serveur', async () => {
    const { jugerPhoto } = charger('https://ml.example.com');
    await expect(jugerPhoto('file:///introuvable.jpg')).rejects.toThrow('lire la photo');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('remonte le message du serveur en cas de refus', async () => {
    const { jugerPhoto, ErreurML } = charger('https://ml.example.com');
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Le fichier envoyé n'est pas une image lisible." }),
    });
    const promesse = jugerPhoto('file:///x.jpg');
    await expect(promesse).rejects.toBeInstanceOf(ErreurML);
    await expect(promesse).rejects.toMatchObject({ statut: 400 });
  });

  it('signale un serveur injoignable', async () => {
    const { jugerPhoto } = charger('https://ml.example.com');
    (globalThis.fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    await expect(jugerPhoto('file:///x.jpg')).rejects.toThrow('injoignable');
  });

  it("explique quoi faire si l'adresse du serveur manque", async () => {
    const { jugerPhoto } = charger(undefined);
    await expect(jugerPhoto('file:///x.jpg')).rejects.toThrow('EXPO_PUBLIC_ML_URL');
  });
});
