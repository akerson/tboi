import data from './data.js';
import { PICKUPS, craft, parseSeed, normalizeSeed, bagScore } from './crafting.js';

const PICKUP_GROUPS = [
  ['Hearts', [1, 2, 3, 4, 5, 6, 7]],
  ['Coins', [8, 9, 10, 11, 26]],
  ['Keys', [12, 13, 14, 25]],
  ['Bombs', [15, 16, 17]],
  ['Batteries', [18, 19, 20, 28]],
  ['Other', [21, 22, 27, 23, 24, 29]],
];

const MODIFIERS = [
  ['lateStage', 'Womb or later', 'Chapter 4 onward. Vanishing Twin can no longer be crafted (outside Greed mode).'],
  ['greed', 'Greed / Greedier mode', 'Removes items that are banned in Greed mode.'],
  ['daily', 'Daily run', 'Removes items that are banned in daily runs.'],
  ['challenge', 'Challenge run', 'Removes items that are banned in challenges.'],
  ['keeper', 'Keeper or Tainted Keeper in the run', 'Co-op. Removes items Keeper cannot use.'],
  ['lostBR', 'The Lost with Birthright in the run', 'Co-op. Removes items The Lost cannot use.'],
  ['taintedLost', 'Tainted Lost in the run', 'Co-op. Only offensive items, and some low quality items are skipped.'],
  ['sacredOrb', 'Holding Sacred Orb', 'No quality 0 or 1 items, and a third of quality 2 items are skipped.'],
  ['goldenNo', 'Golden or stacked NO! trinket', 'No quality 0 items.'],
];

const STORAGE_KEY = 'tcain-calculator';
const $ = id => document.getElementById(id);

const state = {
  seedText: '',
  version: 'rep',
  bag: [],
  opts: {},
  ...loadState(),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return {};
    return {
      seedText: typeof saved.seedText === 'string' ? saved.seedText : '',
      version: saved.version in data.versions ? saved.version : 'rep',
      bag: Array.isArray(saved.bag) ? saved.bag.filter(id => PICKUPS[id]).slice(0, 8) : [],
      opts: saved.opts && typeof saved.opts === 'object' ? saved.opts : {},
    };
  } catch {
    return {};
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode); the calculator still works.
  }
}

// ---------- sprites ----------

function pickupIcon(id, size = 32) {
  const el = document.createElement('span');
  el.className = 'pickup-icon';
  el.style.backgroundPosition = `${-(id % 8) * size}px ${-Math.floor(id / 8) * size}px`;
  return el;
}

function itemIcon(id, size = 64) {
  const el = document.createElement('span');
  el.className = 'item-icon' + (size === 64 ? '' : ' small');
  const pos = data.sprites[id];
  if (pos) {
    el.style.backgroundPosition = `${-pos[0] * size}px ${-pos[1] * size}px`;
  } else {
    el.classList.add('missing');
    el.textContent = '?';
  }
  el.setAttribute('aria-hidden', 'true');
  return el;
}

const itemName = id => data.names[id]?.[0] ?? `Item #${id}`;
const wikiUrl = id => 'https://bindingofisaacrebirth.wiki.gg/wiki/' + encodeURIComponent(itemName(id).replace(/ /g, '_'));

// ---------- seed + version ----------

const seedInput = $('seed');
seedInput.value = normalizeSeed(state.seedText);

seedInput.addEventListener('input', () => {
  // Reformat as "XXXX XXXX" while keeping the caret after the same character.
  const caret = seedInput.selectionStart ?? seedInput.value.length;
  const charsBeforeCaret = seedInput.value.slice(0, caret).replace(/[^a-z0-9]/gi, '').length;
  const formatted = normalizeSeed(seedInput.value).slice(0, 9);
  seedInput.value = formatted;
  let pos = 0;
  for (let seen = 0; pos < formatted.length && seen < charsBeforeCaret; pos++) {
    if (formatted[pos] !== ' ') seen++;
  }
  seedInput.setSelectionRange(pos, pos);
  state.seedText = formatted;
  render();
});

for (const button of document.querySelectorAll('[data-version]')) {
  button.addEventListener('click', () => {
    state.version = button.dataset.version;
    render();
  });
}

// ---------- bag ----------

function addPickup(id) {
  // Like the real bag: once it holds 8, the oldest pickup falls out.
  if (state.bag.length === 8) state.bag.shift();
  state.bag.push(id);
  render();
}

