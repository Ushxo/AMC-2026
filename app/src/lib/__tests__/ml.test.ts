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
  if (url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = url;
  if (cle === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = cle;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- rechargement du module après avoir changé l’env
  return require('../ml') as typeof import('../ml');
}

beforeEach(() => {
  globalThis.fetch = jest.fn();
});

describe('jugerPhoto', () => {
  it('envoie la photo en multipart à la fonction serveur et renvoie le résultat', async () => {
    const { jugerPhoto } = charger('https://ml.example.com/');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => RESULTAT });

    await expect(jugerPhoto('file:///photo.jpg')).resolves.toEqual(RESULTAT);
    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://ml.example.com/functions/v1/juger-photo');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('envoie seulement la clé publique, jamais la clé du service d’analyse', async () => {
    const { jugerPhoto } = charger('https://ml.example.com', 'secret');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => RESULTAT });

    await jugerPhoto('file:///photo.jpg');
    expect((globalThis.fetch as jest.Mock).mock.calls[0][1].headers).toEqual({ apikey: 'secret', Authorization: 'Bearer secret' });
  });

  it('dit que l’analyse n’est pas disponible quand le serveur la refuse', async () => {
    const { jugerPhoto } = charger('https://ml.example.com', 'mauvaise');
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(jugerPhoto('file:///photo.jpg')).rejects.toThrow('pas disponible');
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
    await expect(jugerPhoto('file:///x.jpg')).rejects.toThrow('EXPO_PUBLIC_SUPABASE_URL');
  });

  it('abandonne l’analyse après 12 s : jamais d’attente sans fin', async () => {
    jest.useFakeTimers();
    try {
      const { jugerPhoto, DELAI_ANALYSE_MS } = charger('https://ml.example.com');
      (globalThis.fetch as jest.Mock).mockImplementation(
        (_u: string, o: { signal: AbortSignal }) =>
          new Promise((_r, rejeter) => o.signal.addEventListener('abort', () => rejeter(new Error('abort')))),
      );
      const attente = jugerPhoto('file:///photo.jpg');
      const verdict = expect(attente).rejects.toThrow('prend trop de temps');
      await jest.advanceTimersByTimeAsync(DELAI_ANALYSE_MS + 10);
      await verdict;
    } finally {
      jest.useRealTimers();
    }
  });

  it('réveil : une seule fois par session, sans bloquer, erreurs avalées', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ml.example.com';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reveillerUneFois } = require('../reveil-ml') as typeof import('../reveil-ml');
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('hors ligne'));
    reveillerUneFois();
    reveillerUneFois();
    await Promise.resolve();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
