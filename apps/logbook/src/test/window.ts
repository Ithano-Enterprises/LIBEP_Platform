import { act } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

// Window size for screen tests: the design's phone (360×740) and tablet
// (1280×800) frames.
export const PHONE = { width: 360, height: 740 };
export const TABLET = { width: 1280, height: 800 };

export function setWindow(size: { width: number; height: number }) {
  act(() => {
    Dimensions.set({ window: { ...size, scale: 2, fontScale: 1 }, screen: { ...size, scale: 2, fontScale: 1 } });
  });
}
