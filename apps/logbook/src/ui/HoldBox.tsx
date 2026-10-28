import { StyleSheet, Text, View } from 'react-native';

import { useFontSet, useTheme } from './preferences';

// Hold code in an outlined square (A-D), as the design. Sizes: 18 in the
// entry list, 22 on menu tiles, 26 in the entry sheet.
export function HoldBox({ code, size = 18 }: { code: string; size?: 18 | 22 | 24 | 26 }) {
  const c = useTheme();
  const f = useFontSet();
  return (
    <View
      style={[
        styles.hold,
        { width: size, height: size, borderRadius: size >= 24 ? 5 : 4, borderColor: c.text },
      ]}
    >
      <Text style={[styles.text, f.monoSemiBold, { color: c.text, fontSize: size <= 18 ? 12 : size <= 22 ? 13 : size === 24 ? 14 : 15 }]}>
        {code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hold: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { includeFontPadding: false },
});
