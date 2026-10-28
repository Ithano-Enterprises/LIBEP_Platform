import { screen } from '@testing-library/react-native';

import type { Entry } from '../../../data/types';
import { renderWithProviders } from '../../../test/render';
import { EntryRow } from '../EntryRow';

const entry = {
  id: 'e1',
  recorded_at: '2026-01-01T03:00:00.000Z',
  species_id: null,
  species_local_name: 'pweza mdogo',
  quantity: 15,
  unit: 'kg',
  hold_code: null,
  sync_state: 'on_device',
} as Entry;

describe('EntryRow', () => {
  it('shows a 15 kg catch from the stored kg, in t or kg', () => {
    renderWithProviders(<EntryRow entry={entry} unit="t" />);
    expect(screen.getByText('0.015')).toBeTruthy();
    expect(screen.getByText('t')).toBeTruthy();
    screen.unmount();
    renderWithProviders(<EntryRow entry={entry} unit="kg" />);
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('shows an "Other" species name as typed', () => {
    renderWithProviders(<EntryRow entry={entry} />);
    expect(screen.getByText('pweza mdogo')).toBeTruthy();
  });
});
