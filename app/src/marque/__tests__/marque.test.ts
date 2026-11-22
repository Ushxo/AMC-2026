import AsyncStorage from '@react-native-async-storage/async-storage';

import { ajusterContraste, contraste, melanger, texteSur } from '../couleurs';
import { completerCouleurs, corrigerContraste, jetonsDepuis, paletteDepuisGraines, PREREGLAGES, problemesContraste } from '../jetons';
import {
  abonnerMarque,
  garderMarqueLocale,
  oublierMarqueLocale,
  organisationAvecLocale,
  appliquerMarquePersonnel,
  chargerMarqueLocale,
  chargerReglagesTheme,
  definirLisibilite,
  definirTheme,
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

describe('palettes de couleurs', () => {
  const base = ORGANISATIONS_EMBARQUEES[0].couleurs as Couleurs;
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
    expect(e.theme).toBe('organisation');
    expect(e.lisibilite).toEqual({ contraste: false });
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

  it('le thème et la lisibilité sont gardés par personne au redémarrage ; le citoyen ne choisit jamais la marque', async () => {
    await AsyncStorage.setItem('priorix:marque-citoyen', 'montreal'); // reste d'une ancienne version
    definirTheme('ocean');
    definirLisibilite({ contraste: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(JSON.parse((await AsyncStorage.getItem('priorix:theme:invite')) ?? '{}')).toEqual({ theme: 'ocean', lisibilite: { contraste: true } });
    reinitialiserMarque();
    await chargerMarqueLocale(ORGANISATIONS_EMBARQUEES);
    expect(lireMarque().organisation.code).toBe('priorix');
    expect(lireMarque().theme).toBe('ocean');
    expect(lireMarque().lisibilite.contraste).toBe(true);
    // une autre personne a ses propres réglages
    await chargerReglagesTheme('autre-personne');
    expect(lireMarque().theme).toBe('organisation');
    await chargerReglagesTheme('invite');
    expect(lireMarque().theme).toBe('ocean');
  });

  it('un ancien réglage « sombre » devient le thème Nuit', async () => {
    await AsyncStorage.setItem('priorix:apparence', 'sombre');
    await chargerReglagesTheme('invite');
    expect(lireMarque().theme).toBe('nuit');
    expect(lireMarque().sombre).toBe(true);
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

  it('le thème choisi change toute la palette mais pas l’organisation (logo et nom)', () => {
    appliquerMarquePersonnel(montreal);
    definirTheme('prune');
    expect(lireMarque().organisation.code).toBe('montreal');
    expect(lireMarque().organisation.nom_app).toBe('Ville de Montréal');
    expect(lireMarque().jetons.primary).toBe('#5B2A86');
    definirTheme('organisation');
    expect(lireMarque().jetons.primary).toBe('#B5121B');
    definirLisibilite({ contraste: true });
    expect(lireMarque().jetons.background).toBe('#FFFFFF');
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

  it('une valeur « daltonisme » déjà enregistrée est ignorée : aucune couleur ne change', async () => {
    await AsyncStorage.setItem('priorix:theme:invite', JSON.stringify({ theme: 'ocean', lisibilite: { contraste: false, daltonisme: true } }));
    await chargerReglagesTheme('invite');
    const avecAncienne = lireMarque().jetons;
    expect(lireMarque().lisibilite).toEqual({ contraste: false });
    definirTheme('ocean');
    expect(lireMarque().jetons).toEqual(avecAncienne); // même palette que le thème Océan seul
    expect(avecAncienne.success).toBe('#2A7A57'); // le vert du thème, pas le bleu du réglage disparu
    // l'ancien réglage d'avant les thèmes : thème de l'organisation, sans réglage
    reinitialiserMarque();
    await AsyncStorage.removeItem('priorix:theme:invite');
    await AsyncStorage.setItem('priorix:apparence', 'daltonisme');
    await chargerReglagesTheme('invite');
    expect(lireMarque().theme).toBe('organisation');
    expect(lireMarque().lisibilite).toEqual({ contraste: false });
  });
});
