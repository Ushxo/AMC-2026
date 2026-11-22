import AsyncStorage from '@react-native-async-storage/async-storage';

import { ajouter, lister } from '../file-attente';
import { chargerSignalementsDemo } from '../officiel';
import { copierPhotoDurable } from '../photo-locale';
import { definirEmploye } from '../session';
import {
  changerEtat,
  creerSignalement,
  etatSource,
  lireHistorique,
  lireSignalements,
  renvoyerFile,
  redemarrerLocal,
  reinitialiserLocal,
} from '../source';
import { getSupabase } from '../supabase';
import { sig } from '../test-utils/fabrique';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri: string) => ({ uri })),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('../supabase', () => ({ getSupabase: jest.fn(() => null) }));
jest.mock('../photo-locale', () => ({
  copierPhotoDurable: jest.fn(async (_u: string, id: string) => `file:///doc/photos-en-attente/${id}.jpg`),
  supprimerPhotoDurable: jest.fn(),
}));
jest.mock('../officiel', () => ({
  chargerSignalementsDemo: jest.fn(),
}));

const mockGet = getSupabase as jest.Mock;
const mockDemo = chargerSignalementsDemo as jest.Mock;

const donnees = {
  latitude: 45.505,
  longitude: -73.567,
  categorie: 'grille_bouchee' as const,
  gravite: 'faible' as const,
  grille_id: null,
};

function clientFaux(insert: jest.Mock, upload?: jest.Mock) {
  return {
    from: jest.fn(() => ({ insert })),
    storage: { from: () => ({ upload: upload ?? jest.fn(async () => ({ error: null })) }) },
  };
}

function signalementDe(r: { statut: string; signalement?: unknown }) {
  if (!('signalement' in r) || !r.signalement) throw new Error('pas de signalement');
  return r.signalement as import('../../types').Signalement;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await reinitialiserLocal();
  definirEmploye(null);
  mockGet.mockReturnValue(null);
  mockDemo.mockReturnValue([sig({ id: 'demo-1', exemple_demo: true }), sig({ id: 'demo-2' })]);
});

describe('source en repli (sans clés Supabase)', () => {
  it('lit la copie locale et reste en repli', async () => {
    const l = await lireSignalements();
    expect(l.map((s) => s.id)).toEqual(['demo-1', 'demo-2']);
    expect(etatSource()).toBe('repli');
  });

  it('creerSignalement met le signalement en file', async () => {
    const r = await creerSignalement(donnees);
    expect(r.statut).toBe('en_attente');
    expect(signalementDe(r).en_attente).toBe(true);
    expect(signalementDe(r).etat).toBe('nouveau');
    const file = await lister();
    expect(file).toHaveLength(1);
    expect(file[0].signalement.id).toBe(signalementDe(r).id);
  });

  it('changerEtat est refusé sans session employé', async () => {
    expect(await changerEtat('demo-1', 'regle')).toBe('Connectez-vous comme employé pour changer un état.');
  });

  it("changerEtat applique le changement en mémoire et l'historique le garde", async () => {
    definirEmploye({ user_id: 'demo-hors-ligne', nom: 'Démo', courriel: 'x' });
    expect(await changerEtat('demo-1', 'regle')).toBeNull();
    const l = await lireSignalements();
    expect(l.find((s) => s.id === 'demo-1')?.etat).toBe('regle');
    const h = await lireHistorique('demo-1');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ ancien_etat: 'nouveau', nouvel_etat: 'regle', change_par: 'demo-hors-ligne' });
  });
});

describe('démonstration hors ligne : persistance', () => {
  it('les changements survivent à un redémarrage (clé signalement-mtl:etats-demo)', async () => {
    definirEmploye({ user_id: 'demo-hors-ligne', nom: 'Démo', courriel: 'x' });
    await changerEtat('demo-1', 'pris_en_charge');
    expect(await AsyncStorage.getItem('signalement-mtl:etats-demo')).not.toBeNull();
    redemarrerLocal();
    const l = await lireSignalements();
    expect(l.find((s) => s.id === 'demo-1')?.etat).toBe('pris_en_charge');
    expect(await lireHistorique('demo-1')).toHaveLength(1);
  });
});

