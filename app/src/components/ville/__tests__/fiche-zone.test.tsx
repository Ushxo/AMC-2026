import { fireEvent, render, screen } from '@testing-library/react-native';

import { sig } from '../../../lib/test-utils/fabrique';
import type { Zone } from '../../../lib/zones';
import { FicheZone } from '../fiche-zone';
import { libelleZone } from '../zones-signalements';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-maps', () => ({ Polygon: () => null }));

const s1 = sig({ gravite: 'faible', cree_le: '2026-11-20T10:00:00.000Z' });
const s2 = sig({ gravite: 'elevee', cree_le: '2026-11-22T10:00:00.000Z', categorie: 'eau_accumulee' });
const zone: Zone = {
  id: 'zone-1',
  polygones: [],
  gravite: 'elevee',
  signalement_ids: [s1.id, s2.id],
  premier_le: s1.cree_le,
  dernier_le: s2.cree_le,
};

describe('fiche de zone', () => {
  it('libellé d’accessibilité d’une zone', () => {
    expect(libelleZone({ ...zone, signalement_ids: ['a', 'b', 'c', 'd'] })).toBe('Zone de signalements, gravité élevée, 4 signalements');
    expect(libelleZone({ ...zone, gravite: 'faible', signalement_ids: ['a'] })).toBe('Zone de signalements, gravité faible, 1 signalement');
  });

  it('montre la gravité maximale, le nombre, les dates, le libellé « étendue estimée » et ouvre un signalement', async () => {
    const ouvrir = jest.fn();
    await render(<FicheZone zone={zone} signalements={[s1, s2]} onFermer={jest.fn()} onOuvrir={ouvrir} />);
    expect(screen.getByText('Gravité maximale : élevée')).toBeTruthy();
    expect(screen.getByText(/2 signalements · premier le .* · dernier le/)).toBeTruthy();
    expect(screen.getByText('Zones de signalements : étendue estimée')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Ouvrir$/ })).toHaveLength(2);
    await fireEvent.press(screen.getAllByRole('button', { name: /Ouvrir$/ })[0]);
    expect(ouvrir).toHaveBeenCalledTimes(1);
  });

  it('fermée quand aucune zone n’est choisie', async () => {
    await render(<FicheZone zone={null} signalements={[]} onFermer={jest.fn()} onOuvrir={jest.fn()} />);
    expect(screen.queryByText('Zone de signalements')).toBeNull();
  });
});
