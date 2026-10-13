// Checks js/crafting.js against frto027's compiled reference implementation (reference/*/data.txt,
// a base64 WASM build of IsaacDecraftingHuijiGadget/bofwasm/main.cpp) for both game versions.
//
// Usage: node scripts/test.mjs [cases per version]

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import data from '../js/data.js';
import { craft, parseSeed, normalizeSeed, PICKUPS, RNG_SHIFTS } from '../js/crafting.js';

const CASES = Number(process.argv[2] ?? 20000);
const read = path => readFileSync(new URL('../reference/' + path, import.meta.url), 'utf8');

// --- constants copied by hand must match the C++ source ---
const cpp = read('repplus/main.cpp');
const cppNumbers = name => cpp.match(new RegExp(name + '\\[\\]\\s*=\\s*\\{([\\s\\S]*?)\\}'))[1]
  .match(/0x[0-9a-f]+/gi).map(Number);
assert.deepEqual(RNG_SHIFTS, cppNumbers('rng_offsets'), 'RNG shift table');
assert.deepEqual(PICKUPS.slice(1).map(p => p.value), cppNumbers('score_matrix').slice(1, 30), 'pickup values');

// --- seeds ---
assert.equal(parseSeed('JKD9 Z0C9'), 1302889765);
assert.equal(parseSeed('jkd9z0c9'), 1302889765);
assert.equal(parseSeed('JKD9 Z0C8'), null, 'bad checksum');
assert.equal(parseSeed('JKD9'), null);
assert.equal(normalizeSeed('jkd9-zoc9'), 'JKD9 Z0C9');

// --- known recipes ---
const rep = data.versions.rep, repplus = data.versions.repplus;
assert.deepEqual(craft(rep, 1302889765, [15, 15, 15, 15, 15, 15, 15, 15]).candidates[0], 37, '8 bombs = Mr. Boom on Repentance');
assert.deepEqual(craft(repplus, 1302889765, [15, 15, 15, 15, 15, 15, 15, 15]).candidates[0], 106, '8 bombs = Mr. Mega on Repentance+');
assert.deepEqual(craft(rep, 1302889765, [8, 8, 8, 8, 8, 8, 8, 8]).candidates[0], 177, '8 pennies = Portable Slot');

// --- randomized comparison against the reference WASM ---
async function loadReference(dir) {
  const base64 = read(dir + '/data.txt').replace(/^data:application\/wasm;base64,/, '').trim();
  const { instance } = await WebAssembly.instantiate(Buffer.from(base64, 'base64'), {});
  const e = instance.exports;
  e._initialize?.();
  const buffer = () => new Uint8Array(e.memory.buffer, e.getRecipeBuffer(), 8);
  return (seed, bag, o) => {
    e.setSafeArg(+!!o.daily, +!!o.greed, +!!o.challenge, o.lateStage ? 7 : 1,
      +!!o.keeper, +!!o.lostBR, +!!o.taintedLost, +!!o.sacredOrb, +!!o.goldenNo);
    buffer().set(bag);
    return e.getResult(seed) >>> 0;
  };
}

// Deterministic PRNG so failures are reproducible.
let state = 0x9E3779B9;
const rand = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
const OPTION_KEYS = ['greed', 'daily', 'challenge', 'lateStage', 'keeper', 'lostBR', 'taintedLost', 'sacredOrb', 'goldenNo'];

for (const key of ['rep', 'repplus']) {
  const reference = await loadReference(key);
  const version = data.versions[key];
  let mismatches = 0;
  for (let i = 0; i < CASES; i++) {
    const seed = (rand() * 2 ** 32) >>> 0 || 1;
    // Mix uniform bags with bags built from a few pickup types (to hit special pools and fixed recipes).
    const palette = rand() < 0.5 ? null : Array.from({ length: 1 + Math.floor(rand() * 3) }, () => 1 + Math.floor(rand() * 29));
    const bag = Array.from({ length: 8 }, () => palette ? palette[Math.floor(rand() * palette.length)] : 1 + Math.floor(rand() * 29));
    const opts = {};
    if (i % 4 === 0) for (const k of OPTION_KEYS) if (rand() < 0.25) opts[k] = true;

    const expected = reference(seed, bag, opts);
    const actual = craft(version, seed, bag, opts).candidates[0];
    if (actual !== expected && ++mismatches <= 5) {
      console.error(`${key} mismatch: seed=${seed} bag=[${bag}] opts=${JSON.stringify(opts)} expected ${expected}, got ${actual}`);
    }
  }
  console.log(`${key}: ${CASES - mismatches}/${CASES} match the reference`);
  assert.equal(mismatches, 0, `${key} mismatches`);
}
console.log('all tests passed');
