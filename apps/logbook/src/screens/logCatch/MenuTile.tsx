import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MenuItem } from '../../data/types';
import { radius } from '../../theme/tokens';
import { HoldBox } from '../../ui/HoldBox';
import { Icon } from '../../ui/Icon';
import { useFontSet, usePreferences, useTheme } from '../../ui/preferences';

// One fish on the S3.3 menu: local name (never translated), English gloss
// in English mode, hold code.
export function MenuTile({
  item,
  active,
  disabled,
  onPress,
  testID,
}: {
  item: MenuItem;
  testID?: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const { lang } = usePreferences();
  const f = useFontSet();
  return (
    <Pressable
      testID={testID ?? `fish-${item.local_name}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tile,
        active
          ? { backgroundColor: c.raised, borderWidth: 2, borderColor: c.accent }
          : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
      ]}
    >
      <Icon name="fish" size={22} color={c.dim} />
      <View style={styles.names}>
        <Text style={[styles.name, f.sansMedium, { color: c.text }]}>{item.local_name}</Text>
        {lang === 'en' && item.english_gloss ? (
          <Text style={[styles.gloss, f.sans, { color: c.dim }]}>{item.english_gloss}</Text>
        ) : null}
      </View>
      {item.hold_code ? (
        <View style={styles.hold}>
          <HoldBox code={item.hold_code} size={22} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 72,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: radius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  names: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontSize: 17, lineHeight: 20 },
  gloss: { fontSize: 13, lineHeight: 16 },
  hold: { alignSelf: 'flex-start' },
});