$('clear').addEventListener('click', () => {
  state.bag = [];
  render();
});

function renderBag() {
  const bag = $('bag');
  bag.replaceChildren();
  for (let i = 0; i < 8; i++) {
    const id = state.bag[i];
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'slot' + (id ? ' filled' : '');
    if (id) {
      slot.append(pickupIcon(id));
      slot.title = `Remove ${PICKUPS[id].name}`;
      slot.setAttribute('aria-label', `Remove ${PICKUPS[id].name}`);
      slot.addEventListener('click', () => {
        state.bag.splice(i, 1);
        render();
      });
    } else {
      slot.disabled = true;
      slot.setAttribute('aria-label', 'Empty slot');
    }
    bag.append(slot);
  }
  $('bag-count').textContent = `${state.bag.length}/8`;
  const score = $('bag-score');
  score.hidden = state.bag.length === 0;
  score.textContent = `Value ${bagScore(state.bag)}`;
}

// ---------- picker ----------

function renderPicker() {
  const picker = $('picker');
  for (const [title, ids] of PICKUP_GROUPS) {
    const group = document.createElement('div');
    group.className = 'group';
    const heading = document.createElement('h3');
    heading.className = 'group-title';
    heading.textContent = title;
    const items = document.createElement('div');
    items.className = 'group-items';
    for (const id of ids) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pick';
      button.setAttribute('aria-label', `Add ${PICKUPS[id].name} (value ${PICKUPS[id].value})`);
      const name = document.createElement('span');
      name.className = 'pick-name';
      name.textContent = PICKUPS[id].name;
      const icon = document.createElement('span');
      icon.className = 'pick-icon';
      const value = document.createElement('span');
      value.className = 'pick-value';
      value.textContent = PICKUPS[id].value;
      icon.append(pickupIcon(id), value);
      button.append(icon, name);
      button.addEventListener('click', () => addPickup(id));
      items.append(button);
    }
    group.append(heading, items);
    picker.append(group);
  }
}

// ---------- modifiers ----------

function renderModifierList() {
  const list = $('modifier-list');
  for (const [key, label, description] of MODIFIERS) {
    const row = document.createElement('label');
    row.className = 'modifier';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!state.opts[key];
    input.addEventListener('change', () => {
      state.opts[key] = input.checked;
      render();
    });
    const text = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = label;
    const small = document.createElement('small');
    small.textContent = description;
    text.append(strong, small);
    row.append(input, text);
    list.append(row);
  }
}

// ---------- result ----------

function stars(quality) {
  const el = document.createElement('span');
  el.className = 'stars';
  el.textContent = '★'.repeat(quality) + '☆'.repeat(4 - quality);
  el.setAttribute('aria-label', `Quality ${quality}`);
  return el;
}

let lastResultKey = '';

/** Works out what the current bag makes, or why it can't be shown yet. */
function computeOutcome(seed) {
  const missing = 8 - state.bag.length;
  if (missing > 0) {
    return { message: `Add ${missing} more pickup${missing === 1 ? '' : 's'} to see what you'll craft.`, short: `${missing} more` };
  }
  if (seed === null && state.seedText.replace(' ', '').length === 8) {
    return { message: "That seed doesn't look right. Double check it on the pause screen.", short: 'Check seed' };
  }
  if (seed === null) return { message: 'Enter your run seed to see what you will craft.', short: 'Enter seed' };
  return craft(data.versions[state.version], seed, state.bag, state.opts);
}

