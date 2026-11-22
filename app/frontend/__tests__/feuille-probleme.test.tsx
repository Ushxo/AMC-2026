import { fireEvent, render, screen } from '@testing-library/react-native';

import { FeuilleProbleme } from '../../src/components/citoyen/feuille-probleme';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

describe('feuille « Quel problème avez-vous observé ? »', () => {
  it('propose les quatre problèmes, se ferme au toucher du fond et continue avec le choix (voile clair sans module de flou)', async () => {
    const onChoisir = jest.fn();
    const onContinuer = jest.fn();
    const onFermer = jest.fn();
    await render(<FeuilleProbleme categorie="eau_accumulee" onChoisir={onChoisir} onContinuer={onContinuer} onFermer={onFermer} />);
    expect(screen.getByText('Quel problème avez-vous observé ?')).toBeTruthy();
    expect(screen.getByLabelText('Égout bouché')).toBeTruthy();
    expect(screen.getByLabelText("Accumulation d'eau ou inondation").props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText("Grille d'égout endommagée"));
    expect(onChoisir).toHaveBeenCalledWith('grille_endommagee');
    await fireEvent.press(screen.getByText('Continuer'));
    expect(onContinuer).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Fermer sans signaler'));
    expect(onFermer).toHaveBeenCalled();
  });
});
