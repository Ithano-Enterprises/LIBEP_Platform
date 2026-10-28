// UI strings, Kiswahili (default) and English. Copied verbatim from the
// design reference (Catch Log v2, T table). Fish names are never translated
// and do not belong here.

export type Lang = 'sw' | 'en';

/** Entry states as the design names them (sync_state on_device -> device, etc.). */
export type StateKey = 'device' | 'waiting' | 'sent' | 'checking';

export const sw = {
  trip: 'Safari ya leo',
  mode: 'Usiku / Mchana',
  langName: 'Kiswahili',
  noEntries: 'Hakuna maingizo bado',
  startToLog: 'Anza safari ili kurekodi samaki.',
  logCatch: 'Rekodi samaki',
  startTrip: 'Anza safari',
  closeTrip: 'Maliza safari',
  closed: 'Imefungwa',
  started: 'Ilianza',
  entriesWord: 'maingizo',
  prevTrips: 'Safari zilizopita',
  yday: 'jana',
  weighedShort: 'imepimwa',
  zone: 'Pwani',
  noSignal: 'Hakuna mtandao',
  sigShort: 'Hakuna mtandao',
  sigLine: 'Maingizo yanahifadhiwa kwenye kifaa na yatatumwa mtandao ukirudi.',
  notice1: 'arifa',
  noticeN: 'arifa',
  dismissL: 'Ondoa',
  trainShort: 'Kidokezo',
  trainLine: 'Maingizo matatu yana uzito uleule. Mwongozo mfupi unaweza kusaidia.',
  view: 'Tazama',
  trainStub: 'Mwongozo wa mafunzo · stub',
  // Not in the design: fallback until device enrolment exists.
  // [TO CONFIRM: Kiswahili wording]
  noVessel: 'Hakuna chombo kilichounganishwa na kifaa hiki.',
  states: {
    device: 'Kwenye kifaa',
    waiting: 'Inasubiri kutumwa',
    sent: 'Imetumwa',
    checking: 'Inakaguliwa',
  } as Record<StateKey, string>,
  fShort: {
    all: 'Zote',
    device: 'Kifaa',
    waiting: 'Inasubiri',
    sent: 'Imetumwa',
    checking: 'Ukaguzi',
  } as Record<StateKey | 'all', string>,
};

export type Strings = typeof sw;

export const en: Strings = {
  trip: "Today's trip",
  mode: 'Night / Day',
  langName: 'English',
  noEntries: 'No entries yet',
  startToLog: 'Start a trip to log catch.',
  logCatch: 'Log catch',
  startTrip: 'Start trip',
  closeTrip: 'Close trip',
  closed: 'Closed',
  started: 'Started',
  entriesWord: 'entries',
  prevTrips: 'Previous trips',
  yday: 'yesterday',
  weighedShort: 'weighed',
  zone: 'Shore',
  noSignal: 'No signal',
  sigShort: 'No signal',
  sigLine: 'Entries are saved on this device and send when signal returns.',
  notice1: 'notice',
  noticeN: 'notices',
  dismissL: 'Dismiss',
  trainShort: 'Tip',
  trainLine: 'Three entries have the same weight. A short guide may help.',
  view: 'View',
  trainStub: 'Training guide · stub',
  noVessel: 'No vessel linked to this device.',
  states: {
    device: 'Saved on device',
    waiting: 'Waiting to send',
    sent: 'Sent',
    checking: 'Being checked',
  },
  fShort: {
    all: 'All',
    device: 'On device',
    waiting: 'Waiting',
    sent: 'Sent',
    checking: 'Checking',
  },
};

export const strings: Record<Lang, Strings> = { sw, en };

export const langCode: Record<Lang, string> = { sw: 'SW', en: 'EN' };

// Day and month names for dates. Not in the design table; standard
// Kiswahili names. [TO CONFIRM: Kiswahili date wording with a speaker]
export const dayNames: Record<Lang, string[]> = {
  sw: ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export const monthNames: Record<Lang, string[]> = {
  sw: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
