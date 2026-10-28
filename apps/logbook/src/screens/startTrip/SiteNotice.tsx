import { StyleSheet, Text, View } from 'react-native';

import { radius } from '../../theme/tokens';
import { Icon } from '../../ui/Icon';
import { PlaceholderTag } from '../../ui/PlaceholderTag';
import { useFontSet, useStrings, useTheme } from '../../ui/preferences';

// S1 wrong-site notice. A placeholder in the design.
// [TO CONFIRM: wrong-site rule and landing fee with the client]
export function SiteNotice({ site }: { site: string }) {
  const c = useTheme();
  const t = useStrings();
  const f = useFontSet();
  return (
    <View testID="site-notice" style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Icon name="info" size={18} color={c.dim} />
          <Text style={[styles.titleText, f.sansSemiBold, { color: c.text }]}>{t.assignedTitle.replace('{site}', site)}</Text>
        </View>
        <PlaceholderTag />
      </View>
      <Text style={[styles.line, f.sans, { color: c.text }]}>{t.uploadLine}</Text>
      <Text style={[styles.fee, f.sans, { color: c.dim }]}>{t.feeLine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: radius, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  titleText: { fontSize: 17, flexShrink: 1 },
  line: { fontSize: 15, lineHeight: 20 },
  fee: { fontSize: 13, lineHeight: 18 },
});
