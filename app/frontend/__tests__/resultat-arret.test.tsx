import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FeuilleArrets } from '../../src/components/ville/feuille-arrets';
import { FeuilleResultatArret } from '../../src/components/ville/feuille-resultat-arret';
import type { Arret } from '../../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

async function feuille(onEnregistrer = jest.fn(async () => null as string | null), choixInitial: 'oui' | 'non' | null = null, commentaireInitial = '') {
  const onFermer = jest.fn();
  const rendu = await render(<FeuilleResultatArret visible rang={3} choixInitial={choixInitial} commentaireInitial={commentaireInitial} onEnregistrer={onEnregistrer} onFermer={onFermer} />);
  return { onEnregistrer, onFermer, rendu };
}

describe('feuille de résultat d’un arrêt', () => {
  it('pose la question avec deux boutons Oui et Non, sans choix tant que rien n’est touché', async () => {
    await feuille();
    expect(screen.getByText('Arrêt fait ?')).toBeTruthy();
    expect(screen.getByLabelText("Oui, l'arrêt est fait")).toBeTruthy();
    expect(screen.getByLabelText("Non, l'arrêt n'est pas fait")).toBeTruthy();
    expect(screen.queryByText(/obligatoire|facultatif/)).toBeNull();
    expect(screen.getByLabelText('Enregistrer').props.accessibilityState.disabled).toBe(true);
  });

  it('Oui : commentaire facultatif, l’enregistrement passe sans texte', async () => {
    const { onEnregistrer, onFermer } = await feuille();
    await fireEvent.press(screen.getByLabelText("Oui, l'arrêt est fait"));
    expect(screen.getByText('Quelque chose à signaler ? (facultatif)')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(onEnregistrer).toHaveBeenCalledWith({ fait: true, commentaire: '' }));
    expect(onFermer).toHaveBeenCalled();
  });

  it('Non : commentaire obligatoire, erreur sous le champ, raisons en un toucher modifiables, compteur', async () => {
    const { onEnregistrer, onFermer } = await feuille();
    await fireEvent.press(screen.getByLabelText("Non, l'arrêt n'est pas fait"));
    expect(screen.getByText("Pourquoi l'arrêt n'est-il pas fait ? (obligatoire)")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText("Dites pourquoi l'arrêt n'a pas été fait.")).toBeTruthy();
    expect(onEnregistrer).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Grille brisée, à réparer'));
    expect(screen.getByText('24 / 500')).toBeTruthy();
    const champ = screen.getByDisplayValue('Grille brisée, à réparer');
    await fireEvent.changeText(champ, 'Grille brisée, à réparer vite');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(onEnregistrer).toHaveBeenCalledWith({ fait: false, commentaire: 'Grille brisée, à réparer vite' }));
    expect(onFermer).toHaveBeenCalled();
    expect(screen.getByLabelText("Non, l'arrêt n'est pas fait, sélectionné")).toBeTruthy();
  });

  it('refus de la base : le message s’affiche et la saisie reste', async () => {
    const { onEnregistrer, onFermer } = await feuille(jest.fn(async () => 'Cette fonction demande une mise à jour de la base.'), 'non', 'Accès impossible');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText('Cette fonction demande une mise à jour de la base.')).toBeTruthy();
    expect(onEnregistrer).toHaveBeenCalledTimes(1);
    expect(onFermer).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Accès impossible')).toBeTruthy();
  });

  it('correction : s’ouvre sur le choix déjà fait avec son commentaire', async () => {
    await feuille(undefined, 'non', 'Matériel manquant');
    expect(screen.getByLabelText("Non, l'arrêt n'est pas fait, sélectionné")).toBeTruthy();
    expect(screen.getByDisplayValue('Matériel manquant')).toBeTruthy();
  });
});

describe('feuille de résultat : enregistrement qui plante', () => {
  it('une exception donne une phrase d’erreur, la saisie reste et le bouton se libère', async () => {
    const onEnregistrer = jest.fn(async () => {
      throw new Error('panne');
    });
    await feuille(onEnregistrer as never, 'non', 'Accès impossible');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText("L'enregistrement n'a pas pu se faire. Réessayez.")).toBeTruthy();
    expect(screen.getByDisplayValue('Accès impossible')).toBeTruthy();
    expect(screen.getByLabelText('Enregistrer').props.accessibilityState.busy).toBe(false);
  });
});

describe('liste des arrêts de la tournée', () => {
  const arret = (rang: number): Arret => ({
    id: `A${rang}`, rang, cle_endroit: `c${rang}`, signalement_ids: ['s'], position: { latitude: 45.5, longitude: -73.57 },
    arrivee_prevue: '2026-11-22T12:00:00Z', depart_prevu: '2026-11-22T12:10:00Z',
  });
  const statuts: Record<number, 'fait' | 'non_fait' | null> = { 1: 'fait', 2: 'non_fait', 3: null };

  it('montre fait, non fait avec son commentaire, et à faire ; toucher un arrêt permet de corriger', async () => {
    const onChoisir = jest.fn();
    await render(
      <FeuilleArrets
        visible
        arrets={[arret(1), arret(2), arret(3)]}
        statutDe={(a) => statuts[a.rang]}
        commentaireDe={(a) => (a.rang === 2 ? 'Grille brisée, à réparer' : null)}
        onChoisir={onChoisir}
        onFermer={jest.fn()}
      />,
    );
    expect(screen.getByText('Arrêts (3) : 1 à faire')).toBeTruthy();
    expect(screen.getByText('Fait')).toBeTruthy();
    expect(screen.getByText('Non fait')).toBeTruthy();
    expect(screen.getByText('À faire')).toBeTruthy();
    expect(screen.getByText('« Grille brisée, à réparer »')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Arrêt 2, .*non fait, commentaire : Grille brisée, à réparer\. Donner ou corriger/));
    expect(onChoisir).toHaveBeenCalledWith(expect.objectContaining({ rang: 2 }));
  });
});
