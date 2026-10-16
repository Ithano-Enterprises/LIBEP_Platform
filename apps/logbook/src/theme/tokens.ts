// Per-weight subpaths export only the font file. The package index also
// pulls in expo-font, which tokens.ts does not need.
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { Platform, type TextStyle } from 'react-native';

// Design tokens copied verbatim from the design reference
// (Catch Log v2, NIGHT / DAY). Night is the default mode.

export type Mode = 'night' | 'day';

export type Palette = {
  bg: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  dim: string;
  accent: string;
  accentPress: string;
  danger: string;
  ok: string;
  onAccent: string;
};

export const NIGHT: Palette = {
  bg: '#0B1416',
  surface: '#16232A',
  raised: '#1E2F36',
  border: '#2C3F44',
  text: '#F2F5F3',
  dim: '#8FA3A4',
  accent: '#E8A33D',
  accentPress: '#C4842A',
  danger: '#E8654A',
  ok: '#3FBF7F',
  onAccent: '#12100A',
};

export const DAY: Palette = {
  bg: '#EFF2F1',
  surface: '#FFFFFF',
  raised: '#E3E9E7',
  border: '#C6D0CE',
  text: '#0B1416',
  dim: '#5A6B6C',
  accent: '#A8650B',
  accentPress: '#8A5208',
  danger: '#C43F24',
  ok: '#1E7A4C',
  onAccent: '#FFFFFF',
};

export const palettes: Record<Mode, Palette> = { night: NIGHT, day: DAY };

// Font roles used by text. Screens read the active set with useFontSet()
// rather than importing a family name, so a font-load failure can swap the
// whole app to system fonts.
export type FontRole = 'sans' | 'sansMedium' | 'sansSemiBold' | 'mono' | 'monoMedium' | 'monoSemiBold';
export type FontSet = Record<FontRole, Pick<TextStyle, 'fontFamily' | 'fontWeight'>>;

// IBM Plex font files, keyed by family name. App.tsx passes this map to
// useFonts(), so every family in plexFonts must be a key here.
export const plexFontAssets = {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
};

// IBM Plex, as registered from plexFontAssets. The weight is part of the
// family name, so no fontWeight is set.
export const plexFonts: FontSet = {
  sans: { fontFamily: 'IBMPlexSans_400Regular' },
  sansMedium: { fontFamily: 'IBMPlexSans_500Medium' },
  sansSemiBold: { fontFamily: 'IBMPlexSans_600SemiBold' },
  mono: { fontFamily: 'IBMPlexMono_400Regular' },
  monoMedium: { fontFamily: 'IBMPlexMono_500Medium' },
  monoSemiBold: { fontFamily: 'IBMPlexMono_600SemiBold' },
};

// Fallback when the Plex fonts fail to load: platform fonts with explicit
// weights so the hierarchy survives.
const systemSans = Platform.select({ android: 'sans-serif', default: 'System' });
const systemSansMedium = Platform.select({ android: 'sans-serif-medium', default: 'System' });
const systemMono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const systemFonts: FontSet = {
  sans: { fontFamily: systemSans, fontWeight: '400' },
  sansMedium: { fontFamily: systemSansMedium, fontWeight: '500' },
  sansSemiBold: { fontFamily: systemSansMedium, fontWeight: '600' },
  mono: { fontFamily: systemMono, fontWeight: '400' },
  monoMedium: { fontFamily: systemMono, fontWeight: '500' },
  monoSemiBold: { fontFamily: systemMono, fontWeight: '600' },
};

// Minimum tap target used by the design for header buttons.
export const touchTarget = 56;
export const radius = 10;
