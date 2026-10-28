import { Pressable, StyleSheet } from 'react-native';

import { radius, touchTarget } from '../theme/tokens';
import { Icon } from './Icon';
import { useStrings, useTheme } from './preferences';

// Header back chevron (56dp), as on S1 and S3.3 in the design.
export function BackButton({ onPress }: { onPress: () => void }) {
  const c = useTheme();
  const t = useStrings();
  return (
    <Pressable
      testID="back"
      accessibilityRole="button"
      accessibilityLabel={t.back}
      onPress={onPress}
      style={({ pressed }) => [styles.back, pressed && { backgroundColor: c.raised }]}
    >
      <Icon name="back" size={24} strokeWidth={2} color={c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
