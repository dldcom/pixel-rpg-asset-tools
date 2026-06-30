// Map asset importer for top-down pixel RPG maps.
//
// Input:
//   - a source map image
//   - a JSON config with spawns, collision rectangles, and overlay rectangles
//
// Output:
//   - assets/maps/<id>.jpg
//   - assets/maps/<id>.json
//   - assets/maps/<id>-preview.jpg
//
// Usage:
//   npx tsx scripts/import-map.ts act1_library assets/raw/maps/act1_library.png \
//     --config maps/act1_library.config.json

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

type ResizeFit = 'cover' | 'contain' | 'fill';
type TileRect = { col: number; row: number; w: number; h: number };
type SpawnDef = { name: string; x: number; y: number; width?: number; height?: number };
type MapImportConfig = {
  actNumber: number;
  spawns: SpawnDef[];
  walls?: TileRect[];
  overlays?: TileRect[];
};

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAPS_DIR = path.join(PROJECT_ROOT, 'assets', 'maps');

const TARGET_W = 1280;
const TARGET_H = 1280;
const JPG_QUALITY = 85;
const TILE_SIZE = 32;
const GRID_W = TARGET_W / TILE_SIZE;
const GRID_H = TARGET_H / TILE_SIZE;

const getOpt = (args: string[], name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const parseResizeFit = (value: string | undefined): ResizeFit => {
  const fit = value ?? 'cover';
  if (!['cover', 'contain', 'fill'].includes(fit)) {
    throw new Error(`Invalid --fit "${value}". Use cover, contain, or fill.`);
  }
  return fit as ResizeFit;
};

const parseBoundedInt = (
  value: string | undefined,
  defaultValue: number,
  label: string,
  min: number,
  max: number
): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${label}: "${value}". Use ${min}..${max}.`);
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

const assertNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  return value;
};

const assertOptionalNumber = (value: unknown, label: string): number | undefined => {
  if (value === undefined) return undefined;
  return assertNumber(value, label);
};

const readMapConfig = (configPath: string): MapImportConfig => {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<MapImportConfig>;

  const actNumberRaw = parsed.actNumber;
  if (!Number.isInteger(actNumberRaw)) {
    throw new Error('config.actNumber must be an integer.');
  }
  const actNumber = actNumberRaw as number;
  if (!Array.isArray(parsed.spawns)) {
    throw new Error('config.spawns must be an array.');
  }

  const spawns = parsed.spawns.map((spawn, index) => ({
    name: String((spawn as SpawnDef).name ?? `spawn_${index + 1}`),
    x: assertNumber((spawn as SpawnDef).x, `spawns[${index}].x`),
    y: assertNumber((spawn as SpawnDef).y, `spawns[${index}].y`),
    width: assertOptionalNumber((spawn as SpawnDef).width, `spawns[${index}].width`),
    height: assertOptionalNumber((spawn as SpawnDef).height, `spawns[${index}].height`),
  }));

  const readRects = (label: 'walls' | 'overlays'): TileRect[] | undefined => {
    const rects = parsed[label];
    if (rects === undefined) return undefined;
    if (!Array.isArray(rects)) throw new Error(`config.${label} must be an array.`);
    return rects.map((rect, index) => ({
      col: assertNumber((rect as TileRect).col, `${label}[${index}].col`),
      row: assertNumber((rect as TileRect).row, `${label}[${index}].row`),
      w: assertNumber((rect as TileRect).w, `${label}[${index}].w`),
      h: assertNumber((rect as TileRect).h, `${label}[${index}].h`),
    }));
  };

  return {
    actNumber,
    spawns,
    walls: readRects('walls'),
    overlays: readRects('overlays'),
  };
};

const validateRectList = (label: string, rects: TileRect[] | undefined): void => {
  if (!rects) return;
  rects.forEach((r, index) => {
    const badSize = r.w <= 0 || r.h <= 0;
    const outside = r.col < 0 || r.row < 0 || r.col + r.w > GRID_W || r.row + r.h > GRID_H;
    if (badSize || outside) {
      throw new Error(
        `${label}[${index}] is outside ${GRID_W}x${GRID_H} tiles: col=${r.col}, row=${r.row}, w=${r.w}, h=${r.h}`
      );
    }
  });
};

const validateSpawns = (spawns: SpawnDef[]): void => {
  spawns.forEach((s, index) => {
    const width = s.width ?? TILE_SIZE;
    const height = s.height ?? TILE_SIZE;
    if (s.x < 0 || s.y < 0 || s.x + width > TARGET_W || s.y + height > TARGET_H) {
      throw new Error(
        `spawn[${index}] "${s.name}" is outside ${TARGET_W}x${TARGET_H}: x=${s.x}, y=${s.y}, w=${width}, h=${height}`
      );
    }
  });
};

const tileRectsToGrid = (rects: TileRect[] | undefined): number[] => {
  const grid = new Array<number>(GRID_W * GRID_H).fill(0);
  if (!rects) return grid;
  for (const r of rects) {
    for (let row = r.row; row < r.row + r.h; row++) {
      for (let col = r.col; col < r.col + r.w; col++) {
        grid[row * GRID_W + col] = 1;
      }
    }
  }
  return grid;
};

const makeTiledJson = (
  id: string,
  actNumber: number,
  spawns: SpawnDef[],
  walls?: TileRect[],
  overlays?: TileRect[]
) => ({
  id,
  name: id,
  actNumber,
  imageExt: 'jpg',
  imagePath: `/assets/maps/${id}.jpg`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  content: {
    compressionlevel: -1,
    width: GRID_W,
    height: GRID_H,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tileheight: TILE_SIZE,
    tilewidth: TILE_SIZE,
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.1',
    nextlayerid: 4,
    nextobjectid: spawns.length + 1,
    tilesets: [
      {
        firstgid: 1,
        name: 'CollisionTile',
        tilewidth: TILE_SIZE,
        tileheight: TILE_SIZE,
        tilecount: 1,
        columns: 1,
        margin: 0,
        spacing: 0,
        image: 'Wall',
        imagewidth: TILE_SIZE,
        imageheight: TILE_SIZE,
      },
    ],
    layers: [
      {
        id: 1,
        name: 'collision',
        type: 'tilelayer',
        width: GRID_W,
        height: GRID_H,
        x: 0,
        y: 0,
        opacity: 0.5,
        visible: true,
        data: tileRectsToGrid(walls),
      },
      {
        id: 2,
        name: 'overlay',
        type: 'tilelayer',
        width: GRID_W,
        height: GRID_H,
        x: 0,
        y: 0,
        opacity: 0.5,
        visible: true,
        data: tileRectsToGrid(overlays),
      },
      {
        id: 3,
        name: 'spawn',
        type: 'objectgroup',
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        draworder: 'topdown',
        objects: spawns.map((s, i) => ({
          id: i + 1,
          name: s.name,
          point: false,
          rotation: 0,
          type: '',
          visible: true,
          x: s.x,
          y: s.y,
          width: s.width ?? TILE_SIZE,
          height: s.height ?? TILE_SIZE,
        })),
      },
    ],
  },
});

const writePreview = async (jpgPath: string, id: string): Promise<void> => {
  const previewPath = path.join(MAPS_DIR, `${id}-preview.jpg`);
  await sharp(jpgPath)
    .resize(512, 512, { fit: 'contain', background: '#1f2521' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(previewPath);
  console.log(`[import-map] preview: ${path.relative(PROJECT_ROOT, previewPath)}`);
};

async function main() {
  const args = process.argv.slice(2);
  const id = args[0];
  const sourcePath = args[1];
  const configPath = getOpt(args, '--config') ?? path.join('maps', `${id}.config.json`);
  const fit = parseResizeFit(getOpt(args, '--fit'));
  const quality = parseBoundedInt(getOpt(args, '--quality'), JPG_QUALITY, '--quality', 50, 100);
  const preview = parseBoolArg(getOpt(args, '--preview'), true);

  if (!id || !sourcePath) {
    console.error(
      'Usage: npx tsx scripts/import-map.ts <map-id> <source-image-path> ' +
        '[--config maps/<map-id>.config.json] [--fit cover|contain|fill] [--quality 85] [--preview true]'
    );
    process.exit(1);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source image not found: ${sourcePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(configPath)) {
    console.error(`Map config not found: ${configPath}`);
    process.exit(1);
  }

  const config = readMapConfig(configPath);
  validateSpawns(config.spawns);
  validateRectList('walls', config.walls);
  validateRectList('overlays', config.overlays);

  fs.mkdirSync(MAPS_DIR, { recursive: true });

  const jpgPath = path.join(MAPS_DIR, `${id}.jpg`);
  const sourceSize = fs.statSync(sourcePath).size;
  const sourceBuf = fs.readFileSync(sourcePath);
  await sharp(sourceBuf)
    .resize(TARGET_W, TARGET_H, {
      fit,
      position: 'centre',
      background: { r: 31, g: 37, b: 33, alpha: 1 },
    })
    .jpeg({ quality, progressive: true, mozjpeg: true })
    .toFile(jpgPath);

  const jpgSize = fs.statSync(jpgPath).size;
  console.log(
    `[import-map] image: ${(sourceSize / 1024).toFixed(0)}KB -> ${(jpgSize / 1024).toFixed(0)}KB JPG (${fit}, q=${quality})`
  );

  const json = makeTiledJson(id, config.actNumber, config.spawns, config.walls, config.overlays);
  const jsonPath = path.join(MAPS_DIR, `${id}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
  console.log(
    `[import-map] json: ${config.spawns.length} spawns, ${config.walls?.length ?? 0} wall rects, ${config.overlays?.length ?? 0} overlay rects`
  );

  if (preview) await writePreview(jpgPath, id);

  console.log(`[import-map] OK ${id}`);
  for (const s of config.spawns) {
    console.log(`  - ${s.name} @ (${s.x}, ${s.y})`);
  }
}

main().catch((e) => {
  console.error('[import-map] FAILED:', e);
  process.exit(1);
});
