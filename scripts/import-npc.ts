// NPC sprite sheet importer.
// Input: a grid-like generated sheet, for example 2 rows x 10 columns.
// Output: assets/npcs/<id>.png as one horizontal row of normalized frames.

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { logOptimizeRows, optimizeFilesInPlace } from './lib/asset-optimizer';

type RGB = { r: number; g: number; b: number };
type Component = { x: number; y: number; w: number; h: number; count: number };

const PROJECT_ROOT = path.resolve(__dirname, '..');

const getOpt = (args: string[], name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const parseIntOpt = (value: string | undefined, fallback: number, label: string, min = 1, max = 4096): number => {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${label}: "${value}". Use ${min}..${max}.`);
  }
  return parsed;
};

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  throw new Error(`Invalid boolean option "${value}".`);
};

const parseRgb = (value: string | undefined): RGB | undefined => {
  if (!value) return undefined;
  const parts = value.split(',').map((part) => Number.parseInt(part.trim(), 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    throw new Error(`Invalid --bg-color "${value}". Use "R,G,B".`);
  }
  return { r: parts[0], g: parts[1], b: parts[2] };
};

const dist = (a: RGB, b: RGB): number =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

const pixelAt = (buf: Buffer, w: number, x: number, y: number): RGB => {
  const i = (y * w + x) * 4;
  return { r: buf[i], g: buf[i + 1], b: buf[i + 2] };
};

const detectBg = (buf: Buffer, w: number, h: number): RGB => {
  const samples = [
    pixelAt(buf, w, 0, 0),
    pixelAt(buf, w, w - 1, 0),
    pixelAt(buf, w, 0, h - 1),
    pixelAt(buf, w, w - 1, h - 1),
  ];
  const avg = samples.reduce(
    (acc, px) => ({ r: acc.r + px.r, g: acc.g + px.g, b: acc.b + px.b }),
    { r: 0, g: 0, b: 0 }
  );
  return {
    r: Math.round(avg.r / samples.length),
    g: Math.round(avg.g / samples.length),
    b: Math.round(avg.b / samples.length),
  };
};

const cleanCell = (
  cell: Buffer,
  w: number,
  h: number,
  bg: RGB,
  threshold: number
): { buf: Buffer; bbox: { x: number; y: number; w: number; h: number } } => {
  const out = Buffer.from(cell);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const px = { r: out[i], g: out[i + 1], b: out[i + 2] };
      if (dist(px, bg) <= threshold) {
        out[i + 3] = 0;
        continue;
      }
      if (out[i + 3] <= 20) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('Could not find sprite pixels in one of the grid cells.');
  }

  return {
    buf: out,
    bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
};

const findComponents = (
  buf: Buffer,
  w: number,
  h: number,
  bg: RGB,
  threshold: number,
  minPixels: number
): Component[] => {
  const seen = new Uint8Array(w * h);
  const components: Component[] = [];

  const isBg = (i: number) => dist({ r: buf[i], g: buf[i + 1], b: buf[i + 2] }, bg) <= threshold;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const i = idx * 4;
      if (seen[idx] || isBg(i) || buf[i + 3] < 30) continue;

      const stack = [idx];
      seen[idx] = 1;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let count = 0;

      while (stack.length) {
        const current = stack.pop() as number;
        const cx = current % w;
        const cy = Math.floor(current / w);
        count += 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const n = ny * w + nx;
          const ni = n * 4;
          if (seen[n] || isBg(ni) || buf[ni + 3] < 30) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }

      if (count >= minPixels) {
        components.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, count });
      }
    }
  }

  return components;
};

const sortComponentsByRows = (components: Component[], rows: number): Component[] => {
  const sortedByY = [...components].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
  const rowBuckets = Array.from({ length: rows }, () => [] as Component[]);
  sortedByY.forEach((component, index) => {
    rowBuckets[Math.min(rows - 1, Math.floor(index / Math.ceil(components.length / rows)))].push(component);
  });
  return rowBuckets.flatMap((row) => row.sort((a, b) => a.x - b.x));
};

const normalizeCell = async (
  cell: Buffer,
  cellW: number,
  cellH: number,
  bg: RGB,
  threshold: number,
  frameW: number,
  frameH: number,
  targetHeight: number
): Promise<Buffer> => {
  const cleaned = cleanCell(cell, cellW, cellH, bg, threshold);
  const trimmed = await sharp(cleaned.buf, { raw: { width: cellW, height: cellH, channels: 4 } })
    .extract({
      left: cleaned.bbox.x,
      top: cleaned.bbox.y,
      width: cleaned.bbox.w,
      height: cleaned.bbox.h,
    })
    .resize({
      width: frameW - 4,
      height: targetHeight,
      fit: 'inside',
      kernel: sharp.kernel.nearest,
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  const left = Math.max(0, Math.floor((frameW - (meta.width ?? frameW)) / 2));
  const top = Math.max(0, frameH - (meta.height ?? frameH) - 2);

  return sharp({
    create: {
      width: frameW,
      height: frameH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left, top }])
    .png()
    .toBuffer();
};

const writePreview = async (
  sheetPath: string,
  previewPath: string,
  frameW: number,
  frameH: number,
  frameCount: number
): Promise<void> => {
  const scale = 3;
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < frameCount; i += 1) {
    const frame = await sharp(sheetPath)
      .extract({ left: i * frameW, top: 0, width: frameW, height: frameH })
      .resize(frameW * scale, frameH * scale, { kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    composites.push({ input: frame, left: i * frameW * scale, top: 0 });
  }

  await sharp({
    create: {
      width: frameW * scale * frameCount,
      height: frameH * scale,
      channels: 4,
      background: { r: 31, g: 37, b: 33, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(previewPath);
};

async function main() {
  const args = process.argv.slice(2);
  const id = args[0];
  const sourcePath = args[1];

  if (!id || !sourcePath) {
    console.error('Usage: npx tsx scripts/import-npc.ts <id> <source-image> [--cols 10] [--rows 2] [--frame-width 64] [--frame-height 96]');
    process.exit(1);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source not found: ${sourcePath}`);
    process.exit(1);
  }

  const mode = getOpt(args, '--mode') ?? 'components';
  if (mode !== 'components' && mode !== 'grid') {
    throw new Error(`Invalid --mode "${mode}". Use components or grid.`);
  }
  const cols = parseIntOpt(getOpt(args, '--cols'), 10, '--cols');
  const rows = parseIntOpt(getOpt(args, '--rows'), 2, '--rows');
  const frameW = parseIntOpt(getOpt(args, '--frame-width'), 64, '--frame-width');
  const frameH = parseIntOpt(getOpt(args, '--frame-height'), 96, '--frame-height');
  const targetHeight = parseIntOpt(getOpt(args, '--target-height'), Math.round(frameH * 0.86), '--target-height', 8, frameH - 2);
  const threshold = parseIntOpt(getOpt(args, '--threshold'), 55, '--threshold', 0, 255);
  const minPixels = parseIntOpt(getOpt(args, '--min-pixels'), 1000, '--min-pixels', 1, 1000000);
  const bgOverride = parseRgb(getOpt(args, '--bg-color'));
  const preview = parseBool(getOpt(args, '--preview'), true);
  const optimize = parseBool(getOpt(args, '--optimize'), true);

  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const full = Buffer.from(data);
  const bg = bgOverride ?? detectBg(full, info.width, info.height);
  const frameCount = cols * rows;

  const frames: Buffer[] = [];
  if (mode === 'components') {
    const components = sortComponentsByRows(findComponents(full, info.width, info.height, bg, threshold, minPixels), rows);
    if (components.length !== frameCount) {
      throw new Error(`Expected ${frameCount} components, found ${components.length}. Try --threshold or --min-pixels.`);
    }
    for (const component of components) {
      const pad = 10;
      const left = Math.max(0, component.x - pad);
      const top = Math.max(0, component.y - pad);
      const right = Math.min(info.width, component.x + component.w + pad);
      const bottom = Math.min(info.height, component.y + component.h + pad);
      const cellW = right - left;
      const cellH = bottom - top;
      const cell = await sharp(sourcePath)
        .ensureAlpha()
        .extract({ left, top, width: cellW, height: cellH })
        .raw()
        .toBuffer();
      frames.push(await normalizeCell(cell, cellW, cellH, bg, threshold, frameW, frameH, targetHeight));
    }
  } else {
    const cellW = Math.floor(info.width / cols);
    const cellH = Math.floor(info.height / rows);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const left = col === cols - 1 ? info.width - cellW : col * cellW;
        const top = row === rows - 1 ? info.height - cellH : row * cellH;
        const cell = await sharp(sourcePath)
          .ensureAlpha()
          .extract({ left, top, width: cellW, height: cellH })
          .raw()
          .toBuffer();
        frames.push(await normalizeCell(cell, cellW, cellH, bg, threshold, frameW, frameH, targetHeight));
      }
    }
  }

  const outDir = path.join(PROJECT_ROOT, 'assets', 'npcs');
  const framesDir = path.join(outDir, `${id}-frames`);
  fs.mkdirSync(framesDir, { recursive: true });

  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    composites.push({ input: frames[i], left: i * frameW, top: 0 });
    fs.writeFileSync(path.join(framesDir, `${String(i).padStart(2, '0')}.png`), frames[i]);
  }

  const sheetPath = path.join(outDir, `${id}.png`);
  await sharp({
    create: {
      width: frameW * frameCount,
      height: frameH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(sheetPath);

  const jsonPath = path.join(outDir, `${id}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({
    id,
    image: `${id}.png`,
    frameWidth: frameW,
    frameHeight: frameH,
    rows,
    cols,
    frameCount,
    importMode: mode,
    sourceGrid: { cols, rows, width: info.width, height: info.height },
    bgColor: bg,
    states: ['idle', 'talking'],
    note: 'Frames are exported in source row-major order. Pair frames as idle/talking per NPC.',
  }, null, 2));

  const generated = [sheetPath, jsonPath, ...frames.map((_, i) => path.join(framesDir, `${String(i).padStart(2, '0')}.png`))];
  let previewPath = '';
  if (preview) {
    previewPath = path.join(outDir, `${id}-preview.png`);
    await writePreview(sheetPath, previewPath, frameW, frameH, frameCount);
    generated.push(previewPath);
  }
  if (optimize) {
    const rowsOut = await optimizeFilesInPlace(generated.filter((file) => file.endsWith('.png')), undefined, PROJECT_ROOT);
    logOptimizeRows('import-npc', rowsOut);
  }

  console.log(`[import-npc] source: ${info.width}x${info.height}, mode ${mode}, grid ${cols}x${rows}`);
  console.log(`[import-npc] bg: rgb(${bg.r}, ${bg.g}, ${bg.b}), threshold=${threshold}`);
  console.log(`[import-npc] sheet: ${path.relative(PROJECT_ROOT, sheetPath)} (${frameW * frameCount}x${frameH})`);
  if (previewPath) console.log(`[import-npc] preview: ${path.relative(PROJECT_ROOT, previewPath)}`);
}

main().catch((error) => {
  console.error('[import-npc] FAILED:', error);
  process.exit(1);
});
