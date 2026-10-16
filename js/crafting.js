// Bag of Crafting simulation for The Binding of Isaac: Repentance / Repentance+.
//
// The algorithm was reverse engineered by frto027 for the Huiji wiki
// (https://github.com/frto027/IsaacBagOfCraftingHuijiGadget,
//  https://github.com/frto027/IsaacDecraftingHuijiGadget, CC BY-NC-SA 3.0).
// This is an independent JavaScript port. Like the game (and frto027's C++ version)
// it does its weight math in 32-bit floats, which matters for seeds near a boundary.

const f32 = Math.fround;

// The 29 craftable pickups, indexed by the game's crafting component id.
// value = how much the pickup adds to the bag's quality score.
export const PICKUPS = [
  null,
  { name: 'Red Heart', value: 1 },
  { name: 'Soul Heart', value: 4 },
  { name: 'Black Heart', value: 5 },
  { name: 'Eternal Heart', value: 5 },
  { name: 'Gold Heart', value: 5 },
  { name: 'Bone Heart', value: 5 },
  { name: 'Rotten Heart', value: 1 },
  { name: 'Penny', value: 1 },
  { name: 'Nickel', value: 3 },
  { name: 'Dime', value: 5 },
  { name: 'Lucky Penny', value: 8 },
  { name: 'Key', value: 2 },
  { name: 'Golden Key', value: 7 },
  { name: 'Charged Key', value: 5 },
  { name: 'Bomb', value: 2 },
  { name: 'Golden Bomb', value: 7 },
  { name: 'Giga Bomb', value: 10 },
  { name: 'Micro Battery', value: 2 },
  { name: "Lil' Battery", value: 4 },
  { name: 'Mega Battery', value: 8 },
  { name: 'Card', value: 2 },
  { name: 'Pill', value: 2 },
  { name: 'Rune', value: 4 },
  { name: 'Dice Shard', value: 4 },
  { name: 'Cracked Key', value: 2 },
  { name: 'Golden Penny', value: 7 },
  { name: 'Golden Pill', value: 7 },
  { name: 'Golden Battery', value: 7 },
  { name: 'Poop', value: 0 },
];

export const PICKUP_COUNT = 31; // ids 0..30; 0 is "empty"
const COLLECTIBLE_COUNT = 733;

// xorshift shift triples; the game picks a triple by index.
export const RNG_SHIFTS = [
  1, 5, 16, 1, 5, 19, 1, 9, 29, 1, 11, 6, 1, 11, 16, 1, 19, 3, 1, 21, 20, 1, 27, 27,
  2, 5, 15, 2, 5, 21, 2, 7, 7, 2, 7, 9, 2, 7, 25, 2, 9, 15, 2, 15, 17, 2, 15, 25,
  2, 21, 9, 3, 1, 14, 3, 3, 26, 3, 3, 28, 3, 3, 29, 3, 5, 20, 3, 5, 22, 3, 5, 25,
  3, 7, 29, 3, 13, 7, 3, 23, 25, 3, 25, 24, 3, 27, 11, 4, 3, 17, 4, 3, 27, 4, 5, 15,
  5, 3, 21, 5, 7, 22, 5, 9, 7, 5, 9, 28, 5, 9, 31, 5, 13, 6, 5, 15, 17, 5, 17, 13,
  5, 21, 12, 5, 27, 8, 5, 27, 21, 5, 27, 25, 5, 27, 28, 6, 1, 11, 6, 3, 17, 6, 17, 9,
  6, 21, 7, 6, 21, 13, 7, 1, 9, 7, 1, 18, 7, 1, 25, 7, 13, 25, 7, 17, 21, 7, 25, 12,
  7, 25, 20, 8, 7, 23, 8, 9, 23, 9, 5, 14, 9, 5, 25, 9, 11, 19, 9, 21, 16, 10, 9, 21,
  10, 9, 25, 11, 7, 12, 11, 7, 16, 11, 17, 13, 11, 21, 13, 12, 9, 23, 13, 3, 17, 13, 3, 27,
  13, 5, 19, 13, 17, 15, 14, 1, 15, 14, 13, 15, 15, 1, 29, 17, 15, 20, 17, 15, 23, 17, 15, 26,
];

