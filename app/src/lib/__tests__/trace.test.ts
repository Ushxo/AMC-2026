import { essayerSansBruit, installerGestionnaires, reinitialiserGestionnaires, sansBruit, tracer } from '../trace';

describe('trace des erreurs sans bruit', () => {
  let avertir: jest.SpyInstance;
  beforeEach(() => {
    avertir = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => avertir.mockRestore());

  it('tracer écrit dans le journal en développement', () => {
    tracer('test', new Error('x'));
    expect(avertir).toHaveBeenCalledWith('[test]', expect.any(Error));
  });

  it('une promesse qui échoue est attrapée et tracée, sans rejet non traité', async () => {
    const rejets: unknown[] = [];
    const surRejet = (e: unknown) => rejets.push(e);
    process.on('unhandledRejection', surRejet);
    sansBruit(Promise.reject(new Error('boum')), 'promesse');
    sansBruit(async () => {
      throw new Error('asynchrone');
    }, 'fonction asynchrone');
    sansBruit(() => {
      throw new Error('synchrone');
    }, 'fonction synchrone');
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', surRejet);
    expect(rejets).toEqual([]);
    expect(avertir).toHaveBeenCalledTimes(3);
  });

  it('une fonction qui réussit ne trace rien ; une exception synchrone n’est pas propagée', () => {
    sansBruit(() => 1, 'ok');
    essayerSansBruit(() => {
      throw new Error('x');
    }, 'sync');
    expect(avertir).toHaveBeenCalledTimes(1);
  });

  it('gestionnaires globaux : installés une seule fois, non fatal avalé, fatal transmis', () => {
    const precedent = jest.fn();
    let installe: ((e: unknown, fatal?: boolean) => void) | null = null;
    const utilitaires = {
      getGlobalHandler: jest.fn(() => precedent),
      setGlobalHandler: jest.fn((h: (e: unknown, fatal?: boolean) => void) => {
        installe = h;
      }),
    };
    (globalThis as unknown as { ErrorUtils: unknown }).ErrorUtils = utilitaires;
    reinitialiserGestionnaires();
    installerGestionnaires();
    installerGestionnaires();
    expect(utilitaires.setGlobalHandler).toHaveBeenCalledTimes(1);
    installe!(new Error('non fatal'), false);
    expect(precedent).not.toHaveBeenCalled();
    installe!(new Error('fatal'), true);
    expect(precedent).toHaveBeenCalledTimes(1);
    delete (globalThis as unknown as { ErrorUtils?: unknown }).ErrorUtils;
  });
});
