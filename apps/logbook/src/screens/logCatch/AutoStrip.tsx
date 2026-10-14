import { StyleSheet, Text, View } from 'react-native';

import type { Gps } from '../../data/types';
import { fonts, radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { useStrings, useTheme } from '../../ui/preferences';
import { formatGps } from './model';

// Fields the app captures by itself. Shown locked: the captain never types
// them. Zone and season have no source yet; water temp waits for a sensor.
export function AutoStrip({
  time,
  gps,
  locating,
  registration,
}: {
  time: string;
  gps: Gps | null;
  locating: boolean;
  registration: string;
}) {
  const c = useTheme();
  const t = useStrings();
  const cell = (label: string, value: string, span: 1 | 2 | 3, sub?: string, id?: string) => (
    <View style={[styles.cell, { flexBasis: `${(span / 3) * 100 - 4}%` }]}>
      <Text style={[styles.label, { color: c.dim }]}>{label}</Text>
      <Text testID={id} numberOfLines={1} style={[styles.value, { color: c.text }]}>
        {value}
      </Text>
      {sub ? <Text style={[styles.label, { color: c.dim }]}>{sub}</Text> : null}
    </View>
  );
  return (
    <View testID="auto-strip" style={[styles.box, { borderColor: c.border }]}>
      <View style={styles.title}>
        <Icon name="lock" size={14} strokeWidth={2} color={c.dim} />
        <Text style={[styles.titleText, { color: c.dim }]}>{t.auto}</Text>
      </View>
      <View style={styles.grid}>
        {cell(t.time, time, 1, undefined, 'auto-time')}
        {cell('GPS', locating ? '…' : formatGps(gps), 2, undefined, 'auto-gps')}
        {/* [TO CONFIRM: zone source] same label as the trip home chip */}
        {cell(t.zoneL, t.zone, 1)}
        {/* [TO CONFIRM: season source and months] */}
        {cell(t.season, '--', 1)}
        {/* [TO CONFIRM: water temperature sensor] */}
        {cell(t.waterTemp, '-- °C', 1, t.tempPending)}
        {cell(t.vesselIdL, registration, 3)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius,
    gap: 8,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 8 },
  cell: { gap: 2, minWidth: 0, flexGrow: 1 },
  label: { fontFamily: fonts.sans, fontSize: 12 },
  value: { fontFamily: fonts.monoMedium, fontSize: 13 },
});
