import * as Location from 'expo-location';

import type { Gps } from './types';

// Position for a catch, read once when the captain picks a fish. No fix
// (permission refused, no signal, timeout) is stored as null, never guessed.

export type Locator = { getFix(): Promise<Gps | null> };

/** How long to wait for a fix. [TO CONFIRM: GPS timeout; GPS accuracy needs an ADR] */
export const FIX_TIMEOUT_MS = 10_000;

export const deviceLocator: Locator = {
  async getFix() {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), FIX_TIMEOUT_MS);
      });
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        timeout,
      ]).finally(() => clearTimeout(timer));
      if (!pos) return null;
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        gps_accuracy_m: pos.coords.accuracy ?? null,
      };
    } catch {
      return null;
    }
  },
};
