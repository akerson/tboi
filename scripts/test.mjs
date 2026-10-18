// Checks js/crafting.js against frto027's compiled reference implementation (reference/*/data.txt,
// a base64 WASM build of IsaacDecraftingHuijiGadget/bofwasm/main.cpp) for both game versions.
//
// Usage: node scripts/test.mjs [cases per version]

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import data from '../js/data.js';
import { craft, parseSeed, normalizeSeed, PICKUPS, RNG_SHIFTS } from '../js/crafting.js';
import { findRecipes, rankRecipes } from '../js/finder.js';

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
// --- recipe finder: craft a random bag, then the finder must list that bag, and only bags that work ---
const FINDER_CASES = [
  ['rep', {}], ['repplus', {}], ['rep', { sacredOrb: true, lateStage: true }], ['repplus', { greed: true, taintedLost: true }],
];
for (const [key, opts] of FINDER_CASES) {
  const version = data.versions[key];
  const seed = (rand() * 2 ** 32) >>> 0 || 1;
  const bag = Array.from({ length: 8 }, () => 1 + Math.floor(rand() * 29)).sort((a, b) => a - b);
  const target = craft(version, seed, bag, opts).candidates[0];
  const { packed, fixed, total } = findRecipes(version, seed, target, opts);
  assert.equal(packed.length, total * 8);
  const recipes = Array.from({ length: total }, (_, i) => Array.from(packed.subarray(i * 8, i * 8 + 8)));
  const listed = new Set([...recipes, ...fixed].map(r => r.join()));
  assert.ok(listed.has(bag.join()), `${key} finder missed seed=${seed} bag=[${bag}]`);
  // Random bags that make the target must be listed too.
  for (let i = 0; i < 50000; i++) {
    const other = Array.from({ length: 8 }, () => 1 + Math.floor(rand() * 29)).sort((a, b) => a - b);
    if (craft(version, seed, other, opts).candidates[0] === target) {
      assert.ok(listed.has(other.join()), `${key} finder missed seed=${seed} bag=[${other}]`);
    }
  }
  for (let i = 0; i < recipes.length; i += Math.ceil(recipes.length / 2000)) {
    assert.equal(craft(version, seed, recipes[i], opts).candidates[0], target, `${key} finder gave a wrong recipe [${recipes[i]}]`);
  }
  // Ranking against a partial bag: the bag's own pickups come first, exclusions are honored.
  const partial = bag.slice(0, 5);
  const ranked = rankRecipes(packed, partial, [], 20);
  assert.equal(ranked.bestAdd, 3, 'a bag that makes the target can be finished from its first 5 pickups');
  for (const { recipe, add, drop } of ranked.recipes.slice(0, ranked.closest)) {
    assert.equal(drop.length, 0);
    assert.deepEqual([...partial, ...add].sort((a, b) => a - b), recipe);
  }
  const banned = [...new Set(bag.slice(5))].filter(p => !partial.includes(p));
  const filtered = rankRecipes(packed, partial, banned, 20);
  for (const { add } of filtered.recipes) assert.ok(add.every(p => !banned.includes(p)), 'excluded pickup suggested');
  console.log(`${key} finder: ${total} recipes for item ${target} on seed ${seed}, all checked ones correct`);
}

console.log('all tests passed');
