import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { mapPalettes, radius } from '../../theme/tokens';
import { formatQuantity } from '../../ui/format';
import { Icon, type IconName } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { useFontSet, usePreferences, useStrings, useTheme } from '../../ui/preferences';
import { CELL_DRAW, HOME_PORT, LAND, PLACES, project, VIEW } from './basemap';
import { heatColours } from './heat';
import { heatStep, metricValue, type Metric, type Spot } from './model';

const Z_MIN = 1;
const Z_MAX = 4;

// Schematic map with the heat grid. Cells carry their number when selected
// or zoomed in, never colour alone. Works offline: nothing is fetched.
export function GroundsMap({
  spots,
  metric,
  selected,
  onSelect,
  boat,
  homeName,
  legend = true,
}: {
  /** Home landing site, for the anchor's label. */
  homeName: string;
  spots: Spot[];
  metric: Metric;
  selected: string | null;
  onSelect: (key: string) => void;
  /** Latest position on the open trip, if any. */
  boat: { lat: number; lon: number } | null;
  legend?: boolean;
}) {
  const c = useTheme();
  const t = useStrings();
  const { mode } = usePreferences();
  const f = useFontSet();
  const map = mapPalettes[mode];
  const heat = heatColours(mode);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ z: 1, cx: VIEW.cx, cy: VIEW.cy });
  const [labels, setLabels] = useState(true);

  const fit = Math.min(size.w / VIEW.w, Math.max(size.h, 1) / VIEW.h);
  const k = fit * view.z;
  const P = (x: number, y: number) => [size.w / 2 + (x - view.cx) * k, size.h / 2 + (y - view.cy) * k] as const;
  const vb = [view.cx - size.w / (2 * k), view.cy - size.h / (2 * k), size.w / k, Math.max(size.h, 1) / k]
    .map((n) => (Number.isFinite(n) ? n.toFixed(2) : '0'))
    .join(' ');

  const values = spots.map((s) => metricValue(s, metric));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const label = (v: number) => (metric === 'trips' ? String(v) : formatQuantity(v));
  const blk = CELL_DRAW * k;

  const zoom = (d: number) =>
    setView((v) => {
      const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z + d));
      return z === Z_MIN ? { z, cx: VIEW.cx, cy: VIEW.cy } : { ...v, z };
    });
  const recentre = () => {
    const p = boat ? project(boat.lat, boat.lon) : HOME_PORT;
    setView((v) => ({ z: Math.max(v.z, 1.5), cx: p.x, cy: p.y }));
  };
  const [ax, ay] = P(HOME_PORT.x, HOME_PORT.y);
  const boatAt = boat ? project(boat.lat, boat.lon) : null;

  return (
    <View testID="grounds-map" style={[styles.wrap, { backgroundColor: map.sea }]}>
      <View style={styles.map} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {size.w > 0 ? (
          <>
            <Svg style={StyleSheet.absoluteFill} viewBox={vb} preserveAspectRatio="none">
              {LAND.map((points, i) => (
                <Polygon key={i} points={points} fill={map.land} stroke={map.landLine} strokeWidth={1 / k} />
              ))}
            </Svg>

            {labels
              ? PLACES.filter((p) => p.major || k >= 0.8).map((p) => {
                  const [px, py] = P(p.x, p.y);
                  return (
                    <View key={p.n} pointerEvents="none" style={[styles.place, placeAt(p.a, px, py)]}>
                      {p.dot ? <View style={[styles.dot, { backgroundColor: c.dim }]} /> : null}
                      <Text style={[styles.placeText, f.sans, { color: c.text }]}>{p.n}</Text>
                    </View>
                  );
                })
              : null}

            <View
              accessibilityLabel={homeName}
              style={[styles.anchor, { left: ax - 14, top: ay - 14, backgroundColor: c.bg, borderColor: c.text }]}
            >
              <Icon name="anchor" size={16} strokeWidth={2} color={c.text} />
            </View>

            {spots.map((s) => {
              const p = project(s.lat, s.lon);
              const [px, py] = P(p.x, p.y);
              const step = heatStep(metricValue(s, metric), min, max);
              const sel = selected === s.key;
              const hit = Math.max(blk, 56);
              const showVal = sel || view.z >= 1.5 || blk >= 40;
              const inside = showVal && blk >= 40;
              return (
                <Pressable
                  key={s.key}
                  testID={`cell-${s.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={`${label(metricValue(s, metric))} ${metric === 'trips' ? t.tripsWord : 't'}`}
                  onPress={() => onSelect(s.key)}
                  style={[styles.hit, { left: px - hit / 2, top: py - hit / 2, width: hit, height: hit, zIndex: sel ? 4 : 3 }]}
                >
                  <View
                    style={[
                      { width: blk, height: blk, backgroundColor: heat.fill[step - 1] },
                      sel && { borderWidth: 3, borderColor: c.text },
                    ]}
                  >
                    {inside ? (
                      <Text style={[styles.inLabel, f.monoSemiBold, { color: heat.on[step - 1] }]}>{label(metricValue(s, metric))}</Text>
                    ) : null}
                  </View>
                  {showVal && !inside ? (
                    <View style={[styles.pill, { top: hit / 2 - blk / 2 - 30, backgroundColor: c.bg, borderColor: c.text }]}>
                      <Text style={[styles.pillText, f.monoSemiBold, { color: c.text }]}>{label(metricValue(s, metric))}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}

            {boatAt ? (
              <View
                testID="boat"
                style={[
                  styles.boat,
                  { left: P(boatAt.x, boatAt.y)[0] - 16, top: P(boatAt.x, boatAt.y)[1] - 16, backgroundColor: c.bg, borderColor: c.text },
                ]}
              >
                <Icon name="boat" size={18} strokeWidth={2} color={c.text} />
              </View>
            ) : null}

            <View style={[styles.basemapTag, { backgroundColor: c.bg }]}>
              <PlaceholderTag />
              <Text style={[styles.basemapText, f.sans, { color: c.dim }]}>{t.basemap}</Text>
            </View>

            {size.h >= 124 ? (
              <View style={styles.controls}>
                <MapButton icon="plus" label={t.zoomIn} onPress={() => zoom(0.5)} />
                <MapButton icon="minus" label={t.zoomOut} onPress={() => zoom(-0.5)} />
                <MapButton icon="target" label={t.recentre} onPress={recentre} />
                <MapButton icon="layers" label={t.layers} onPress={() => setLabels((l) => !l)} active={labels} />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      {legend && spots.length ? (
        <View testID="legend" style={[styles.legend, { backgroundColor: c.bg, borderTopColor: c.border }]}>
          <Text style={[styles.legendLabel, f.sans, { color: c.dim }]}>{metric === 'trips' ? t.legendTrips : t.legendT}</Text>
          <View style={styles.swatches}>
            {heat.fill.map((f) => (
              <View key={f} style={[styles.swatch, { backgroundColor: f, borderColor: c.border }]} />
            ))}
          </View>
          <Text style={[styles.legendRange, f.monoMedium, { color: c.text }]}>
            {label(min)} → {label(max)} {metric === 'trips' ? t.tripsWord : 't'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MapButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active == null ? undefined : { selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mapButton,
        active
          ? { backgroundColor: c.raised, borderWidth: 2, borderColor: c.text }
          : { backgroundColor: pressed ? c.raised : c.surface, borderWidth: 1, borderColor: c.border },
      ]}
    >
      <Icon name={icon} size={22} strokeWidth={2} color={c.text} />
    </Pressable>
  );
}

// Label position beside its point, as the design's anchors (l, L, c, b, t).
function placeAt(a: string, x: number, y: number) {
  switch (a) {
    case 'l':
    case 'L':
      return { left: x - 166 - (a === 'L' ? 12 : 0), top: y - 9, width: 160, justifyContent: 'flex-end' as const };
    case 'b':
      return { left: x - 80, top: y + 2, width: 160, justifyContent: 'center' as const };
    case 't':
      return { left: x - 80, top: y - 22, width: 160, justifyContent: 'center' as const };
    default:
      return { left: x - 80, top: y - 9, width: 160, justifyContent: 'center' as const };
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  map: { flex: 1, overflow: 'hidden' },
  place: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  placeText: { fontSize: 12 },
  anchor: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  inLabel: { fontSize: 13, textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' },
  pill: {
    position: 'absolute',
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 13 },
  boat: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  basemapTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  basemapText: { fontSize: 11 },
  controls: { position: 'absolute', right: 8, bottom: 8, zIndex: 6, width: 118, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mapButton: { width: 56, height: 56, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
  legend: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderTopWidth: 1 },
  legendLabel: { fontSize: 13 },
  swatches: { flexDirection: 'row', gap: 2 },
  swatch: { width: 18, height: 12, borderRadius: 2, borderWidth: 1 },
  legendRange: { fontSize: 13 },
});
