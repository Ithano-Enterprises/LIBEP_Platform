import { StyleSheet, Text } from 'react-native';

import { useFontSet, useTheme } from './preferences';

// Dashed "placeholder" tag the design puts on features that are stubs.
export function PlaceholderTag() {
  const c = useTheme();
  const f = useFontSet();
  return <Text style={[styles.tag, f.mono, { color: c.dim, borderColor: c.border }]}>placeholder</Text>;
}

const styles = StyleSheet.create({
  tag: {
    fontSize: 11,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 3,
    lineHeight: 16,
  },
});
