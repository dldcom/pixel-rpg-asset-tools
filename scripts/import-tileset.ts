// Tileset importer for top-down pixel RPG tiles.
//
// Input:
//   - a single tileset sheet image
//   - optional manifest JSON describing tile names, types, and collision
//
// Output:
//   - tilesets/<id>/tileset.png
//   - tilesets/<id>/tileset.json
//   - tilesets/<id>/tiles/*.png
//   - tilesets/<id>/preview.png
//
// Usage:
//   npx tsx scripts/import-tileset.ts cozy-town tilesets/cozy-town/source/cozy-town-sheet.png \
//     --tile-size 32 --cols 8 --rows 8 --manifest tilesets/cozy-town/manifest.json

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { logOptimizeRows, optimizeFilesInPlace } from './lib/asset-optimizer';

type TileKind = 'ground' | 'path' | 'water' | 'edge' | 'object' | 'decoration' | 'utility';
type CollisionShape = 'none' | 'full' | 'bottom' | 'custom';
type TileManifestEntry = {
  id: string;
  col: number;
  row: number;
  type?: TileKind;
  collides?: boolean;
  collision?: CollisionShape;
  tags?: string[];
  note?: string;
};
type TilesetManifest = {
  tileSize?: number;
  cols?: number;
  rows?: number;
  tiles?: TileManifestEntry[];
};

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TILESETS_DIR = path.join(PROJECT_ROOT, 'tilesets');

