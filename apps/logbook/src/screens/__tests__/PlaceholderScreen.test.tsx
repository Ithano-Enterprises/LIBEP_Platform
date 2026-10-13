import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '../../test/render';
import { DAY, NIGHT } from '../../theme/tokens';
import { PlaceholderScreen } from '../PlaceholderScreen';

const bg = () => StyleSheet.flatten(screen.getByTestId('screen').props.style).backgroundColor;

describe('PlaceholderScreen', () => {
  it('starts in Kiswahili and switches to English and back', () => {
    renderWithProviders(<PlaceholderScreen />);
    expect(screen.getByText('Safari ya leo')).toBeTruthy();
    expect(screen.getByText('SW')).toBeTruthy();

    fireEvent.press(screen.getByTestId('toggle-lang'));
    expect(screen.getByText("Today's trip")).toBeTruthy();
    expect(screen.getByText('EN')).toBeTruthy();

    fireEvent.press(screen.getByTestId('toggle-lang'));
    expect(screen.getByText('Safari ya leo')).toBeTruthy();
  });

  it('starts in Night mode and switches to Day', () => {
    renderWithProviders(<PlaceholderScreen />);
    expect(bg()).toBe(NIGHT.bg);

    fireEvent.press(screen.getByTestId('toggle-mode'));
    expect(bg()).toBe(DAY.bg);
  });

  it('labels the toggles for screen readers in the current language', () => {
    renderWithProviders(<PlaceholderScreen />);
    expect(screen.getByLabelText('Usiku / Mchana')).toBeTruthy();
    fireEvent.press(screen.getByTestId('toggle-lang'));
    expect(screen.getByLabelText('Night / Day')).toBeTruthy();
  });
});