function renderResult(outcome) {
  const box = $('result');
  if (outcome.message) {
    const el = document.createElement('div');
    el.className = 'result-empty';
    el.textContent = outcome.message;
    box.replaceChildren(el);
    lastResultKey = '';
    return;
  }

  const version = data.versions[state.version];
  const { fixed, candidates } = outcome;
  const [id, ...fallbacks] = candidates;

  const main = document.createElement('div');
  main.className = 'result-main';
  const info = document.createElement('div');
  const name = document.createElement('h3');
  name.className = 'result-name';
  name.textContent = itemName(id);
  const quote = document.createElement('p');
  quote.className = 'result-quote';
  quote.textContent = data.names[id]?.[1] || ' ';
  const meta = document.createElement('div');
  meta.className = 'result-meta';
  meta.append(stars(version.items[id][1]));
  if (fixed) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = 'Fixed recipe';
    chip.title = 'This recipe gives the same item on every seed';
    meta.append(chip);
  }
  const link = document.createElement('a');
  link.href = wikiUrl(id);
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Wiki ↗';
  meta.append(link);
  info.append(name, quote, meta);
  main.append(itemIcon(id), info);

  const children = [main];
  if (fallbacks.length) {
    const section = document.createElement('div');
    section.className = 'fallbacks';
    section.append(`Haven't unlocked ${itemName(id)} yet? The bag skips locked items and gives you:`);
    const list = document.createElement('ol');
    let previous = id;
    for (const next of fallbacks) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = itemName(next);
      const why = document.createElement('div');
      why.className = 'why';
      why.textContent = `if ${itemName(previous)} is locked`;
      text.append(strong, why);
      li.append(itemIcon(next, 40), text);
      list.append(li);
      previous = next;
    }
    section.append(list);
    children.push(section);
  }
  box.replaceChildren(...children);

  // Animate only when the result actually changes.
  const key = candidates.join();
  if (key !== lastResultKey) {
    main.classList.add('result-pop');
    lastResultKey = key;
  }
}

// ---------- preview ----------
// With 6 or 7 pickups in, try every way to fill the bag and list what each one makes.
// 6 pickups means 435 bags to check; at 5 it's 4,495 bags and ~600 distinct items,
// nearly everything in the value range, so the list stops being useful.

const PREVIEW_FROM = 6;
const PREVIEW_PAGE = 10;

// Rough rarity of each pickup, used to suggest the easiest way to finish a recipe.
// 0 = common, 1 = uncommon, 2 = rare.
const RARITY = [
  0,
  0, 0, 1, 1, 1, 1, 1, // hearts: red, soul, black, eternal, gold, bone, rotten
  0, 1, 1, 2, // coins: penny, nickel, dime, lucky penny
  0, 2, 1, // keys: key, golden key, charged key
  0, 2, 2, // bombs: bomb, golden bomb, giga bomb
  1, 1, 2, // batteries: micro, lil', mega
  0, 0, 1, 2, // card, pill, rune, dice shard
  1, 2, 2, 2, // cracked key, golden penny, golden pill, golden battery
  0, // poop
];

/** All multisets of `size` pickup ids, as sorted arrays. */
function pickupCombos(size, from = 1) {
  if (size === 0) return [[]];
  const combos = [];
  for (let id = from; id < PICKUPS.length; id++) {
    for (const rest of pickupCombos(size - 1, id)) combos.push([id, ...rest]);
  }
  return combos;
}

let previewCache = { key: '', items: [] };
let previewShowAll = false;

/** Distinct items the bag can still become, alphabetical, each with its easiest completion. */
function previewItems(seed) {
  const key = [state.version, seed, [...state.bag].sort((a, b) => a - b), JSON.stringify(state.opts)].join('|');
  if (previewCache.key === key) return previewCache.items;

  const version = data.versions[state.version];
  const byItem = new Map();
  for (const add of pickupCombos(8 - state.bag.length)) {
    const id = craft(version, seed, [...state.bag, ...add], state.opts).candidates[0];
    const cost = add.reduce((sum, p) => sum + RARITY[p], 0);
    const entry = byItem.get(id);
    if (!entry) byItem.set(id, { id, add, cost, ways: 1 });
    else {
      entry.ways++;
      if (cost < entry.cost) Object.assign(entry, { add, cost });
    }
  }
  const items = [...byItem.values()].sort((a, b) => itemName(a.id).localeCompare(itemName(b.id)));
  previewCache = { key, items };
  return items;
}

