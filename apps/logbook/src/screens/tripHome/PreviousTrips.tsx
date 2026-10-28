import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClosedTrip, Entry } from '../../data/types';
import { radius, touchTarget } from '../../theme/tokens';
import { formatQuantity, formatTime, formatTripDate, sumKg } from '../../ui/format';
import { Icon } from '../../ui/Icon';
import { useFontSet, usePreferences, useStrings, useTheme, useUnit } from '../../ui/preferences';
import { TierChip } from '../../ui/TierChip';
import { HoldBox } from '../../ui/HoldBox';
import { tripState } from './model';
import { stateStyle } from './stateStyle';

// Collapsible list of closed trips, each expandable to its entries.
export function PreviousTrips({ trips, now }: { trips: ClosedTrip[]; now: Date }) {
  const unit = useUnit();
  const c = useTheme();
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const f = useFontSet();
  const [openTrip, setOpenTrip] = useState<string | null>(null);

  return (
    <>
      <Pressable
        testID="prev-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.toggle}
      >
        <Icon name={open ? 'chevU' : 'chevD'} size={18} strokeWidth={2} color={c.dim} />
        <Text style={[styles.toggleText, f.sansMedium, { color: c.dim }]}>{t.prevTrips.toUpperCase()}</Text>
        <Text style={[styles.toggleCount, f.mono, { color: c.dim }]}>{trips.length}</Text>
      </Pressable>
      {open
        ? trips.map((trip) => (
            <TripCard
              key={trip.start.trip_id}
              trip={trip}
              now={now}
              unit={unit}
              expanded={openTrip === trip.start.trip_id}
              onToggle={() =>
                setOpenTrip((id) => (id === trip.start.trip_id ? null : trip.start.trip_id))
              }
            />
          ))
        : null}
    </>
  );
}

function TripCard({
  trip,
  now,
  unit,
  expanded,
  onToggle,
}: {
  trip: ClosedTrip;
  now: Date;
  unit: 't' | 'kg';
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = useTheme();
  const t = useStrings();
  const { lang } = usePreferences();
  const f = useFontSet();
  const k = tripState(trip.entries);
  const s = stateStyle(k, c);
  const total = sumKg(trip.entries.map((e) => e.quantity));

  return (
    <View style={styles.trip}>
      <Pressable
        testID={`prev-trip-${trip.start.trip_id}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={[styles.card, { borderColor: c.border }]}
      >
        <Icon name={expanded ? 'chevU' : 'chevD'} size={18} strokeWidth={2} color={c.dim} />
        <View style={styles.cardText}>
          <Text style={[styles.date, f.sans, { color: c.text }]}>
            {formatTripDate(trip.start.departure_at, lang, now, t.yday)}
          </Text>
          <Text style={[styles.meta, f.mono, { color: c.dim }]} numberOfLines={1}>
            {trip.entries.length} {t.entriesWord}
          </Text>
        </View>
        <View style={styles.figure}>
          <Text style={[styles.total, f.monoSemiBold, { color: c.text }]}>{formatQuantity(total, unit)}</Text>
          <Text style={[styles.unit, f.mono, { color: c.dim }]}>{unit}</Text>
          <TierChip tier="S" />
        </View>
        <View style={styles.state}>
          <Icon name={s.icon} size={16} strokeWidth={2} color={s.color} />
          <Text style={[styles.stateText, f.sansMedium, { color: s.color }]}>{t.fShort[k]}</Text>
        </View>
      </Pressable>
      {expanded ? trip.entries.map((e) => <PrevEntry key={e.id} entry={e} unit={unit} />) : null}
    </View>
  );
}

function PrevEntry({ entry, unit }: { entry: Entry; unit: 't' | 'kg' }) {
  const c = useTheme();
  const f = useFontSet();
  return (
    <View testID={`prev-entry-${entry.id}`} style={[styles.entry, { backgroundColor: c.surface }]}>
      <View style={styles.entryLine}>
        <View style={styles.what}>
          <Icon name="fish" size={18} strokeWidth={1.6} color={c.dim} />
          <Text style={[styles.species, f.sans, { color: c.text }]} numberOfLines={1}>
            {entry.species_local_name}
          </Text>
          {entry.hold_code ? <HoldBox code={entry.hold_code} /> : null}
        </View>
        <View style={styles.figure}>
          <Text style={[styles.total, f.monoSemiBold, { color: c.text }]}>{formatQuantity(entry.quantity, unit)}</Text>
          <Text style={[styles.unit, f.mono, { color: c.dim }]}>{unit}</Text>
          <TierChip tier="S" />
        </View>
      </View>
      <Text style={[styles.meta, f.mono, { color: c.dim }]}>{formatTime(entry.recorded_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    height: touchTarget,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  toggleText: { fontSize: 13, letterSpacing: 1 },
  toggleCount: { fontSize: 13 },
  trip: { gap: 6 },
  card: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius,
  },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  date: { fontSize: 15 },
  meta: { fontSize: 13 },
  figure: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  total: { fontSize: 17, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, marginRight: 4 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stateText: { fontSize: 13 },
  entry: {
    height: 64,
    marginLeft: 12,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: radius,
    justifyContent: 'center',
    gap: 5,
  },
  entryLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  what: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  species: { fontSize: 15, flexShrink: 1 },
});
