import { StyleSheet, Text } from 'react-native';

import { fonts } from '../theme/tokens';
import { useTheme } from './preferences';

// Dashed "placeholder" tag the design puts on features that are stubs.
export function PlaceholderTag() {
  const c = useTheme();
  return <Text style={[styles.tag, { color: c.dim, borderColor: c.border }]}>placeholder</Text>;
}

const styles = StyleSheet.create({
  tag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 3,
    lineHeight: 16,
  },
});