export function rngNext(seed, shiftIndex) {
  const a = RNG_SHIFTS[shiftIndex * 3], b = RNG_SHIFTS[shiftIndex * 3 + 1], c = RNG_SHIFTS[shiftIndex * 3 + 2];
  seed = (seed ^ (seed >>> a)) >>> 0;
  seed = (seed ^ (seed << b)) >>> 0;
  seed = (seed ^ (seed >>> c)) >>> 0;
  return seed;
}

// ---------------------------------------------------------------------------
// Seeds

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTWXYZ01234V6789';

/** Normalizes user input like "jkd9z0c9" or "JKD9-Z0C9" to "JKD9 Z0C9". */
export function normalizeSeed(text) {
  const chars = text.toUpperCase().replace(/O/g, '0').replace(/I/g, '1').replace(/[^A-Z0-9]/g, '');
  return chars.length <= 4 ? chars : chars.slice(0, 4) + ' ' + chars.slice(4, 8);
}

/**
 * Converts a seed string to the game's 32-bit start seed.
 * Returns null if the text is not a valid seed (wrong characters or bad checksum).
 */
export function parseSeed(text) {
  const chars = normalizeSeed(text).replace(' ', '');
  if (chars.length !== 8) return null;
  const n = [...chars].map(ch => SEED_ALPHABET.indexOf(ch));
  if (n.includes(-1)) return null;

  // 8 characters x 5 bits = 40 bits: 32 bits of seed followed by an 8-bit checksum.
  let packed = 0;
  for (let i = 0; i < 6; i++) packed = packed * 32 + n[i];
  const seed = ((packed * 4 + (n[6] >>> 3)) ^ 0xFEF7FFD) >>> 0;

  let checksum = 0;
  for (let rest = seed; rest !== 0; rest >>>= 5) {
    const sum = ((rest & 0xFF) + checksum) & 0xFF;
    checksum = ((sum >>> 7) + 2 * sum) & 0xFF;
  }
  if (checksum !== ((n[7] | (n[6] << 5)) & 0xFF)) return null;
  return seed === 0 ? null : seed;
}

// ---------------------------------------------------------------------------
// Crafting

/** Bag quality score: the sum of the pickup values. */
export function bagScore(bag) {
  return bag.reduce((sum, id) => sum + PICKUPS[id].value, 0);
}

export function qualityRange(score) {
  if (score > 34) return [4, 4];
  if (score > 26) return [3, 4];
  if (score > 22) return [2, 4];
  if (score > 18) return [2, 3];
  if (score > 14) return [1, 2];
  if (score > 8) return [0, 2];
  return [0, 1];
}

/**
 * Run conditions that make the game reject some items.
 * @typedef {object} RunOptions
 * @property {boolean} [greed]        Greed / Greedier mode
 * @property {boolean} [daily]        Daily challenge
 * @property {boolean} [challenge]    Any challenge run
 * @property {boolean} [lateStage]    Womb / Chapter 4 or later
 * @property {boolean} [keeper]       Playing as Keeper or Tainted Keeper
 * @property {boolean} [lostBR]       The Lost with Birthright
 * @property {boolean} [taintedLost]  Playing as Tainted Lost
 * @property {boolean} [sacredOrb]    Holding Sacred Orb
 * @property {boolean} [goldenNo]     Holding a golden or stacked NO! trinket
 */

export function poolFilterOk(item, opts) {
  const tags = item[2];
  if (opts.challenge && tags.includes('nochallenge')) return false;
  if (opts.daily && tags.includes('nodaily')) return false;
  if (opts.greed && tags.includes('nogreed')) return false;
  return true;
}

export function rollFilterOk(item, id, seed, opts) {
  const [, quality, tags] = item;
  if (!opts.greed && opts.lateStage && id === 697) return false;
  if (opts.keeper && tags.includes('nokeeper')) return false;
  if (opts.lostBR && tags.includes('nolostbr')) return false;
  if (opts.taintedLost) {
    if (!tags.includes('offensive')) return false;
    if (quality < 2 && rngNext((seed + id) >>> 0, 17) % 5 === 0) return false;
  }
  if (opts.sacredOrb) {
    if (quality < 2) return false;
    if (quality === 2 && rngNext((seed + id) >>> 0, 18) % 3 === 0) return false;
  }
  if (opts.goldenNo && quality === 0) return false;
  return true;
}

