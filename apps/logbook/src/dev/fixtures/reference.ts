// ============================================================================
// DEV FIXTURE: NOT REAL DATA.
// Seed data for development and Expo Go testing only, taken from the design
// prototype (Catch Log v2) and the examples in the frontend data contract.
// Every value here is a placeholder until the backend serves reference data.
// [TO CONFIRM: all vessels, sites, captains, species, menus and hold codes]
// ============================================================================

import type { HoldCode, TonnageClass } from '../../data/types';

export const DEV_FIXTURE = true;

// [TO CONFIRM: real landing site list and BMU names]
export const devLandingSite = {
  id: '576095dd-9d12-4023-b210-254f32d6b325',
  name: 'Mokowe', // contract example
  bmu: null, // [TO CONFIRM: BMU]
};

// A second site, so landing elsewhere can be tried on S4. Name from the
// design prototype. [TO CONFIRM: real landing site list and BMU names]
export const devOtherLandingSite = {
  id: '9d4f1c2e-7b3a-4e8f-a1d6-3c5b8e2f0a47',
  name: 'Lamu', // design prototype
  bmu: null, // [TO CONFIRM: BMU]
};

// [TO CONFIRM: real vessel registry]
export const devVessel = {
  id: 'f318f9ef-6b08-4d6a-844a-fece12e880a6',
  name: 'Baraka', // design prototype
  registration: 'KE-LAM-MKW-T20-014', // contract example format, not a real registration
  tonnage_class: 20 as TonnageClass, // design prototype default
  home_landing_site_id: devLandingSite.id,
  owner_name: null, // [TO CONFIRM: owner field]
};

// [TO CONFIRM: captain enrolment; the design has no captain name]
export const devCaptain = {
  id: '81c1d8ca-c4b7-4741-b0d0-555a04ac13e3',
  display_name: 'Nahodha (DEV)',
};

// Local names and English glosses from the design prototype.
// [TO CONFIRM: species list and glosses with the client]
export const devSpecies: { id: string; local_name: string; english_gloss: string }[] = [
  { id: '5cf987a4-f32f-4b97-a939-ca9ce4e8b00a', local_name: 'changu', english_gloss: 'emperor' },
  { id: '4af64e7d-21c0-4393-a630-f6516f713148', local_name: 'tafi', english_gloss: 'rabbitfish' },
  { id: '31f46975-da89-4c3f-8472-206d05e10db1', local_name: 'pono', english_gloss: 'parrotfish' },
  { id: 'c3906b79-8e9f-4402-b25f-64f6f85e8d68', local_name: 'tewa', english_gloss: 'grouper' },
  { id: '8b706c10-3feb-4908-a30f-5c946a28d5e4', local_name: 'nguru', english_gloss: 'kingfish' },
  { id: 'c55039d6-09a5-4ca5-82a4-ef3b696ccf6f', local_name: 'jodari', english_gloss: 'yellowfin tuna' },
  { id: '91ee5b95-b08f-4fc9-a285-e93c01e7ca66', local_name: 'kolekole', english_gloss: 'queenfish' },
  { id: '3ce242bb-1a32-4eb4-a6d2-84774b9122ca', local_name: 'pweza', english_gloss: 'octopus' },
  { id: '087cb742-67fa-48b9-83fd-3ca8a96d7073', local_name: 'kambakoche', english_gloss: 'lobster' },
  { id: '8d7fa4a3-e68c-459c-8d36-d29c406064cb', local_name: 'mzia', english_gloss: 'barracuda' },
  { id: '69ae06f5-72b6-44b3-ad03-076a16595a60', local_name: 'kibua', english_gloss: 'frigate tuna' },
  { id: '60ee2360-ebcb-4f33-8b81-2582a63015fa', local_name: 'chaa', english_gloss: 'mullet' },
  { id: '61850306-9eaa-42b0-8e0b-96f23bafa449', local_name: 'papa', english_gloss: 'shark' },
  { id: 'fb18b105-817a-4fba-8e05-dcc68fb12c26', local_name: 'taa', english_gloss: 'ray' },
  { id: '028374f9-ae27-4a47-a631-bc67c91e3647', local_name: 'dagaa', english_gloss: 'small pelagics' },
];

// Menu per tonnage class, in display order, from the design prototype.
// [TO CONFIRM: menus per vessel class, by client]
export const devMenus: Record<TonnageClass, string[]> = {
  10: ['changu', 'tafi', 'pono', 'tewa', 'kolekole', 'pweza', 'dagaa'],
  20: ['changu', 'tafi', 'tewa', 'nguru', 'kibua', 'mzia', 'kolekole'],
  50: ['nguru', 'kibua', 'jodari', 'mzia', 'papa'],
  100: ['jodari', 'nguru', 'papa', 'kibua', 'taa'],
};

