import { StyleSheet, Text, View } from 'react-native';

import type { DeviceProfile } from '../../data/types';
import { fonts, radius } from '../../theme/tokens';
import { Icon, type IconName } from '../../ui/Icon';
import { useStrings, useTheme } from '../../ui/preferences';

// S1 vessel card: name, registration, then class, zone and assigned site.
export function VesselCard({ profile }: { profile: DeviceProfile }) {
  const c = useTheme();
  const t = useStrings();
  return (
    <View testID="vessel-card" style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.label, { color: c.dim }]}>{t.vessel}</Text>
      <View style={styles.names}>
        <Text style={[styles.name, { color: c.text }]}>{profile.vessel.name}</Text>
        <Text style={[styles.reg, { color: c.dim }]}>{profile.vessel.registration}</Text>
      </View>
      <View style={styles.chips}>
        <Chip icon="weight">
          <Text style={[styles.chipMono, { color: c.text }]}>{`${profile.vessel.tonnage_class} t`}</Text>
        </Chip>
        <Chip icon="wave">
          <Text style={[styles.chipText, { color: c.text }]}>{t.zone}</Text>
        </Chip>
        <Chip icon="pin">
          <Text style={[styles.chipText, { color: c.text }]}>{profile.home_site.name}</Text>
          <Text style={[styles.assigned, { color: c.dim }]}>({t.assigned})</Text>
        </Chip>
      </View>
    </View>
  );
}

function Chip({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: c.raised }]}>
      <Icon name={icon} size={16} color={c.text} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius, gap: 10 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    letterSpacing: 13 * 0.08,
    textTransform: 'uppercase',
  },
  names: { gap: 3 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 26, lineHeight: 28 },
  reg: { fontFamily: fonts.mono, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 15 },
  chipMono: { fontFamily: fonts.monoSemiBold, fontSize: 13 },
  assigned: { fontFamily: fonts.mono, fontSize: 12 },
});
