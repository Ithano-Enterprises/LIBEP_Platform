import { useNetworkState } from 'expo-network';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DeviceProfile } from '../../data/types';
import { radius, touchTarget } from '../../theme/tokens';
import { Icon, type IconName } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { PreferenceToggles } from '../../ui/PreferenceToggles';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';

// S2.1 header (phone): vessel name and registration, the mode/language
// toggles, then the chips row with the offline button.
export function Header({ profile }: { profile: DeviceProfile }) {
  const c = useTheme();
  const t = useStrings();
  const net = useNetworkState();
  const f = useFontSet();
  const offline = net.isConnected === false || net.isInternetReachable === false;

  return (
    <View style={[styles.header, { borderBottomColor: c.border }]}>
      <View style={styles.top}>
        <View style={styles.vessel}>
          <Text style={[styles.name, f.sansSemiBold, { color: c.text }]} numberOfLines={1}>
            {profile.vessel.name}
          </Text>
          <Text style={[styles.reg, f.mono, { color: c.dim }]} numberOfLines={1}>
            {profile.vessel.registration}
          </Text>
        </View>
        <PreferenceToggles />
      </View>
      <View style={styles.chips}>
        <Chip icon="weight" mono label={`${profile.vessel.tonnage_class} t`} />
        <Chip icon="wave" label={t.zone} />
        <Chip icon="pin" label={profile.home_site.name} />
        {offline ? <OfflineButton /> : null}
      </View>
    </View>
  );
}

function Chip({ icon, label, mono }: { icon: IconName; label: string; mono?: boolean }) {
  const c = useTheme();
  const f = useFontSet();
  return (
    <View style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Icon name={icon} size={15} color={c.text} />
      <Text
        style={[
          mono ? [styles.chipMono, f.monoSemiBold] : [styles.chipText, f.sansMedium],
          { color: c.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function OfflineButton() {
  const c = useTheme();
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const f = useFontSet();
  return (
    <View style={styles.offlineWrap}>
      <Pressable
        testID="offline-button"
        accessibilityRole="button"
        accessibilityLabel={t.noSignal}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [
          styles.offline,
          { borderColor: c.border, backgroundColor: pressed ? c.raised : c.surface },
        ]}
      >
        <Icon name="wifiOff" size={18} strokeWidth={2} color={c.dim} />
        <Text style={[styles.offlineText, f.sans, { color: c.text }]}>{t.sigShort}</Text>
      </Pressable>
      {open ? (
        <View style={[styles.pop, { backgroundColor: c.raised, borderColor: c.border }]}>
          <View style={styles.popTitleRow}>
            <View style={styles.popTitle}>
              <Icon name="wifiOff" size={16} color={c.text} />
              <Text style={[styles.popTitleText, f.sansSemiBold, { color: c.text }]}>{t.noSignal}</Text>
            </View>
            <PlaceholderTag />
          </View>
          <Text style={[styles.popLine, f.sans, { color: c.dim }]}>{t.sigLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, zIndex: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vessel: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 24, lineHeight: 28 },
  reg: { fontSize: 13 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: touchTarget, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 1,
  },
  chipText: { fontSize: 15 },
  chipMono: { fontSize: 13 },
  offlineWrap: { marginLeft: 'auto' },
  offline: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  offlineText: { fontSize: 11, lineHeight: 12, textAlign: 'center' },
  pop: {
    position: 'absolute',
    top: 60,
    right: 0,
    width: 240,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
  },
  popTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  popTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  popTitleText: { fontSize: 15 },
  popLine: { fontSize: 13, lineHeight: 18 },
});