function renderPreview(seed) {
  const box = $('preview');
  const show = state.bag.length >= PREVIEW_FROM && state.bag.length < 8;
  box.hidden = !show;
  if (!show) {
    previewShowAll = false;
    return;
  }

  const list = $('preview-list');
  const more = $('preview-more');
  const search = $('preview-search');
  const missing = 8 - state.bag.length;
  if (seed === null) {
    $('preview-count').textContent = '';
    $('preview-note').textContent = 'Enter a valid seed to see every item the last pickups could make.';
    search.hidden = true;
    more.hidden = true;
    list.replaceChildren();
    return;
  }

  const version = data.versions[state.version];
  const items = previewItems(seed);
  const query = search.value.trim().toLowerCase();
  const matches = query ? items.filter(e => itemName(e.id).toLowerCase().includes(query)) : items;
  const shown = previewShowAll || query ? matches : matches.slice(0, PREVIEW_PAGE);

  search.hidden = false;
  $('preview-count').textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  $('preview-note').textContent =
    `Every way to add the last ${missing === 1 ? 'pickup' : `${missing} pickups`}. Tap one to add it. Assumes everything is unlocked.`;

  const rows = shown.map(entry => {
    const li = document.createElement('li');
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'preview-row';
    const addNames = entry.add.map(p => PICKUPS[p].name).join(' and ');
    row.setAttribute('aria-label', `Add ${addNames} to make ${itemName(entry.id)}`);
    const info = document.createElement('span');
    info.className = 'preview-info';
    const name = document.createElement('strong');
    name.textContent = itemName(entry.id);
    info.append(name, stars(version.items[entry.id][1]));
    if (entry.ways > 1) {
      const ways = document.createElement('span');
      ways.className = 'preview-ways';
      ways.textContent = `${entry.ways} ways`;
      info.append(ways);
    }
    const add = document.createElement('span');
    add.className = 'preview-add';
    add.title = `Add ${addNames}`;
    add.append('+', ...entry.add.map(p => pickupIcon(p)));
    row.append(itemIcon(entry.id, 40), info, add);
    row.addEventListener('click', () => {
      state.bag.push(...entry.add);
      search.value = '';
      render();
    });
    li.append(row);
    return li;
  });
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'preview-empty';
    li.textContent = `No reachable item matches "${search.value.trim()}".`;
    rows.push(li);
  }
  list.replaceChildren(...rows);

  more.hidden = shown.length >= matches.length;
  more.textContent = `Show all ${matches.length}`;
}

$('preview-search').addEventListener('input', () => renderPreview(parseSeed(state.seedText)));
$('preview-more').addEventListener('click', () => {
  previewShowAll = true;
  renderPreview(parseSeed(state.seedText));
});

// ---------- bottom dock ----------
// On phones the picker sits below the bag, so a small dock keeps the bag and result in view.

const dock = $('dock');
const narrowScreen = window.matchMedia('(max-width: 719px)');
let bagCardVisible = true;

function renderDock(outcome) {
  const bag = $('dock-bag');
  bag.replaceChildren();
  for (let i = 0; i < 8; i++) {
    const id = state.bag[i];
    if (id) {
      bag.append(pickupIcon(id, 20));
    } else {
      const empty = document.createElement('span');
      empty.className = 'empty';
      bag.append(empty);
    }
  }

  const result = $('dock-result');
  const label = document.createElement('span');
  label.className = 'label';
  if (outcome.message) {
    label.classList.add('muted');
    label.textContent = outcome.short;
    result.replaceChildren(label);
  } else {
    const id = outcome.candidates[0];
    label.textContent = itemName(id);
    result.replaceChildren(itemIcon(id, 40), label);
  }
  updateDockVisibility();
}

function updateDockVisibility() {
  const show = narrowScreen.matches && !bagCardVisible && state.bag.length > 0;
  dock.hidden = !show;
  document.body.classList.toggle('has-dock', narrowScreen.matches);
}

new IntersectionObserver(([entry]) => {
  bagCardVisible = entry.isIntersecting;
  updateDockVisibility();
}).observe(document.querySelector('.bag-card'));
narrowScreen.addEventListener('change', updateDockVisibility);
dock.addEventListener('click', () => document.querySelector('.bag-card').scrollIntoView({ behavior: 'smooth', block: 'start' }));

// ---------- render ----------

function render() {
  const text = state.seedText.replace(' ', '');
  const seed = parseSeed(state.seedText);
  const status = $('seed-status');
  seedInput.classList.toggle('valid', seed !== null);
  seedInput.classList.toggle('invalid', seed === null && text.length === 8);
  status.className = 'seed-status' + (seed !== null ? ' valid' : text.length === 8 ? ' invalid' : '');
  status.textContent = seed !== null ? '✓' : text.length === 8 ? 'Invalid' : '';

  for (const button of document.querySelectorAll('[data-version]')) {
    button.setAttribute('aria-checked', String(button.dataset.version === state.version));
  }

  const activeModifiers = MODIFIERS.filter(([key]) => state.opts[key]).length;
  const count = $('modifier-count');
  count.hidden = activeModifiers === 0;
  count.textContent = `${activeModifiers} on`;

  renderBag();
  const outcome = computeOutcome(seed);
  renderResult(outcome);
  renderPreview(seed);
  renderDock(outcome);
  saveState();
}

renderPicker();
renderModifierList();
render();
