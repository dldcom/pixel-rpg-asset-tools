# Cozy Town Tileset

This folder is a starter layout for an 8x8, 32px top-down town RPG tileset.

Recommended source sheet:

```text
tilesets/cozy-town/source/cozy-town-sheet.png
```

Import command:

```bash
npm run import:tileset -- cozy-town tilesets/cozy-town/source/cozy-town-sheet.png --manifest tilesets/cozy-town/manifest.example.json
```

Prompt shape for generating the source sheet:

```text
Create a single 8x8 pixel art tileset sheet for a cozy top-down town RPG.
Each tile is exactly 32x32 pixels.
Use a consistent warm pixel art style.
Transparent background for object tiles where appropriate.
No text, no labels, no perspective camera, no isometric view.

Rows:
0 grass variants
1 dirt path center, edges, corners
2 stone plaza tiles
3 water pond center, edges, corners
4 fences and low walls
5 trees, bushes, flowers, rocks
6 town props: bench, signpost, lamp, mailbox, crate, barrel, stall, notice board
7 utility: shadows, entrance mat, stairs, bridge pieces, empty tile
```

The manifest names each tile and records basic collision metadata. The importer will split the sheet into `tiles/*.png`, copy a normalized `tileset.png`, and write `tileset.json`.
