// UI strings, Kiswahili (default) and English. Copied verbatim from the
// design reference (Catch Log v2, T table). Fish names are never translated
// and do not belong here.

export type Lang = 'sw' | 'en';

export const sw = {
  trip: 'Safari ya leo',
  mode: 'Usiku / Mchana',
  langName: 'Kiswahili',
  noEntries: 'Hakuna maingizo bado',
  startToLog: 'Anza safari ili kurekodi samaki.',
};

export type Strings = typeof sw;

export const en: Strings = {
  trip: "Today's trip",
  mode: 'Night / Day',
  langName: 'English',
  noEntries: 'No entries yet',
  startToLog: 'Start a trip to log catch.',
};

export const strings: Record<Lang, Strings> = { sw, en };

export const langCode: Record<Lang, string> = { sw: 'SW', en: 'EN' };
