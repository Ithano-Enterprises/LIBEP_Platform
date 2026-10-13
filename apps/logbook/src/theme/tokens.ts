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

// Font family names as registered by useFonts() in App.tsx.
export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

// Minimum tap target used by the design for header buttons.
export const touchTarget = 56;
export const radius = 10;
