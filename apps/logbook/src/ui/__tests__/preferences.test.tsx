import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LogbookProvider } from '../../data/LogbookProvider';
import type { Repository } from '../../data/repository';
import { openTestRepo } from '../../test/sqlite';
import { PreferenceToggles } from '../PreferenceToggles';
import { PreferencesProvider, usePreferences } from '../preferences';

function Probe() {
  const { mode, lang, unit } = usePreferences();
  return <Text testID="probe">{`${mode} ${lang} ${unit}`}</Text>;
}

function mount(
  repo: Repository,
  props: { initialMode?: 'night' | 'day'; initialLang?: 'sw' | 'en'; initialUnit?: 't' | 'kg' } = {},
) {
  const open = () => Promise.resolve(repo);
  return render(
    <LogbookProvider open={open}>
      <PreferencesProvider {...props}>
        <PreferenceToggles />
        <Probe />
      </PreferencesProvider>
    </LogbookProvider>,
  );
}

describe('PreferencesProvider with the store', () => {
  it('keeps the language and mode the captain chose across a restart', async () => {
    const { repo } = await openTestRepo();
    const first = mount(repo);
    expect(await screen.findByTestId('probe')).toHaveTextContent('night sw kg');
    fireEvent.press(screen.getByTestId('toggle-lang'));
    fireEvent.press(screen.getByTestId('toggle-mode'));
    expect(screen.getByTestId('probe')).toHaveTextContent('day en kg');
    await act(async () => {});
    first.unmount();

    expect(await repo.getPreferences()).toMatchObject({ mode: 'day', lang: 'en' });
    mount(repo);
    expect(await screen.findByTestId('probe')).toHaveTextContent('day en kg');
  });

  it('shows no screen until the stored choice is read, so nothing flashes in the default', async () => {
    const { repo } = await openTestRepo();
    await repo.setPreference('mode', 'day');
    mount(repo);
    expect(screen.queryByTestId('probe')).toBeNull();
    expect(screen.getByTestId('prefs-splash')).toBeTruthy();
    expect(await screen.findByTestId('probe')).toHaveTextContent('day sw kg');
  });

  it('shows quantities in kg by default and in t once the stored unit is t', async () => {
    const { repo } = await openTestRepo();
    await repo.setPreference('unit', 't');
    mount(repo);
    expect(await screen.findByTestId('probe')).toHaveTextContent('night sw t');
  });

  it('lets explicit initial values override the stored ones', async () => {
    const { repo } = await openTestRepo();
    await repo.setPreference('lang', 'en');
    await repo.setPreference('unit', 't');
    mount(repo, { initialLang: 'sw', initialMode: 'night', initialUnit: 'kg' });
    expect(screen.getByTestId('probe')).toHaveTextContent('night sw kg');
    await act(async () => {});
    expect(screen.getByTestId('probe')).toHaveTextContent('night sw kg');
  });

  it('falls back to the defaults when the store cannot open', async () => {
    render(
      <LogbookProvider open={() => Promise.reject(new Error('disk full'))}>
        <PreferencesProvider>
          <Probe />
        </PreferencesProvider>
      </LogbookProvider>,
    );
    expect(await screen.findByTestId('probe')).toHaveTextContent('night sw kg');
  });
});