// Hold code per species, from the design prototype (chaa has none there).
// [TO CONFIRM: species group or physical hold]
export const devHoldCodes: Record<string, HoldCode> = {
  changu: 'A', tafi: 'A', pono: 'A', tewa: 'A',
  nguru: 'B', kibua: 'B', jodari: 'B', mzia: 'B', kolekole: 'B', dagaa: 'B',
  pweza: 'C', kambakoche: 'C', papa: 'D', taa: 'D',
};

// Open trip: crew of 4 as in the design prototype; departure 2h30 before
// seeding so the trip always looks current. [TO CONFIRM: not real values]
export const devOpenTrip = { crewDeparted: 4, departedMinutesAgo: 150 };

// Sample entries so the trip home list can be checked on a phone. Species,
// quantities (the prototype's tonnes, in kg), positions and states copied
// from the design prototype's mock entries, oldest first. Times are relative to seeding.
// [TO CONFIRM: not real catches; GPS accuracy 15 m is the design's example]
type DevEntry = {
  species: string;
  kg: number;
  lat: number;
  lon: number;
  state: 'on_device' | 'waiting' | 'sent' | 'being_checked';
};

export const devOpenTripEntries: DevEntry[] = [
  { species: 'tafi', kg: 1400, lat: -2.24, lon: 41.05, state: 'sent' },
  { species: 'mzia', kg: 1300, lat: -2.25, lon: 41.04, state: 'being_checked' },
  { species: 'kibua', kg: 3100, lat: -2.26, lon: 41.02, state: 'sent' },
  { species: 'kolekole', kg: 1600, lat: -2.28, lon: 41.01, state: 'sent' },
  { species: 'changu', kg: 400, lat: -2.3, lon: 40.99, state: 'waiting' },
  { species: 'kibua', kg: 5600, lat: -2.31, lon: 40.97, state: 'waiting' },
  { species: 'nguru', kg: 1200, lat: -2.29, lon: 40.95, state: 'on_device' },
  { species: 'tewa', kg: 2400, lat: -2.27, lon: 40.93, state: 'on_device' },
];

// One closed trip from the previous day, all sent, each weighed at the
// plant (W, `plant` in kg), as in the design prototype's previous trip.
// [TO CONFIRM: not real weights; plant weighing granularity]
export const devPreviousTripEntries: (DevEntry & { plant: number })[] = [
  { species: 'changu', kg: 900, lat: -2.24, lon: 41.05, state: 'sent', plant: 800 },
  { species: 'tewa', kg: 1600, lat: -2.25, lon: 41.03, state: 'sent', plant: 1500 },
  { species: 'kibua', kg: 4800, lat: -2.27, lon: 41.0, state: 'sent', plant: 4500 },
  { species: 'nguru', kg: 2200, lat: -2.3, lon: 40.98, state: 'sent', plant: 2400 },
  { species: 'kibua', kg: 6400, lat: -2.29, lon: 40.96, state: 'sent', plant: 6100 },
];

// Plant weighing starts this long after the trip closes, one catch every
// few minutes. [TO CONFIRM: not real timings]
export const devPlantDelayMinutes = 30;
export const devPlantStepMinutes = 4;

// Extra closed trips for My grounds (S5), so the map has 3+ trips. Spots
// and species follow the design brief's mock spots; tonnes are smaller
// placeholders. One catch has no GPS fix, so the excluded row shows.
// [TO CONFIRM: not real catches or positions]
export const devGroundsTrips: {
  daysAgo: number;
  catches: { species: string; t: number; lat: number | null; lon: number | null }[];
}[] = [
  {
    daysAgo: 3,
    catches: [
      { species: 'changu', t: 1.2, lat: -2.31, lon: 40.94 },
      { species: 'tafi', t: 0.9, lat: -2.31, lon: 40.94 },
    ],
  },
  {
    daysAgo: 6,
    catches: [
      { species: 'kibua', t: 3.4, lat: -2.19, lon: 41.06 },
      { species: 'nguru', t: 1.1, lat: -2.19, lon: 41.06 },
      { species: 'tewa', t: 2.0, lat: -2.27, lon: 41.03 },
    ],
  },
  {
    daysAgo: 12,
    catches: [
      { species: 'changu', t: 1.5, lat: -2.17, lon: 40.98 },
      { species: 'tafi', t: 0.4, lat: null, lon: null },
    ],
  },
  {
    daysAgo: 41,
    catches: [
      { species: 'nguru', t: 3.0, lat: -1.98, lon: 41.31 },
      { species: 'kolekole', t: 1.4, lat: -1.98, lon: 41.31 },
    ],
  },
];

export const devGpsAccuracyM = 15;
export const devEntryStepMinutes = 17;
export const devTripHours = 6;
