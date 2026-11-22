import AsyncStorage from '@react-native-async-storage/async-storage';

import { ajusterContraste, contraste, melanger, texteSur } from '../couleurs';
import { appliquerApparence, completerCouleurs, corrigerContraste, jetonsDepuis, paletteDepuisGraines, PREREGLAGES, problemesContraste } from '../jetons';
import {
  abonnerMarque,
  garderMarqueLocale,
  oublierMarqueLocale,
  organisationAvecLocale,
  appliquerMarquePersonnel,
  chargerMarqueLocale,
  definirApparence,
  lireMarque,
  mettreAJourOrganisation,
  reinitialiserMarque,
  restaurerMarqueCitoyen,
} from '../magasin';
import { ORGANISATIONS_EMBARQUEES, organisationEmbarquee, type Couleurs } from '../organisations-embarquees';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const priorix = organisationEmbarquee('priorix')!;
const montreal = organisationEmbarquee('montreal')!;

beforeEach(async () => {
  await AsyncStorage.clear();
  reinitialiserMarque();
});

describe('couleurs et contraste', () => {
  it('contraste WCAG : noir sur blanc = 21, ajuste jusqu’au minimum', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(texteSur('#FFFFFF')).toBe('#000000');
    expect(texteSur('#1D3A1B')).toBe('#FFFFFF');
    expect(contraste(ajusterContraste('#CCCCCC', '#FFFFFF', 4.5), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(melanger('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
  it('les deux marques embarquées sont lisibles', () => {
    expect(problemesContraste(priorix.couleurs as Couleurs)).toEqual([]);
    expect(problemesContraste(montreal.couleurs as Couleurs)).toEqual([]);
  });
  it('un couple illisible est détecté puis corrigé (texte blanc sur jaune clair)', () => {
    const mauvais = { ...(priorix.couleurs as Couleurs), action: '#FFE066', onAction: '#FFFFFF' };
    expect(problemesContraste(mauvais).map((p) => p.jeton)).toContain('onAction');
    expect(problemesContraste(corrigerContraste(mauvais))).toEqual([]);
  });
  it('tout préréglage donne une palette lisible', () => {
    for (const p of PREREGLAGES) expect(problemesContraste(paletteDepuisGraines(p.graines, priorix.couleurs as Couleurs))).toEqual([]);
  });
});

describe('apparences', () => {
  const base = priorix.couleurs as Couleurs;
  it('contraste élevé : tout se lit à 7 pour 1 au moins', () => {
    const c = appliquerApparence(base, 'contraste');
    expect(contraste(c.text, c.background)).toBeGreaterThanOrEqual(7);
    expect(contraste(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(7);
    expect(contraste(c.onAction, c.action)).toBeGreaterThanOrEqual(4.5);
    expect(c.background).toBe('#FFFFFF');
  });
  it('sombre : fond foncé teinté, texte clair lisible, couleurs vives lisibles', () => {
    const c = appliquerApparence(base, 'sombre');
    expect(contraste(c.background, '#000000')).toBeLessThan(2); // très foncé
    expect(contraste(c.text, c.background)).toBeGreaterThanOrEqual(7);
    expect(contraste(c.action, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(problemesContraste(c)).toEqual([]);
  });
  it('daltonisme : bleu et vermillon, lisibles, sans rouge ni vert pour dire bon ou mauvais', () => {
    const c = appliquerApparence(base, 'daltonisme');
    expect(c.success).not.toBe(base.success);
    expect(contraste(c.success, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.danger, c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(problemesContraste(c)).toEqual([]);
  });
  it('toute marque, toute apparence : tous les couples texte sur fond restent lisibles (4,5 pour 1)', () => {
    for (const o of ORGANISATIONS_EMBARQUEES) {
      for (const a of ['standard', 'contraste', 'sombre', 'daltonisme'] as const) {
        const c = appliquerApparence(o.couleurs as Couleurs, a);
        expect({ marque: o.code, apparence: a, problemes: problemesContraste(c) }).toEqual({ marque: o.code, apparence: a, problemes: [] });
        // le bouton d'action et son texte, le plus visible de l'app
        expect(contraste(c.onAction, c.action)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('textes secondaires et bordures lisibles sur chaque fond, dans toutes les marques et apparences', () => {
    const manques: string[] = [];
    for (const o of ORGANISATIONS_EMBARQUEES) {
      for (const a of ['standard', 'contraste', 'sombre', 'daltonisme'] as const) {
        const c = appliquerApparence(o.couleurs as Couleurs, a);
        for (const fond of ['background', 'surface', 'backgroundElement'] as const) {
          if (contraste(c.textSecondary, c[fond]) < 4.5) manques.push(`${o.code}/${a}: textSecondary sur ${fond} ${contraste(c.textSecondary, c[fond]).toFixed(1)}`);
          if (contraste(c.text, c[fond]) < 4.5) manques.push(`${o.code}/${a}: text sur ${fond}`);
        }
        // (palette d'origine : le texte secondaire ne se pose jamais sur le fond sélectionné ; on exige la règle pour les variantes calculées)
        if (a !== 'standard' && a !== 'daltonisme' && contraste(c.textSecondary, c.backgroundSelected) < 4.5) manques.push(`${o.code}/${a}: textSecondary sur backgroundSelected ${contraste(c.textSecondary, c.backgroundSelected).toFixed(1)}`);
        if (contraste(c.primary, c.backgroundSelected) < 4.5) manques.push(`${o.code}/${a}: primary sur backgroundSelected ${contraste(c.primary, c.backgroundSelected).toFixed(1)}`);
        if (contraste(c.borderForte, c.background) < 3) manques.push(`${o.code}/${a}: borderForte sur background ${contraste(c.borderForte, c.background).toFixed(1)}`);
      }
    }
    expect(manques).toEqual([]);
  });
  it('apparences réglées à la main : tous les couples lisibles, identité gardée', () => {
    const manques: string[] = [];
    for (const o of ORGANISATIONS_EMBARQUEES) {
      for (const a of ['sombre', 'contraste', 'daltonisme'] as const) {
        const c = appliquerApparence(o.couleurs as Couleurs, a, o.code);
        manques.push(...problemesContraste(c).map((p) => `${o.code}/${a}: ${p.jeton} sur ${p.contre} ${p.rapport.toFixed(1)}`));
        for (const fond of ['background', 'surface', 'backgroundElement', 'backgroundSelected'] as const) {
          for (const t of ['primary', 'danger', 'success'] as const) {
            if (contraste(c[t], c[fond]) < 4.5) manques.push(`${o.code}/${a}: ${t} sur ${fond} ${contraste(c[t], c[fond]).toFixed(1)}`);
          }
          if (contraste(c.accent, c[fond]) < 3) manques.push(`${o.code}/${a}: accent sur ${fond} ${contraste(c.accent, c[fond]).toFixed(1)}`);
        }
        if (contraste(c.onAction, c.action) < 4.5 || contraste(c.onPrimary, c.primary) < 4.5) manques.push(`${o.code}/${a}: texte sur bouton`);
      }
      // la marque se reconnaît : l'en-tête garde sa teinte en daltonisme, le rouge de Montréal reste rouge en contraste élevé
      expect(appliquerApparence(o.couleurs as Couleurs, 'daltonisme', o.code).header).toBe(o.couleurs.header);
    }
    expect(manques).toEqual([]);
  });
  it('s’applique à toute marque (Montréal en sombre)', () => {
    expect(problemesContraste(appliquerApparence(montreal.couleurs as Couleurs, 'sombre'))).toEqual([]);
    expect(problemesContraste(appliquerApparence(montreal.couleurs as Couleurs, 'contraste'))).toEqual([]);
  });
  it('complète une palette partielle avec celle de repli, et dérive les jetons', () => {
    const c = completerCouleurs({ primary: '#112233', action: 'pas une couleur' }, base);
    expect(c.primary).toBe('#112233');
    expect(c.action).toBe(base.action);
    const j = jetonsDepuis(c);
    expect(contraste(j.onBandeau, j.bandeau)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(j.onHeaderSoft, j.header)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('marque courante', () => {
  it('par défaut : Priorix, apparence standard, jetons de Priorix', () => {
    const e = lireMarque();
    expect(e.organisation.code).toBe('priorix');
    expect(e.apparence).toBe('standard');
    expect(e.jetons.action).toBe('#B84A0B');
    expect(e.jetons.primary).toBe('#1D3A1B');
  });

  it('changer de marque recolore tout en direct et prévient les écrans abonnés', () => {
    const rappel = jest.fn();
    const arret = abonnerMarque(rappel);
    appliquerMarquePersonnel(montreal);
    expect(lireMarque().jetons.primary).toBe('#B5121B');
    expect(lireMarque().organisation.nom_app).toBe('Ville de Montréal');
    expect(rappel).toHaveBeenCalled();
    arret();
  });

  it('seule l’apparence est gardée au redémarrage : le citoyen ne choisit jamais la marque, même avec un ancien choix stocké', async () => {
    await AsyncStorage.setItem('priorix:marque-citoyen', 'montreal'); // reste d'une ancienne version
    definirApparence('sombre');
    await new Promise((r) => setTimeout(r, 10));
    expect(await AsyncStorage.getItem('priorix:apparence')).toBe('sombre');
    reinitialiserMarque();
    await chargerMarqueLocale(ORGANISATIONS_EMBARQUEES);
    expect(lireMarque().organisation.code).toBe('priorix');
    expect(lireMarque().apparence).toBe('sombre');
  });

  it('un compte du personnel prend sa marque, et la marque par défaut de l’app revient à la déconnexion', () => {
    appliquerMarquePersonnel(montreal);
    expect(lireMarque().organisation.code).toBe('montreal');
    expect(lireMarque().duPersonnel).toBe(true);
    restaurerMarqueCitoyen();
    expect(lireMarque().organisation.code).toBe('priorix');
    expect(lireMarque().duPersonnel).toBe(false);
  });

  it('la marque modifiée par un administrateur (ou reçue en direct) s’applique tout de suite', () => {
    mettreAJourOrganisation({ ...priorix, nom_app: 'Priorix 2', couleurs: { ...priorix.couleurs, action: '#005F73' } });
    expect(lireMarque().organisation.nom_app).toBe('Priorix 2');
    expect(lireMarque().jetons.action).toBe('#005F73');
    // une autre organisation n'agit pas sur la marque courante
    mettreAJourOrganisation({ ...montreal, nom_app: 'Autre' });
    expect(lireMarque().organisation.nom_app).toBe('Priorix 2');
  });

  it('l’apparence s’applique à la marque courante', () => {
    appliquerMarquePersonnel(montreal);
    definirApparence('contraste');
    expect(lireMarque().jetons.background).toBe('#FFFFFF');
    expect(lireMarque().organisation.code).toBe('montreal');
  });

  it('une marque réglée sans la base est gardée au redémarrage, puis remplacée quand la base la donne', async () => {
    const perso = { ...montreal, nom_app: 'Ville de Montréal 2', couleurs: { ...montreal.couleurs, primary: '#0F4C81' } };
    garderMarqueLocale(perso);
    await new Promise((r) => setTimeout(r, 10));
    expect(organisationAvecLocale(montreal).nom_app).toBe('Ville de Montréal 2');
    reinitialiserMarque();
    expect(organisationAvecLocale(montreal).nom_app).toBe('Ville de Montréal'); // l'état est vidé : on repart de zéro
    appliquerMarquePersonnel(montreal);
    garderMarqueLocale(perso);
    await new Promise((r) => setTimeout(r, 10));
    reinitialiserMarque();
    await chargerMarqueLocale(ORGANISATIONS_EMBARQUEES);
    expect(organisationAvecLocale(montreal).nom_app).toBe('Ville de Montréal 2');
    // la base la reprend : la copie locale disparaît
    mettreAJourOrganisation({ ...montreal, id: 'o2', nom_app: 'Ville de Montréal (base)' });
    expect(organisationAvecLocale(montreal).nom_app).toBe('Ville de Montréal');
    oublierMarqueLocale('montreal');
  });

  it('une marque identique ne reconstruit rien (pas de re-rendu pour rien)', () => {
    const rappel = jest.fn();
    const arret = abonnerMarque(rappel);
    const avant = lireMarque();
    mettreAJourOrganisation({ ...priorix }); // mêmes valeurs
    expect(lireMarque()).toBe(avant);
    expect(rappel).not.toHaveBeenCalled();
    mettreAJourOrganisation({ ...priorix, nom_app: 'Autre nom' });
    expect(rappel).toHaveBeenCalledTimes(1);
    arret();
  });
});
