import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { radius, touchTarget } from '../theme/tokens';
import { useTheme } from './preferences';

// 56 x 56 header button, as in the design's trip home header.
export function HeaderButton({
  onPress,
  label,
  testID,
  children,
}: {
  onPress: () => void;
  label: string;
  testID?: string;
  children: ReactNode;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? c.raised : c.surface, borderColor: c.border },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
