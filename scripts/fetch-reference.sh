#!/bin/sh
# Downloads the reference data used by scripts/extract-data.mjs and scripts/test.mjs into reference/.
set -e
cd "$(dirname "$0")/.."

REPO=https://github.com/frto027/IsaacDecraftingHuijiGadget
REP_COMMIT=af9fb78      # Repentance v1.7.9b (Feb 2023)
REPPLUS_COMMIT=abd3370  # Repentance+ v1.9.7.15 (Oct 2025)

tmp=$(mktemp -d)
git clone -q "$REPO" "$tmp/decrafting"

mkdir -p reference/rep reference/repplus
for f in item_data.h main.cpp data.txt; do
  git -C "$tmp/decrafting" show "$REP_COMMIT:bofwasm/$f" > "reference/rep/$f"
  git -C "$tmp/decrafting" show "$REPPLUS_COMMIT:bofwasm/$f" > "reference/repplus/$f"
done
git -C "$tmp/decrafting" show "$REP_COMMIT:public/index.html" | grep "#collectibles_" > reference/sprite_css.txt
cp "$tmp/decrafting/public/Collectibles_sprite.png" assets/collectibles.png
cp "$tmp/decrafting/public/ui_crafting.png" assets/pickups.png

curl -sSfL -o reference/items.xml https://raw.githubusercontent.com/bladecoding/isaac-bagofcrafting/master/assets/items.xml

rm -rf "$tmp"
echo "reference data ready"
