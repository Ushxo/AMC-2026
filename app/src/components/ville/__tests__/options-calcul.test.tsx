import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Equipe, PositionEquipe } from '../../../types';
import { OPTIONS_PAR_DEFAUT } from '../../../lib/options-calcul';
import { OptionsCalcul } from '../options-calcul';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const MAINTENANT = Date.parse('2026-11-22T22:30:00Z');
const equipe = (id: string, nom: string, garage_adresse?: string): Equipe => ({
  id,
  nom,
  membres: [],
  vehicule: null,
  garage: { latitude: 45.5, longitude: -73.57 },
  ...(garage_adresse ? { garage_adresse } : {}),
  debut_quart: '07:00',
  fin_quart: '14:00',
  active: true,
  exemple_demo: false,
});
const equipes = [equipe('e1', 'Équipe 1', '800 rue X'), equipe('e2', 'Équipe 2')];
const positions: PositionEquipe[] = [{ equipe_id: 'e1', position: { latitude: 45.5, longitude: -73.5 }, cap: null, maj_le: '2026-11-22T22:25:00Z' }];

describe('options du calcul par équipe', () => {
  it('une ligne par équipe avec son départ et son arrivée ; le détail s’ouvre au toucher', async () => {
    await render(<OptionsCalcul options={OPTIONS_PAR_DEFAUT} onChanger={() => {}} equipes={equipes} positions={positions} maintenant={MAINTENANT} />);
    expect(screen.getByText('Équipe 1')).toBeTruthy();
    expect(screen.getByText('Équipe 2')).toBeTruthy();
    expect(screen.getAllByText('Départ : garage · Arrivée : garage').length).toBe(2);
    expect(screen.queryByText('Dernière position à', { exact: false })).toBeNull();
    await fireEvent.press(screen.getByLabelText(/^Équipe 1\. /));
    expect(screen.getAllByText(/Garage \(800 rue X\)/).length).toBeGreaterThan(0);
    expect(screen.getByText('Dernière position à', { exact: false })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Équipe 2\. /));
    expect(screen.getAllByText('Aucune position récente.').length).toBe(1); // équipe 2 : aucune position
  });

  it('la position actuelle se choisit pour l’équipe qui en a une, et pas pour l’autre ; raccourcis', async () => {
    const onChanger = jest.fn();
    await render(<OptionsCalcul options={OPTIONS_PAR_DEFAUT} onChanger={onChanger} equipes={equipes} positions={positions} maintenant={MAINTENANT} />);
    await fireEvent.press(screen.getByLabelText(/^Équipe 1\. /));
    await fireEvent.press(screen.getByLabelText(/^Équipe 2\. /));
    const boutons = screen.getAllByLabelText('Position actuelle');
    expect(boutons[1].props.accessibilityState.disabled).toBe(true); // équipe 2
    await fireEvent.press(boutons[0]);
    expect(onChanger).toHaveBeenLastCalledWith(expect.objectContaining({ departParEquipe: { e1: 'position' } }));
    await fireEvent.press(screen.getByText('Toutes à leur position'));
    expect(onChanger).toHaveBeenLastCalledWith(expect.objectContaining({ departParEquipe: { e1: 'position' } })); // seulement celles qui ont une position récente
    await fireEvent.press(screen.getByText('Toutes au garage'));
    expect(onChanger).toHaveBeenLastCalledWith(expect.objectContaining({ departParEquipe: {} }));
  });

  it('« Répartir le travail également » est une bascule ; « Gérer » mène aux équipes', async () => {
    const onChanger = jest.fn();
    const onGerer = jest.fn();
    await render(<OptionsCalcul options={OPTIONS_PAR_DEFAUT} onChanger={onChanger} equipes={equipes} positions={[]} maintenant={MAINTENANT} onGerer={onGerer} />);
    await fireEvent(screen.getByLabelText('Répartir le travail entre les équipes'), 'valueChange', false);
    expect(onChanger).toHaveBeenLastCalledWith(expect.objectContaining({ repartir: false }));
    await fireEvent.press(screen.getByLabelText('Gérer les équipes'));
    expect(onGerer).toHaveBeenCalled();
  });

  it('« Finir à un endroit » : option avancée globale qui demande un repère', async () => {
    const onChanger = jest.fn();
    const { rerender } = await render(<OptionsCalcul options={OPTIONS_PAR_DEFAUT} onChanger={onChanger} equipes={equipes} positions={[]} maintenant={MAINTENANT} />);
    await fireEvent(screen.getByLabelText('Finir à un endroit'), 'valueChange', true);
    expect(onChanger).toHaveBeenLastCalledWith(expect.objectContaining({ finEndroit: true }));
    await rerender(<OptionsCalcul options={{ ...OPTIONS_PAR_DEFAUT, finEndroit: true }} onChanger={onChanger} equipes={equipes} positions={[]} maintenant={MAINTENANT} />);
    expect(screen.getByText('Touchez un repère sur la carte pour choisir où finir.')).toBeTruthy();
  });
});
