import { StyleSheet } from 'react-native';

import { strings } from '../i18n/strings';
import { textOf, walk, type Node } from './helpers';
import { tour } from './tour';

// Area 10: accessibility, as far as a test can see it. Every Pressable has
// a role and a label; icon-only buttons have an accessibilityLabel; primary
// buttons are at least 64dp tall and others at least 56dp (from styles);
// entry states show an icon and text, never colour alone.

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: false, isInternetReachable: false })),
}));

jest.setTimeout(60_000);

/** Primary actions, 64dp in the design. */
const PRIMARY = new Set(['primary', 'save', 'submit', 'correct-save', 'flt-apply', 'grounds-back-trip', 'log-another']);
/** Full-screen scrims behind sheets: tapping outside closes the sheet. */
const SCRIM = /scrim$/;

type Pressable = { id: string; node: Node; screen: string };

const isPressable = (n: Node) => typeof n.props.onStartShouldSetResponder === 'function' && typeof n.props.onResponderRelease === 'function' && n.type === 'View';
const hasSvg = (n: Node) => {
  let found = false;
  walk(n, (x) => {
    if (x.type === 'RNSVGSvgView') found = true;
  });
  return found;
};

async function collect(width?: number) {
  const found: Pressable[] = [];
  const statesSeen: { screen: string; text: string; parent: Node }[] = [];
  // State names only: fShort.all ("Zote") is the filter word and "Kifaa" is
  // also the provenance label for the device, so both are left out.
  const stateLabels = new Set(
    [...Object.values(strings.sw.states), ...Object.values(strings.sw.fShort)].filter((v) => v !== strings.sw.fShort.all && v !== strings.sw.deviceL),
  );
  await tour((screen, tree) => {
    const parents = new Map<Node, Node>();
    walk(tree, (n) => {
      for (const c of n.children ?? []) if (typeof c !== 'string') parents.set(c, n);
      if (isPressable(n)) found.push({ id: String(n.props.testID ?? `(no testID: ${textOf(n).slice(0, 30)})`), node: n, screen });
      if (n.type === 'Text' && stateLabels.has(textOf(n))) statesSeen.push({ screen, text: textOf(n), parent: parents.get(n)! });
    });
  }, { width });
  return { found, statesSeen };
}

const label = (n: Node) => (typeof n.props.accessibilityLabel === 'string' ? n.props.accessibilityLabel : '') || textOf(n).trim();
const size = (n: Node) => {
  const s = StyleSheet.flatten(n.props.style as never) as { height?: number; minHeight?: number } | undefined;
  return s?.height ?? s?.minHeight;
};
const describeAll = (list: Pressable[]) => [...new Set(list.map((p) => `${p.screen} › ${p.id}`))].sort();

let phone: Awaited<ReturnType<typeof collect>>;
let tablet: Awaited<ReturnType<typeof collect>>;
beforeAll(async () => {
  phone = await collect();
  tablet = await collect(1280);
});

describe.each([
  ['phone', () => phone],
  ['tablet', () => tablet],
] as const)('%s', (_, get) => {
  it('the tour reached many pressables', () => {
    expect(get().found.length).toBeGreaterThan(100);
  });

  // BUG-14: the sheet scrims (scrim, correct-scrim, flt-scrim, ex-scrim)
  // are Pressables with a label but no accessibilityRole, so a screen
  // reader announces an unnamed element covering the whole screen.
  it.failing('every Pressable has an accessibilityRole (scrims included)', () => {
    expect(describeAll(get().found.filter((p) => !p.node.props.accessibilityRole))).toEqual([]);
  });

  it('every Pressable other than a scrim has an accessibilityRole', () => {
    expect(describeAll(get().found.filter((p) => !SCRIM.test(p.id) && !p.node.props.accessibilityRole))).toEqual([]);
  });

  it('every Pressable has a label (its own or its text)', () => {
    expect(describeAll(get().found.filter((p) => !label(p.node)))).toEqual([]);
  });

  it('icon-only buttons carry an accessibilityLabel', () => {
    const iconOnly = get().found.filter((p) => !textOf(p.node).trim() && hasSvg(p.node));
    expect(iconOnly.length).toBeGreaterThan(3);
    expect(describeAll(iconOnly.filter((p) => !p.node.props.accessibilityLabel))).toEqual([]);
  });

  it('primary buttons are at least 64dp tall', () => {
    const primaries = get().found.filter((p) => PRIMARY.has(p.id));
    expect(new Set(primaries.map((p) => p.id)).size).toBeGreaterThanOrEqual(5);
    expect(describeAll(primaries.filter((p) => (size(p.node) ?? 0) < 64))).toEqual([]);
  });

  it('other buttons with a set height are at least 56dp', () => {
    const small = get().found.filter((p) => !PRIMARY.has(p.id) && !SCRIM.test(p.id) && size(p.node) != null && size(p.node)! < 56);
    expect(describeAll(small)).toEqual([]);
  });

  it('entry states are shown with an icon next to the text, not colour alone', () => {
    const seen = get().statesSeen;
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.filter((s) => !hasSvg(s.parent)).map((s) => `${s.screen} › ${s.text}`)).toEqual([]);
  });
});