const getOpt = (args: string[], name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const parsePositiveInt = (value: string | undefined, defaultValue: number, label: string): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: "${value}". Use a positive integer.`);
  }
  return parsed;
};

const parseBoolArg = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  throw new Error(`Invalid boolean option "${value}". Use true or false.`);
};

const readManifest = (manifestPath: string | undefined): TilesetManifest => {
  if (!manifestPath) return {};
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as TilesetManifest;
  if (parsed.tiles !== undefined && !Array.isArray(parsed.tiles)) {
    throw new Error('manifest.tiles must be an array.');
  }
  return parsed;
};

const assertTileEntry = (tile: TileManifestEntry, index: number, cols: number, rows: number): TileManifestEntry => {
  if (!tile.id || typeof tile.id !== 'string') {
    throw new Error(`tiles[${index}].id must be a string.`);
  }
  if (!Number.isInteger(tile.col) || tile.col < 0 || tile.col >= cols) {
    throw new Error(`tiles[${index}].col must be 0..${cols - 1}.`);
  }
  if (!Number.isInteger(tile.row) || tile.row < 0 || tile.row >= rows) {
    throw new Error(`tiles[${index}].row must be 0..${rows - 1}.`);
  }
  if (tile.tags !== undefined && !Array.isArray(tile.tags)) {
    throw new Error(`tiles[${index}].tags must be an array.`);
  }
  return {
    ...tile,
    type: tile.type ?? 'ground',
    collision: tile.collision ?? (tile.collides ? 'full' : 'none'),
    collides: tile.collides ?? (
      tile.collision === 'full' || tile.collision === 'bottom' || tile.collision === 'custom'
    ),
    tags: tile.tags ?? [],
  };
};

const buildDefaultTiles = (cols: number, rows: number): TileManifestEntry[] => {
  const tiles: TileManifestEntry[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({
        id: `tile_${row}_${col}`,
        col,
        row,
        type: 'ground',
        collides: false,
        collision: 'none',
        tags: [],
      });
    }
  }
  return tiles;
};

const cleanPngDir = (dir: string): void => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.toLowerCase().endsWith('.png')) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
};

const copyNormalizedSheet = async (
  sourcePath: string,
  outPath: string,
  cols: number,
  rows: number,
  tileSize: number
): Promise<void> => {
  const targetW = cols * tileSize;
  const targetH = rows * tileSize;
  const meta = await sharp(sourcePath).metadata();
  if (meta.width !== targetW || meta.height !== targetH) {
    console.warn(
      `[import-tileset] WARN: source is ${meta.width}x${meta.height}, expected ${targetW}x${targetH}. Resizing with nearest.`
    );
  }
  await sharp(sourcePath)
    .ensureAlpha()
    .resize(targetW, targetH, {
      fit: 'fill',
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toFile(outPath);
};

const splitTiles = async (
  sheetPath: string,
  tilesDir: string,
  tiles: TileManifestEntry[],
  tileSize: number
): Promise<void> => {
  fs.mkdirSync(tilesDir, { recursive: true });
  cleanPngDir(tilesDir);
  for (const tile of tiles) {
    await sharp(sheetPath)
      .extract({
        left: tile.col * tileSize,
        top: tile.row * tileSize,
        width: tileSize,
        height: tileSize,
      })
      .png()
      .toFile(path.join(tilesDir, `${tile.id}.png`));
  }
};

const writePreview = async (
  sheetPath: string,
  outPath: string,
  cols: number,
  rows: number,
  tileSize: number
): Promise<void> => {
  const scale = Math.max(2, Math.floor(256 / tileSize));
  const tileW = tileSize * scale;
  const tileH = tileSize * scale;
  const composites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = await sharp(sheetPath)
        .extract({ left: col * tileSize, top: row * tileSize, width: tileSize, height: tileSize })
        .resize(tileW, tileH, { kernel: sharp.kernel.nearest })
        .png()
        .toBuffer();
      composites.push({ input: tile, left: col * tileW, top: row * tileH });
    }
  }
  await sharp({
    create: {
      width: cols * tileW,
      height: rows * tileH,
      channels: 4,
      background: { r: 31, g: 37, b: 33, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
};

async function main() {
  const args = process.argv.slice(2);
  const id = args[0];
  const sourcePath = args[1];
  const manifestPath = getOpt(args, '--manifest');
  const preview = parseBoolArg(getOpt(args, '--preview'), true);
  const optimize = parseBoolArg(getOpt(args, '--optimize'), true);

  if (!id || !sourcePath) {
    console.error(
      'Usage: npx tsx scripts/import-tileset.ts <id> <source-sheet> ' +
        '[--tile-size 32] [--cols 8] [--rows 8] [--manifest tilesets/<id>/manifest.json] [--preview true]'
    );
    process.exit(1);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source sheet not found: ${sourcePath}`);
    process.exit(1);
  }

  const manifest = readManifest(manifestPath);
  const tileSize = parsePositiveInt(getOpt(args, '--tile-size'), manifest.tileSize ?? 32, '--tile-size');
  const cols = parsePositiveInt(getOpt(args, '--cols'), manifest.cols ?? 8, '--cols');
  const rows = parsePositiveInt(getOpt(args, '--rows'), manifest.rows ?? 8, '--rows');
  const rawTiles = manifest.tiles?.length ? manifest.tiles : buildDefaultTiles(cols, rows);
  const tiles = rawTiles.map((tile, index) => assertTileEntry(tile, index, cols, rows));

  const ids = new Set<string>();
  for (const tile of tiles) {
    if (ids.has(tile.id)) throw new Error(`Duplicate tile id: ${tile.id}`);
    ids.add(tile.id);
  }

  const outDir = path.join(TILESETS_DIR, id);
  const tilesDir = path.join(outDir, 'tiles');
  const sheetPath = path.join(outDir, 'tileset.png');
  const jsonPath = path.join(outDir, 'tileset.json');
  const previewPath = path.join(outDir, 'preview.png');
  fs.mkdirSync(outDir, { recursive: true });

  await copyNormalizedSheet(sourcePath, sheetPath, cols, rows, tileSize);
  await splitTiles(sheetPath, tilesDir, tiles, tileSize);
  if (preview) await writePreview(sheetPath, previewPath, cols, rows, tileSize);

  const json = {
    id,
    tileSize,
    cols,
    rows,
    image: 'tileset.png',
    imagePath: `/tilesets/${id}/tileset.png`,
    preview: preview ? 'preview.png' : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tiles: tiles.map((tile, index) => ({
      index,
      id: tile.id,
      col: tile.col,
      row: tile.row,
      x: tile.col * tileSize,
      y: tile.row * tileSize,
      w: tileSize,
      h: tileSize,
      type: tile.type,
      collides: tile.collides,
      collision: tile.collision,
      tags: tile.tags,
      note: tile.note,
      file: `tiles/${tile.id}.png`,
    })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));

  console.log(`[import-tileset] sheet: ${path.relative(PROJECT_ROOT, sheetPath)}`);
  console.log(`[import-tileset] tiles: ${tiles.length} files -> ${path.relative(PROJECT_ROOT, tilesDir)}`);
  console.log(`[import-tileset] json: ${path.relative(PROJECT_ROOT, jsonPath)}`);
  if (preview) console.log(`[import-tileset] preview: ${path.relative(PROJECT_ROOT, previewPath)}`);
  if (optimize) {
    const tileFiles = tiles.map((tile) => path.join(tilesDir, `${tile.id}.png`));
    const rows = await optimizeFilesInPlace(
      [sheetPath, preview ? previewPath : "", ...tileFiles],
      undefined,
      PROJECT_ROOT
    );
    logOptimizeRows('import-tileset', rows);
  }
}

main().catch((e) => {
  console.error('[import-tileset] FAILED:', e);
  process.exit(1);
});
