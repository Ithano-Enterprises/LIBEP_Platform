import { screen, within } from '@testing-library/react-native';

import { devMenus, devSpecies, devVessel } from '../dev/fixtures/reference';
import { dayNames, monthNames, seasonGloss, strings, type Lang } from '../i18n/strings';
import { mountApp, press, seeded, startTripUI, textOf, walk, type Node } from './helpers';
import { tour } from './tour';

// Area 9: every string key in sw and en, no empty strings, no English left
// in Kiswahili mode on any screen (and the reverse), fish and vessel names
// never translated.

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: false, isInternetReachable: false })),
}));

jest.setTimeout(60_000);

type Tree = Record<string, unknown>;

function leaves(o: unknown, path = ''): [string, string][] {
  if (typeof o === 'string') return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

function shape(o: unknown): unknown {
  if (typeof o === 'string') return 'string';
  if (Array.isArray(o)) return o.map(shape);
  if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape((o as Tree)[k])]));
  return typeof o;
}

const placeholders = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();

describe('string tables', () => {
  it('sw and en have exactly the same keys (nested included)', () => {
    expect(shape(strings.en)).toEqual(shape(strings.sw));
    expect(dayNames.en).toHaveLength(7);
    expect(dayNames.sw).toHaveLength(7);
    expect(monthNames.en).toHaveLength(12);
    expect(monthNames.sw).toHaveLength(12);
    expect(Object.keys(seasonGloss.en)).toEqual(Object.keys(seasonGloss.sw));
  });

  it.each(['sw', 'en'] as Lang[])('%s: no empty or whitespace-padded strings', (lang) => {
    for (const [k, v] of leaves(strings[lang])) {
      expect([k, v.trim().length > 0]).toEqual([k, true]);
      expect([k, v]).toEqual([k, v.trim()]);
    }
    for (const v of [...dayNames[lang], ...monthNames[lang]]) expect(v.trim()).not.toBe('');
  });

  it('templates use the same {placeholders} in both languages', () => {
    const en = Object.fromEntries(leaves(strings.en));
    for (const [k, v] of leaves(strings.sw)) expect([k, placeholders(en[k])]).toEqual([k, placeholders(v)]);
  });

  it('no fish name is in the string tables (fish names are never translated)', () => {
    const fish = new Set(devSpecies.map((s) => s.local_name));
    for (const lang of ['sw', 'en'] as Lang[]) for (const [k, v] of leaves(strings[lang])) expect([k, fish.has(v)]).toEqual([k, false]);
  });
});

/** Every visible text, accessibility label and placeholder in a tree. */
function visibleStrings(tree: Node | Node[] | null): string[] {
  const out: string[] = [];
  walk(tree, (n) => {
    if (n.type === 'Text') out.push(textOf(n));
    for (const p of ['accessibilityLabel', 'placeholder', 'aria-label']) {
      const v = n.props[p];
      if (typeof v === 'string') out.push(v);
    }
  });
  return out.map((s) => s.trim()).filter(Boolean);
}

const quote = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Phrases that belong to one language only, as patterns ({n} etc. become wildcards). */
function onlyIn(lang: Lang): RegExp[] {
  const other: Lang = lang === 'sw' ? 'en' : 'sw';
  const mine = new Set([...leaves(strings[lang]).map(([, v]) => v), ...dayNames[lang], ...monthNames[lang], ...Object.values(seasonGloss[lang]).filter((v): v is string => !!v)]);
  const theirs = [...leaves(strings[other]).map(([, v]) => v), ...dayNames[other], ...monthNames[other], ...Object.values(seasonGloss[other]).filter((v): v is string => !!v)];
  return [...new Set(theirs)]
    .filter((v) => !mine.has(v) && v.length >= 3)
    .map((v) => new RegExp(`(^|[^A-Za-z])${quote(v).replace(/\\\{[a-z]+\\\}/g, '.*?')}($|[^A-Za-z])`));
}

// Words that are English whatever the string table says (hard-coded text).
const ENGLISH = /\b(No vessel|linked to this device|not found|Backspace|Entry|Save|Close|Back|Start|trip|catch)\b/;
// The design's own DEV FIXTURE markers, shown in both languages on purpose.
const MARKERS = [/^placeholder$/, /^placeholder list · hold codes: placeholder · /];

function foreign(lang: Lang) {
  const patterns = onlyIn(lang);
  const glosses = new Set(devSpecies.map((s) => s.english_gloss));
  return (s: string) =>
    !MARKERS.some((m) => m.test(s)) &&
    !(lang === 'en' && glosses.has(s)) &&
    (patterns.some((p) => p.test(s)) || (lang === 'sw' && ENGLISH.test(s)));
}

describe('no text from the other language on any screen', () => {
  // BUG-13: hard-coded English in Kiswahili mode: "No vessel linked to this
  // device." (S2.1 here; S1, S3.3 and S5 have the same line) and the keypad's
  // "Backspace" label read by TalkBack/VoiceOver. EntryDetailBody also has a
  // hard-coded "Entry not found." that no normal flow reaches.
  it.failing('Kiswahili mode: no English on any screen or label', async () => {
    const bad: Record<string, string[]> = {};
    const isForeign = foreign('sw');
    await tour((name, tree) => {
      const hits = visibleStrings(tree).filter(isForeign);
      if (hits.length) bad[name] = [...new Set(hits)];
    }, { lang: 'sw' });
    expect(bad).toEqual({});
  });

  it('Kiswahili mode: the main flow (trip home, S1, S3.3, S4, S5) has no English text on screen', async () => {
    const bad: Record<string, string[]> = {};
    const isForeign = foreign('sw');
    await tour((name, tree) => {
      if (name === 'S2.1 no vessel linked') return; // covered by BUG-13 above
      const texts: string[] = [];
      walk(tree, (n) => n.type === 'Text' && texts.push(textOf(n).trim()));
      const hits = texts.filter(Boolean).filter(isForeign);
      if (hits.length) bad[name] = [...new Set(hits)];
    }, { lang: 'sw' });
    expect(bad).toEqual({});
  });

  it('English mode: no Kiswahili-only text on any screen or label', async () => {
    const bad: Record<string, string[]> = {};
    const isForeign = foreign('en');
    await tour((name, tree) => {
      const hits = visibleStrings(tree).filter(isForeign);
      if (hits.length) bad[name] = [...new Set(hits)];
    }, { lang: 'en' });
    expect(bad).toEqual({});
  });
});

describe('names that are never translated', () => {
  it('fish keep their local name in English (gloss only added), vessel name and registration unchanged', async () => {
    for (const lang of ['sw', 'en'] as Lang[]) {
      const ctx = await seeded();
      const r = mountApp(ctx, { lang });
      await screen.findByText(devVessel.name);
      expect(screen.getByText(devVessel.registration)).toBeTruthy();
      await startTripUI();
      press('primary');
      await screen.findByTestId('search');
      for (const name of devMenus[20]) {
        const tile = screen.getByTestId(`fish-${name}`);
        expect(within(tile).getByText(name)).toBeTruthy();
        const gloss = devSpecies.find((s) => s.local_name === name)!.english_gloss;
        if (lang === 'en') expect(within(tile).getByText(gloss)).toBeTruthy();
        else expect(within(tile).queryByText(gloss)).toBeNull();
      }
      r.unmount();
    }
  });
});
