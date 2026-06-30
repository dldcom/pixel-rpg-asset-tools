# Pixel RPG Asset Tools

AI-generated images often need cleanup before they feel good inside a top-down pixel RPG. This repo collects small import scripts that turn raw character, item, and map images into game-ready assets.

The default output layout matches a simple web RPG project:

```text
assets/
  characters/
  items/
  maps/
  npcs/
```

## Install

```bash
npm install
```

## Character Import

Use this when you have a character image, a 3-view character sheet, a full atlas, or a 4-direction grid sprite sheet.

```bash
npm run import:character -- cat assets/raw/characters/cat.png --mode auto --name "Cat"
```

Outputs:

```text
assets/characters/cat.png
assets/characters/cat.json
assets/characters/cat-preview.png
assets/characters/cat-frames/
```

Useful options:

```bash
--mode auto|atlas|single|split3|grid
--type characters|npcs
--bg-color "255,255,255"
--threshold 30
--cols 4
--rows 4
--row-order down,left,right,up
--target-height 50
--preview true
--frames true
--optimize true
```

## Item Import

Use this for small object icons such as signs, tools, keys, or quest items.

```bash
npm run import:item -- extinguisher assets/raw/items/extinguisher.png --name "Extinguisher"
```

Outputs:

```text
assets/items/extinguisher.png
assets/items/extinguisher.json
assets/items/extinguisher-preview.png
```

Useful options:

```bash
--size 32
--bg-color "255,255,255"
--threshold 30
--fit contain|cover
--kernel nearest|lanczos3
--preview true
--optimize true
```

## Map Import

Map import is intentionally independent from any game code. Instead of importing a project's `shared/maps` registry, it reads a JSON config file.

```bash
npm run import:map -- act1_library assets/raw/maps/act1_library.png --config maps/act1_library.config.json
```

If `--config` is omitted, the script looks for:

```text
maps/<map-id>.config.json
```

Outputs:

```text
assets/maps/act1_library.jpg
assets/maps/act1_library.json
assets/maps/act1_library-preview.jpg
```

Map config format:

```json
{
  "actNumber": 1,
  "spawns": [
    {
      "name": "player",
      "x": 160,
      "y": 320,
      "width": 32,
      "height": 32
    }
  ],
  "walls": [
    {
      "col": 0,
      "row": 0,
      "w": 40,
      "h": 1
    }
  ],
  "overlays": []
}
```

Coordinate rules:

- Map image output is `1280x1280`.
- Tile size is `32x32`.
- Collision and overlay rectangles use tile coordinates on a `40x40` grid.
- Spawn positions use pixel coordinates.

Useful options:

```bash
--fit cover|contain|fill
--quality 85
--preview true
--optimize true
```

## Tileset Import

Use this when you generate one large tileset sheet and want to split it into named game-ready tiles.

```bash
npm run import:tileset -- cozy-town tilesets/cozy-town/source/cozy-town-sheet.png --manifest tilesets/cozy-town/manifest.example.json
```

Outputs:

```text
tilesets/cozy-town/tileset.png
tilesets/cozy-town/tileset.json
tilesets/cozy-town/preview.png
tilesets/cozy-town/tiles/*.png
```

Useful options:

```bash
--tile-size 32
--cols 8
--rows 8
--manifest tilesets/cozy-town/manifest.example.json
--preview true
--optimize true
```

The manifest assigns stable tile ids and metadata:

```json
{
  "tileSize": 32,
  "cols": 8,
  "rows": 8,
  "tiles": [
    { "id": "grass_0", "col": 0, "row": 0, "type": "ground" },
    { "id": "dirt_center", "col": 0, "row": 1, "type": "path" },
    { "id": "fence_horizontal", "col": 0, "row": 4, "type": "object", "collides": true }
  ]
}
```

If no manifest is provided, the importer splits every grid cell as `tile_<row>_<col>`.

## Source Assets And Optimization

Use `source-assets/` as the asset workshop. Put original images, generated source sheets, prompts, and project-specific source material there.

```text
source-assets/
  society-4-1-2-2/
    src-assets/
      buildings/
      characters/
      maps/
      tilesets/
```

Generate optimized runtime copies into `output/` without overwriting the source files:

```bash
npm run optimize:assets -- source-assets/society-4-1-2-2/src-assets --out output/society-4-1-2-2/assets
```

Useful options:

```bash
--png-quality 88
--jpg-quality 84
--webp-quality 84
--webp true
--webp-threshold 300000
```

The import scripts run lightweight in-place optimization by default after generating images. Pass `--optimize false` to skip it.

The standalone optimizer writes an `optimization-report.json` with before/after sizes. For PNG files, it keeps the PNG if the optimized copy is smaller and also creates WebP candidates for large PNGs.

## Recommended Workflow

1. Put raw images in `assets/raw/characters`, `assets/raw/items`, or `assets/raw/maps`.
2. Create or copy a map config into `maps/` when importing maps.
3. Run the matching import command.
4. Check the generated `*-preview` file.
5. Copy the generated assets into your game project.

## Notes

- `cover` keeps map proportions and fills the square output, cropping if needed.
- `contain` keeps the full source image and pads the empty area.
- `fill` forces the source into `1280x1280` and may distort the image.
- Pixel art usually looks best with `--kernel nearest`.
