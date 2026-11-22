import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundary, MESSAGE_PROBLEME } from '../../components/ville/erreur-ecran';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children }: { children?: unknown }) => <View>{children as never}</View> };
});

describe('ErrorBoundary du mode Ville', () => {
  it('affiche « Un problème est survenu. » et relance au bouton Réessayer, sans montrer le détail', async () => {
    const retry = jest.fn(async () => {});
    const journal = jest.spyOn(console, 'error').mockImplementation(() => {});
    await render(<ErrorBoundary error={new Error("Cannot read property 'id' of undefined")} retry={retry} />);
    expect(screen.getByText(MESSAGE_PROBLEME)).toBeTruthy();
    expect(MESSAGE_PROBLEME).toBe('Un problème est survenu.');
    expect(screen.queryByText(/Cannot read/)).toBeNull();
    await fireEvent.press(screen.getByText('Réessayer'));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(journal).toHaveBeenCalledWith('Erreur de rendu :', "Cannot read property 'id' of undefined", expect.anything());
    journal.mockRestore();
    void Text;
  });
});
