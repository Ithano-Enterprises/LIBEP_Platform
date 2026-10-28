import { useWindowDimensions } from 'react-native';

/** Two panes from this width up (design: phone below 600dp, tablet above). */
export const TABLET_MIN_WIDTH = 600;

export function useIsTablet(): boolean {
  return useWindowDimensions().width >= TABLET_MIN_WIDTH;
}
