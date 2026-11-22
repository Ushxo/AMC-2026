import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Endroit } from '../../../types';
import { Bouton } from '../bouton';
import { Champ } from '../champ';
import { ListeEndroits } from '../liste-endroits';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const endroit = (cle: string, nombre: number): Endroit => ({
  cle,
  position: { latitude: 45.5, longitude: -73.57 },
  nombre,
  gravite_choisie_max: 'elevee',
  gravite_par_nombre: 'faible',
  gravite_affichee: 'elevee',
  etat_dominant: 'nouveau',
  signalements: [],
});

describe('finition : erreurs, activité, liste de secours', () => {
  it('un champ invalide dit quoi corriger, à côté du champ', async () => {
    await render(<Champ etiquette="Courriel" value="" onChangeText={() => {}} erreur="Entrez votre courriel." />);
    expect(screen.getByText('Entrez votre courriel.')).toBeTruthy();
    expect(screen.getByLabelText('Courriel').props.accessibilityHint).toBe('Entrez votre courriel.');
  });

  it('sans erreur, aucun message', async () => {
    await render(<Champ etiquette="Courriel" value="" onChangeText={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un bouton occupé est désactivé et indique son activité', async () => {
    const onPress = jest.fn();
    await render(<Bouton titre="Calcul…" occupe onPress={onPress} />);
    const bouton = screen.getByRole('button');
    expect(bouton.props.accessibilityState.busy).toBe(true);
    await fireEvent.press(bouton);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('liste des endroits : repliée, puis dépliée avec un bouton par endroit', async () => {
    const onOuvrir = jest.fn();
    await render(<ListeEndroits endroits={[endroit('a', 3), endroit('b', 1)]} onOuvrir={onOuvrir} />);
    expect(screen.queryByText(/3 signalements ouverts/)).toBeNull();
    await fireEvent.press(screen.getByText('Afficher la liste des endroits (2)'));
    await fireEvent.press(screen.getByLabelText('3 signalements ouverts, gravité Élevée. Voir le suivi.'));
    expect(onOuvrir).toHaveBeenCalledWith(expect.objectContaining({ cle: 'a' }));
  });
});
