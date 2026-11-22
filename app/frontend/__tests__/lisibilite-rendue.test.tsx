import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { BarreOnglets } from '../components/BarreOnglets';
import { EcranOuverture } from '../components/EcranOuverture';
import { EnteteVert } from '../components/EnteteVert';
import LoginScreen from '../citizen/LoginScreen';
import { FeuilleProfil } from '../../src/components/profil/feuille-profil';
import { Bouton } from '../../src/components/ville/bouton';
import { Chip } from '../../src/components/ville/chip';
import { Chargement } from '../../src/components/ville/etat-ecran';
import { contraste } from '../../src/marque/couleurs';
import { definirLisibilite, definirTheme, lireMarque, reinitialiserMarque } from '../../src/marque/magasin';
import { THEMES_IDS } from '../../src/marque/themes';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// Le téléphone est en MODE SOMBRE : l'app ne suit que son propre thème (cas du retour du propriétaire : fond noir sur « Derniers détails »).
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'dark' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

type Style = Record<string, unknown>;

function aplatir(style: unknown): Style {
  if (Array.isArray(style)) return style.reduce<Style>((a, s) => ({ ...a, ...aplatir(s) }), {});
  return style && typeof style === 'object' ? (style as Style) : {};
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

type Probleme = { texte: string; couleur: string; fond: string; rapport: number; min: number };

/**
 * Parcourt le rendu : pour chaque texte, sa couleur contre le fond opaque du plus proche ancêtre qui en a un (sinon le fond d'écran du thème).
 * Les fonds translucides (voiles) sont ignorés : on ne juge que des couples opaques, sans deviner un mélange.
 */
function problemes(noeud: ReactTestRendererJSON | ReactTestRendererJSON[] | null, fondEcran: string, fond: string = fondEcran, sortie: Probleme[] = [], ignore = false): Probleme[] {
  if (!noeud) return sortie;
  if (Array.isArray(noeud)) {
    noeud.forEach((n) => problemes(n, fondEcran, fond, sortie, ignore));
    return sortie;
  }
  if (noeud.props?.testID === 'apercu-theme') return sortie; // aperçu d'un autre thème : pas le nôtre
  const st = aplatir(noeud.props?.style);
  const fondCourant = typeof st.backgroundColor === 'string' && HEX.test(st.backgroundColor) ? st.backgroundColor : fond;
  if (noeud.type === 'Text') {
    const couleur = typeof st.color === 'string' && HEX.test(st.color) ? st.color : null;
    const texte = (noeud.children ?? []).filter((c): c is string => typeof c === 'string').join('');
    if (couleur && texte.trim() && st.opacity === undefined) {
      const gros = Number(st.fontSize ?? 14) >= 18 || (Number(st.fontSize ?? 14) >= 14 && Number(st.fontWeight ?? 400) >= 700);
      const min = gros ? 3 : 4.5;
      const rapport = contraste(couleur, fondCourant);
      if (rapport < min) sortie.push({ texte: texte.slice(0, 40), couleur, fond: fondCourant, rapport: Math.round(rapport * 100) / 100, min });
    }
  }
  (noeud.children ?? []).forEach((c) => typeof c !== 'string' && problemes(c, fondEcran, fondCourant, sortie, ignore));
  return sortie;
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
      <Bouton titre="Valider" onPress={() => {}} />
      <Bouton titre="Retour" variante="discret" onPress={() => {}} />
      <Chip titre="Égout" selectionne onPress={() => {}} />
      <Chip titre="Grille" onPress={() => {}} />
      <BarreOnglets onglets={ONGLETS} actif="a" onChange={() => {}} />
      <FeuilleProfil visible onFermer={() => {}} nom="Léa" role="Superviseur" onDeconnexion={() => {}} />
      <LoginScreen onBack={() => {}} onLogin={async () => null} onSignup={() => {}} onForgot={() => {}} onGuest={() => {}} />
    </>
  );
}

beforeEach(() => reinitialiserMarque());

const REGLAGES = [
  { contraste: false },
  { contraste: true },
];

describe('lisibilité du rendu : chaque texte contre le fond qu’il a vraiment', () => {
  it.each(THEMES_IDS.flatMap((t) => REGLAGES.map((l) => [t, l] as const)))('thème %s, lisibilité %j', async (theme, lis) => {
    definirTheme(theme);
    definirLisibilite(lis);
    await render(<Ecrans />);
    const j = lireMarque().jetons;
    const fautifs = problemes(screen.toJSON(), j.background);
    expect(fautifs).toEqual([]);
  });
});

describe('le contrôle voit bien un texte illisible', () => {
  it('texte pâle sur fond clair : signalé ; texte foncé : accepté', async () => {
    await render(
      <View style={{ backgroundColor: '#FFFFFF' }}>
        <Text style={{ color: '#E0E0E0', fontSize: 14 }}>Trop pâle</Text>
        <Text style={{ color: '#111111', fontSize: 14 }}>Lisible</Text>
      </View>,
    );
    const p = problemes(screen.toJSON(), '#FFFFFF');
    expect(p.map((x) => x.texte)).toEqual(['Trop pâle']);
  });
});
