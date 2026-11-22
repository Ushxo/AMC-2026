import { render, screen } from '@testing-library/react-native';
import { act } from 'react';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { BarreOnglets } from '../components/BarreOnglets';
import { EcranOuverture } from '../components/EcranOuverture';
import { EnteteVert } from '../components/EnteteVert';
import { FeuilleProfil } from '../../src/components/profil/feuille-profil';
import { Bouton } from '../../src/components/ville/bouton';
import { Chip } from '../../src/components/ville/chip';
import { Chargement, Erreur } from '../../src/components/ville/etat-ecran';
import * as fixes from '../../src/components/ville/style';
import { definirLisibilite, definirTheme, jetonsDuTheme, reinitialiserMarque } from '../../src/marque/magasin';
import { ORGANISATIONS_EMBARQUEES } from '../../src/marque/organisations-embarquees';
import { THEMES_IDS, type ThemeId } from '../../src/marque/themes';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const CLES_COULEUR = ['backgroundColor', 'color', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'shadowColor', 'tintColor', 'textDecorationColor'];
const PROPS_COULEUR = ['color', 'trackColor', 'thumbColor', 'placeholderTextColor', 'selectionColor', 'tintColor'];

function aplatir(valeur: unknown, sortie: string[]): void {
  if (typeof valeur === 'string') {
    if (/^#[0-9A-Fa-f]{6}$/.test(valeur)) sortie.push(valeur.toUpperCase());
  } else if (Array.isArray(valeur)) valeur.forEach((v) => aplatir(v, sortie));
  else if (valeur && typeof valeur === 'object') Object.values(valeur).forEach((v) => aplatir(v, sortie));
}

/** Toutes les couleurs écrites dans l'arbre rendu (styles et propriétés de couleur), sans l'aperçu des autres thèmes. */
function couleursRendues(noeud: ReactTestRendererJSON | ReactTestRendererJSON[] | null, sortie: string[] = []): string[] {
  if (!noeud) return sortie;
  if (Array.isArray(noeud)) {
    noeud.forEach((n) => couleursRendues(n, sortie));
    return sortie;
  }
  if (noeud.props?.testID === 'apercu-theme') return sortie;
  const style = (Array.isArray(noeud.props?.style) ? noeud.props.style.flat(5) : [noeud.props?.style]).filter(Boolean);
  for (const st of style) for (const k of CLES_COULEUR) if (st && typeof st === 'object' && k in st) aplatir(st[k], sortie);
  for (const k of PROPS_COULEUR) if (k in (noeud.props ?? {})) aplatir(noeud.props[k], sortie);
  (noeud.children ?? []).forEach((c) => typeof c !== 'string' && couleursRendues(c, sortie));
  return sortie;
}

const COULEURS_FIXES = new Set<string>();
aplatir(Object.values(fixes), []);
{
  const tmp: string[] = [];
  aplatir(Object.values(fixes), tmp);
  tmp.forEach((c) => COULEURS_FIXES.add(c));
}

function valeursJetons(theme: ThemeId): Set<string> {
  const ensemble = new Set<string>();
  for (const o of ORGANISATIONS_EMBARQUEES) {
    for (const l of [{ contraste: false }, { contraste: true }]) {
      Object.values(jetonsDuTheme(o, theme, l)).forEach((v) => typeof v === 'string' && ensemble.add(v.toUpperCase()));
    }
  }
  return ensemble;
}

const ONGLETS = [
  { id: 'a' as const, label: 'Planifier', icon: 'list-outline' as const, iconActive: 'list' as const },
  { id: 'b' as const, label: 'Alertes', icon: 'alert-circle-outline' as const, iconActive: 'alert-circle' as const },
];

function Ecrans() {
  return (
    <>
      <EnteteVert titre="Interventions" sousTitre="Triées par importance" />
      <EcranOuverture />
      <Chargement />
      <Erreur message="Impossible de charger" onReessayer={() => {}} />
      <Bouton titre="Valider" onPress={() => {}} />
      <Bouton titre="Retour" variante="discret" onPress={() => {}} />
      <Chip titre="Égout" selectionne onPress={() => {}} />
      <BarreOnglets onglets={ONGLETS} actif="a" onChange={() => {}} />
      <FeuilleProfil visible onFermer={() => {}} nom="Léa" role="Superviseur" onDeconnexion={() => {}} />
    </>
  );
}

beforeEach(() => reinitialiserMarque());

describe('thèmes : appliqués uniformément', () => {
  it.each(THEMES_IDS.filter((t) => t !== 'organisation'))('thème %s : aucune couleur d’un autre thème ne traîne dans les écrans principaux', async (theme) => {
    definirTheme(theme);
    await render(<Ecrans />);
    const rendues = new Set(couleursRendues(screen.toJSON()));
    expect(rendues.size).toBeGreaterThan(10); // on a bien lu des couleurs
    const miennes = valeursJetons(theme);
    const etrangeres = new Set<string>();
    for (const autre of THEMES_IDS.filter((t) => t !== theme)) valeursJetons(autre).forEach((v) => etrangeres.add(v));
    const fautives = [...rendues].filter((c) => etrangeres.has(c) && !miennes.has(c) && !COULEURS_FIXES.has(c));
    expect(fautives).toEqual([]);
  });

  it('thème de l’organisation : aucune couleur d’un autre thème non plus', async () => {
    await render(<Ecrans />);
    const rendues = new Set(couleursRendues(screen.toJSON()));
    const miennes = valeursJetons('organisation');
    const etrangeres = new Set<string>();
    for (const autre of THEMES_IDS.filter((t) => t !== 'organisation')) valeursJetons(autre).forEach((v) => etrangeres.add(v));
    expect([...rendues].filter((c) => etrangeres.has(c) && !miennes.has(c) && !COULEURS_FIXES.has(c))).toEqual([]);
  });

  it('un changement de thème recolore l’écran déjà affiché, y compris avec la lisibilité', async () => {
    await render(<Ecrans />);
    const avant = couleursRendues(screen.toJSON()).join(',');
    await act(async () => definirTheme('nuit'));
    const apres = couleursRendues(screen.toJSON()).join(',');
    expect(apres).not.toBe(avant);
    await act(async () => definirLisibilite({ contraste: true }));
    expect(couleursRendues(screen.toJSON())).toContain('#000000');
  });
});