describe('source avec client', () => {
  it('envoie le signalement avec les seules colonnes de la table', async () => {
    const insert = jest.fn(async () => ({ error: null }));
    mockGet.mockReturnValue(clientFaux(insert));
    const r = await creerSignalement(donnees);
    expect(r.statut).toBe('envoye');
    const ligne = (insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(Object.keys(ligne).sort()).toEqual(
      ['categorie', 'commentaire', 'grille_id', 'gravite', 'id', 'latitude', 'longitude', 'photo_url'].sort(),
    );
    expect(await lister()).toHaveLength(0);
  });

  it("met en file si l'envoi échoue, puis renvoie sans doublon au retour du réseau", async () => {
    const insert = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    mockGet.mockReturnValue(clientFaux(insert));
    const r = await creerSignalement(donnees);
    expect(r.statut).toBe('en_attente');
    expect(await lister()).toHaveLength(1);

    // Le réseau revient, mais la base répond « déjà présent » : pas de doublon, la file se vide.
    const insert2 = jest.fn(async () => ({ error: { code: '23505', message: 'duplicate' } }));
    mockGet.mockReturnValue(clientFaux(insert2));
    expect(await renvoyerFile()).toBe(1);
    expect(await lister()).toHaveLength(0);
    expect(await renvoyerFile()).toBe(0);
  });
});

describe('refus permanents, photos et session (revue)', () => {
  const ancienFetch = globalThis.fetch;
  const ancienneUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    globalThis.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })) as never;
  });
  afterAll(() => {
    globalThis.fetch = ancienFetch;
    process.env.EXPO_PUBLIC_SUPABASE_URL = ancienneUrl;
  });

  it('un refus permanent est gardé avec son motif et les suivants partent', async () => {
    const a = sig({ id: 'a' });
    const b = sig({ id: 'b' });
    await ajouter({ signalement: a });
    await ajouter({ signalement: b });
    const insert = jest.fn(async (ligne: { id: string }) =>
      ligne.id === 'a' ? { error: { code: '23514', message: 'check' } } : { error: null },
    );
    mockGet.mockReturnValue(clientFaux(insert as unknown as jest.Mock));
    expect(await renvoyerFile()).toBe(1);
    const file = await lister();
    expect(file).toHaveLength(1);
    expect(file[0].signalement.id).toBe('a');
    expect(file[0].echec).toBe("Le serveur a refusé ce signalement. Il n'a pas été envoyé.");
    // Pas de nouvel essai pour l'élément en échec.
    insert.mockClear();
    await renvoyerFile();
    expect(insert).not.toHaveBeenCalled();
  });

  it('photo trop lourde : élément gardé avec le motif', async () => {
    await ajouter({ signalement: sig({ id: 'p' }), photoUri: 'file:///x.jpg' });
    const upload = jest.fn(async () => ({ error: { statusCode: '413', message: 'too large' } }));
    mockGet.mockReturnValue(clientFaux(jest.fn(async () => ({ error: null })), upload));
    await renvoyerFile();
    expect((await lister())[0].echec).toMatch(/trop lourde/);
  });

  it('une panne réseau arrête le renvoi sans marquer d’échec', async () => {
    await ajouter({ signalement: sig({ id: 'r' }) });
    mockGet.mockReturnValue(
      clientFaux(
        jest.fn(async () => {
          throw new TypeError('Network request failed');
        }),
      ),
    );
    expect(await renvoyerFile()).toBe(0);
    expect((await lister())[0].echec).toBeUndefined();
  });

  it('la photo envoyée a une adresse du bucket de notre projet', async () => {
    const insert = jest.fn(async () => ({ error: null }));
    mockGet.mockReturnValue(clientFaux(insert));
    const r = await creerSignalement({ ...donnees, photoUri: 'file:///p.jpg' });
    const s = signalementDe(r);
    expect(r.statut).toBe('envoye');
    expect(s.photo_url).toBe(`https://abc.supabase.co/storage/v1/object/public/photos-signalements/${s.id}.jpg`);
    expect(copierPhotoDurable).toHaveBeenCalled();
  });

  it('photo illisible : le signalement part sans photo et le résultat le dit', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('introuvable');
    }) as never;
    mockGet.mockReturnValue(clientFaux(jest.fn(async () => ({ error: null }))));
    const r = await creerSignalement({ ...donnees, photoUri: 'file:///perdue.jpg' });
    expect(r).toMatchObject({ statut: 'envoye', sansPhoto: true });
    expect(signalementDe(r).photo_url).toBeNull();
  });

  it('refus permanent à la création : en attente avec le motif', async () => {
    mockGet.mockReturnValue(clientFaux(jest.fn(async () => ({ error: { code: '42501', message: 'rls' } }))));
    const r = await creerSignalement(donnees);
    expect(r.statut).toBe('en_attente');
    expect(signalementDe(r).echec_envoi).toMatch(/refusé/);
  });

  it('file illisible à la création : statut echec, rien d’écrasé', async () => {
    await AsyncStorage.setItem('signalement-mtl:file', '{abîmé');
    const r = await creerSignalement(donnees);
    expect(r.statut).toBe('echec');
    expect(await AsyncStorage.getItem('signalement-mtl:file')).toBe('{abîmé');
  });

  it('démonstration hors ligne : le changement reste local même si le réseau est revenu', async () => {
    definirEmploye({ user_id: 'demo-hors-ligne', nom: 'Démo', courriel: 'x' });
    const update = jest.fn();
    mockGet.mockReturnValue({ from: update });
    expect(await changerEtat('demo-1', 'regle')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('compte réel sans réseau : refus clair, rien écrit sur le téléphone', async () => {
    definirEmploye({ user_id: 'u1', nom: 'Réelle', courriel: 'x' });
    expect(await changerEtat('demo-1', 'regle')).toMatch(/Pas de réseau/);
    expect(await AsyncStorage.getItem('signalement-mtl:etats-demo')).toBeNull();
  });
});
