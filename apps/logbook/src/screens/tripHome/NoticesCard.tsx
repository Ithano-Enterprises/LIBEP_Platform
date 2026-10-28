import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, touchTarget } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';

// Notices row. Only the training tip is shown, when the entries suggest
// guessed figures. The design's "approaching port" notice needs a port
// geofence and the site fee rule; both are open.
// [TO CONFIRM: approaching-port source and the different-site fee rule]
export function NoticesCard({ onDismiss }: { onDismiss: () => void }) {
  const c = useTheme();
  const t = useStrings();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const f = useFontSet();
  const count = 1;

  return (
    <View testID="notices" style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.head}>
        <Pressable
          testID="notices-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={styles.headButton}
        >
          <Icon name="info" size={18} color={c.dim} />
          <Text style={[styles.title, f.sansSemiBold, { color: c.text }]} numberOfLines={1}>
            {count} {count === 1 ? t.notice1 : t.noticeN}
          </Text>
          <PlaceholderTag />
          <Icon name={open ? 'chevU' : 'chevD'} size={18} strokeWidth={2} color={c.dim} />
        </Pressable>
        <Pressable
          testID="notices-dismiss"
          accessibilityRole="button"
          accessibilityLabel={t.dismissL}
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Icon name="x" size={18} strokeWidth={2} color={c.dim} />
          <Text style={[styles.dismissText, f.sans, { color: c.text }]}>{t.dismissL}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={[styles.section, { borderTopColor: c.border }]}>
          <View style={styles.sectionHead}>
            <Icon name="bulb" size={18} color={c.accent} />
            <Text style={[styles.sectionTitle, f.sansSemiBold, { color: c.text }]}>{t.trainShort}</Text>
          </View>
          <Text style={[styles.line, f.sans, { color: c.text }]}>{t.trainLine}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setViewing(true)}
            style={({ pressed }) => [
              styles.view,
              { borderColor: c.border, backgroundColor: pressed ? c.raised : 'transparent' },
            ]}
          >
            <Icon name="chevR" size={18} strokeWidth={2} color={c.text} />
            <Text style={[styles.viewText, f.sansMedium, { color: c.text }]}>{t.view}</Text>
          </Pressable>
          {viewing ? (
            <Text style={[styles.stub, f.sans, { color: c.dim, borderColor: c.border }]}>{t.trainStub}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', height: touchTarget },
  headButton: {
    flex: 1,
    minWidth: 0,
    height: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  title: { flex: 1, minWidth: 0, fontSize: 15 },
  dismiss: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dismissText: { fontSize: 11, lineHeight: 12 },
  section: { marginHorizontal: 12, paddingTop: 12, paddingBottom: 12, paddingLeft: 26, borderTopWidth: 1, gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -26 },
  sectionTitle: { fontSize: 15 },
  line: { fontSize: 15, lineHeight: 20 },
  view: {
    alignSelf: 'flex-start',
    height: touchTarget,
    paddingHorizontal: 16,
    borderRadius: radius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewText: { fontSize: 17 },
  stub: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 18,
  },
});
