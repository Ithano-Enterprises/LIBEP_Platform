// Schematic basemap of the Lamu archipelago, copied from the design (My
// Grounds). Not to scale: the design marks it as a placeholder until a
// cached map is built. Coordinates are the design's 400×480 drawing space.

export const LAND: string[] = [
  // mainland
  '-600,-600 1000,-600 1000,-20 420,0 372,10 336,20 310,40 296,62 289,85 262,96 232,100 205,106 182,112 160,130 138,160 118,195 98,232 80,262 66,282 56,290 42,300 28,316 16,340 4,372 -12,410 -40,460 -600,700',
  // Lamu Island
  '66,306 92,300 110,314 112,336 98,360 76,376 52,380 40,368 42,342 52,322',
  // Manda
  '114,296 122,272 140,252 160,240 176,244 178,262 164,284 140,300 120,304',
  // Manda Toto
  '183,232 193,227 198,235 189,242',
  // Pate
  '152,196 156,168 172,146 196,132 222,128 244,138 242,158 224,176 198,192 172,204',
  // Kiwayu
  '322,84 332,62 348,44 362,36 366,44 352,64 338,84 328,92',
];

/** Place names (never translated). `a` is the label side, as the design. */
export const PLACES: { n: string; x: number; y: number; a: 'l' | 'L' | 'c' | 'b' | 't'; dot?: boolean; major?: boolean }[] = [
  { n: 'Mokowe', x: 56, y: 290, a: 'L', major: true },
  { n: 'Lamu', x: 100, y: 314, dot: true, a: 'l', major: true },
  { n: 'Shela', x: 108, y: 338, dot: true, a: 'l' },
  { n: 'Kipungani', x: 46, y: 366, dot: true, a: 'b' },
  { n: 'Manda', x: 146, y: 276, a: 'c', major: true },
  { n: 'Manda Toto', x: 182, y: 236, a: 'l' },
  { n: 'Pate', x: 196, y: 180, a: 'c', major: true },
  { n: 'Faza', x: 214, y: 134, dot: true, a: 't' },
  { n: 'Kiwayu', x: 344, y: 92, a: 'b', major: true },
  { n: 'Mkokoni', x: 289, y: 85, dot: true, a: 't' },
];

/** Home port marker, where the design draws it. [TO CONFIRM: other home ports] */
export const HOME_PORT = { x: 56, y: 290 };
/** Default view centre and drawing size the view fits, as the design. */
export const VIEW = { cx: 200, cy: 230, w: 400, h: 390 };

/**
 * Places a GPS position on the schematic. A straight-line fit of the
 * design's own spot coordinates to where it draws them; good to within
 * tens of units, because the drawing is not to scale.
 * [TO CONFIRM: real projection once a cached map exists]
 */
export function project(lat: number, lon: number): { x: number; y: number } {
  return { x: 587.68 * lon - 23923.75, y: -771.1 * lat - 1449.32 };
}

/** Heat cells are drawn this big (design), whatever the grid cell size. */
export const CELL_DRAW = 32;