/**
 * The weighted item table a bag draws from. Depends only on the bag's score and on the
 * counts of the pickups that unlock extra pools, not on the seed.
 * @param {number[]} counts  how many of each pickup id (0..30) are in the bag
 */
export function itemWeights(version, counts, score, opts = {}) {
  // Each pickup type pulls in an item pool, weighted by how many of it are in the bag.
  // [pool id, weight]; pool ids follow the game's ItemPoolType enum.
  const poolWeights = [
    [0, 1], // treasure
    [1, 2], // shop
    [2, 2], // boss
    [4, counts[4] * 10], // angel: eternal hearts
    [3, counts[3] * 10], // devil: black hearts
    [5, counts[6] * 5], // secret: bone hearts
    [8, counts[5] * 10], // golden chest: gold hearts
    [12, counts[7] * 10], // curse: rotten hearts
    [9, counts[25] * 10], // red chest: cracked keys
    [7, counts[29] * 10], // shell game: poop
  ];
  // Planetarium: runes, but only with no pennies, keys, bombs or red hearts in the bag.
  if (counts[1] + counts[8] + counts[12] + counts[15] === 0) poolWeights.push([26, counts[23] * 10]);

  const weights = new Float32Array(COLLECTIBLE_COUNT);
  let total = 0;
  for (const [poolId, poolWeight] of poolWeights) {
    if (poolWeight <= 0) continue;
    // Angel, devil and secret pools are judged with a 5 point penalty.
    const [qmin, qmax] = qualityRange(poolId === 3 || poolId === 4 || poolId === 5 ? score - 5 : score);
    for (const [itemId, itemWeight] of version.pools[poolId]) {
      const item = version.items[itemId];
      if (item[1] < qmin || item[1] > qmax || !poolFilterOk(item, opts)) continue;
      const w = f32(f32(itemWeight) * poolWeight);
      total = f32(total + w);
      weights[itemId] = f32(weights[itemId] + w);
    }
  }
  return { weights, total };
}

/** One weighted draw from an itemWeights() table, given the advanced rng state. */
export function drawItem(weights, total, rng) {
  let remaining = drawPoint(total, rng);
  for (let id = 0; id < COLLECTIBLE_COUNT; id++) {
    if (weights[id] > remaining) return id;
    remaining = f32(remaining - weights[id]);
  }
  return 25;
}

/** Where in [0, total) a draw lands. */
export const drawPoint = (total, rng) => f32(f32(f32(2.3283062e-10) * f32(rng)) * total);

/**
 * Simulates crafting.
 *
 * @param {object} version   one entry of data.versions
 * @param {number} seed      32-bit start seed from parseSeed()
 * @param {number[]} bag     exactly 8 pickup ids (1..29), any order
 * @param {RunOptions} [opts]
 * @returns {{ fixed: boolean, candidates: number[] }}
 *   candidates[0] is what you get when every item is unlocked. If candidates[i] is
 *   an item you have not unlocked yet, the game moves on to candidates[i + 1].
 */
export function craft(version, seed, bag, opts = {}) {
  if (bag.length !== 8) throw new Error('bag must hold 8 pickups');
  const counts = new Array(PICKUP_COUNT).fill(0);
  for (const id of bag) counts[id]++;

  const isLocked = id => version.items[id][0] > 0;
  const candidates = [];

  const fixed = version.fixed[[...bag].sort((a, b) => a - b).join(',')];
  if (fixed !== undefined) {
    candidates.push(fixed);
    if (!isLocked(fixed)) return { fixed: true, candidates };
  }

  let rng = seed;
  for (let id = 0; id < PICKUP_COUNT; id++) {
    for (let j = 0; j < counts[id]; j++) rng = rngNext(rng, id);
  }

  const { weights, total } = itemWeights(version, counts, bagScore(bag), opts);

  // Draw until an item passes the run filters. The game gives up after 20 draws
  // and hands over whatever the 20th draw was.
  for (let attempt = 1; attempt <= 20; attempt++) {
    rng = rngNext(rng, 6);
    const selected = drawItem(weights, total, rng);
    const ok = rollFilterOk(version.items[selected], selected, seed, opts);
    if (ok || attempt === 20) {
      candidates.push(selected);
      if (!isLocked(selected)) break;
    }
  }
  return { fixed: false, candidates };
}
