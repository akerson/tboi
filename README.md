# Tainted Cain Crafting Calculator

A mobile friendly, English Bag of Crafting calculator for **The Binding of Isaac: Repentance**.
Enter your run seed and the 8 pickups in Tainted Cain's bag, and it shows the exact item you'll craft.

It is built for console players, who can't use the PC mods (like External Item Descriptions) that show recipes in game.
It supports both game versions, because they give different results for the same seed:

| Version | Platforms | Data |
| --- | --- | --- |
| Repentance v1.7.9b | Nintendo Switch | frto027 data @ `af9fb78` |
| Repentance+ v1.9.7.15 | PC, Switch 2 | frto027 data @ `abd3370` |

Quick way to check which one your game is: craft 8 bombs. **Mr. Boom** means Repentance, **Mr. Mega** means Repentance+.

## Features

- Seed input with checksum validation (so typos are caught), and lenient typing (`jkd9z0c9` works).
- Tap pickups to fill the bag. Like the real bag, an extra pickup pushes out the oldest one.
- Shows the item, its in-game quote, quality, and a wiki link.
- With 6 or 7 pickups in, previews every item the remaining slots could make, in alphabetical order, with the
  easiest pickups to finish each one. Searchable, and tap one to fill the bag.
- If the item needs an unlock you don't have yet, shows what the bag gives instead.
- Run modifiers that change the result: Greed mode, daily runs, challenges, Womb and later, Sacred Orb,
  golden NO!, and co-op characters (Keeper, The Lost with Birthright, Tainted Lost).
- Remembers your seed, version and bag on your device.
- No build step, no tracking.

## How it works

`js/crafting.js` is a JavaScript port of the game's crafting algorithm. The algorithm and item data were
reverse engineered by [frto027](https://github.com/frto027) for the
[Huiji Isaac wiki](https://isaac.huijiwiki.com/wiki/C710)
([simulator source](https://github.com/frto027/IsaacBagOfCraftingHuijiGadget),
[C++/WASM source](https://github.com/frto027/IsaacDecraftingHuijiGadget)).
Like the game, it does its weight math in 32-bit floats, which matters for seeds near a boundary.

`scripts/test.mjs` runs random seeds, bags and modifiers through both this port and frto027's compiled
WASM build, for both game versions, and checks that they agree (600,000 of 600,000 cases at the time of writing).

## Running locally

The page uses ES modules, so it needs to be served over HTTP:

```sh
python -m http.server 8765
```

Then open http://localhost:8765.

## Rebuilding the data and running tests

Requires Node.js 18+ and git.

```sh
sh scripts/fetch-reference.sh   # downloads reference data into reference/
npm run data                    # regenerates js/data.js
npm test                        # compares against the reference WASM
```

## Credits and license

- Crafting algorithm and item data: [frto027](https://github.com/frto027), CC BY-NC-SA 3.0.
- English item names: game data via [bladecoding/isaac-bagofcrafting](https://github.com/bladecoding/isaac-bagofcrafting).
- Game sprites belong to Edmund McMillen and Nicalis. This is a fan project, not affiliated with them.

This project is a derivative of frto027's work and is shared under the same license,
[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/): free to share and adapt with credit,
not for commercial use, and adaptations must use the same license.
