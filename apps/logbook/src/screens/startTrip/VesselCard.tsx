import { StyleSheet, Text, View } from 'react-native';

import type { DeviceProfile } from '../../data/types';
import { radius } from '../../theme/tokens';
import { Icon, type IconName } from '../../ui/Icon';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';

// S1 vessel card: name, registration, then class, zone and assigned site.
export function VesselCard({ profile }: { profile: DeviceProfile }) {
  const c = useTheme();
  const t = useStrings();
  const f = useFontSet();
  return (
    <View testID="vessel-card" style={[styles.card, { backgroundColor: c.surface }]}>
      <Text style={[styles.label, f.sansMedium, { color: c.dim }]}>{t.vessel}</Text>
      <View style={styles.names}>
        <Text style={[styles.name, f.sansSemiBold, { color: c.text }]}>{profile.vessel.name}</Text>
        <Text style={[styles.reg, f.mono, { color: c.dim }]}>{profile.vessel.registration}</Text>
      </View>
      <View style={styles.chips}>
        <Chip icon="weight">
          <Text style={[styles.chipMono, f.monoSemiBold, { color: c.text }]}>{`${profile.vessel.tonnage_class} t`}</Text>
        </Chip>
        <Chip icon="wave">
          <Text style={[styles.chipText, f.sansMedium, { color: c.text }]}>{t.zone}</Text>
        </Chip>
        <Chip icon="pin">
          <Text style={[styles.chipText, f.sansMedium, { color: c.text }]}>{profile.home_site.name}</Text>
          <Text style={[styles.assigned, f.mono, { color: c.dim }]}>({t.assigned})</Text>
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
    fontSize: 13,
    letterSpacing: 13 * 0.08,
    textTransform: 'uppercase',
  },
  names: { gap: 3 },
  name: { fontSize: 26, lineHeight: 28 },
  reg: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  chipText: { fontSize: 15 },
  chipMono: { fontSize: 13 },
  assigned: { fontSize: 12 },
});
