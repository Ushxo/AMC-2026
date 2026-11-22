import { fireEvent, render, screen } from '@testing-library/react-native';

import { Entete } from '../../components/ville/entete';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) }));

describe('Entete', () => {
  it('affiche le titre et, quand il y a un écran précédent, un bouton Retour qui revient en arrière', async () => {
    const goBack = jest.fn();
    await render(<Entete options={{ title: 'Équipes' }} back={{ title: 'x' }} navigation={{ goBack }} />);
    expect(screen.getByText('Équipes')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retour'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('sans écran précédent : pas de bouton Retour', async () => {
    await render(<Entete options={{ title: 'Tournées des équipes' }} navigation={{ goBack: jest.fn() }} />);
    expect(screen.getByText('Tournées des équipes')).toBeTruthy();
    expect(screen.queryByLabelText('Retour')).toBeNull();
  });
});
