import type { StateKey } from '../../i18n/strings';
import type { Palette } from '../../theme/tokens';
import type { IconName } from '../../ui/Icon';

// Icon, colour and left edge per entry state, from the design's STATES.
export function stateStyle(k: StateKey, c: Palette): { icon: IconName; color: string; edge: string } {
  switch (k) {
    case 'device':
      return { icon: 'device', color: c.text, edge: 'transparent' };
    case 'waiting':
      return { icon: 'clock', color: c.danger, edge: c.danger };
    case 'sent':
      return { icon: 'check', color: c.ok, edge: 'transparent' };
    case 'checking':
      return { icon: 'search', color: c.accent, edge: c.accent };
  }
}
