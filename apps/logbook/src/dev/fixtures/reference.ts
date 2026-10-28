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
