import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const input = args[0];
const output = args[1];

const getOpt = (name, fallback) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : fallback;
};

const parseIntOpt = (name, fallback) => {
  const value = getOpt(name, String(fallback));
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
};

if (!input || !output) {
  console.error(
    'Usage: node scripts/normalize-tile-grid-source.mjs <input.png> <output.png> ' +
      '[--cols 8] [--rows 8] [--tile-size 32] [--margin 5]'
  );
  process.exit(1);
}

const cols = parseIntOpt('--cols', 8);
const rows = parseIntOpt('--rows', 8);
const tileSize = parseIntOpt('--tile-size', 32);
const margin = parseIntOpt('--margin', 5);

const meta = await sharp(input).metadata();
if (!meta.width || !meta.height) {
  throw new Error(`Could not read image size: ${input}`);
}

const composites = [];
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const leftBoundary = Math.round((col * meta.width) / cols);
    const rightBoundary = Math.round(((col + 1) * meta.width) / cols);
    const topBoundary = Math.round((row * meta.height) / rows);
    const bottomBoundary = Math.round(((row + 1) * meta.height) / rows);
    const left = leftBoundary + margin;
    const top = topBoundary + margin;
    const width = Math.max(1, rightBoundary - leftBoundary - margin * 2);
    const height = Math.max(1, bottomBoundary - topBoundary - margin * 2);

    let inputBuffer;
    if (row === rows - 1 && col === cols - 1) {
      inputBuffer = await sharp({
        create: {
          width: tileSize,
          height: tileSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).png().toBuffer();
    } else {
      inputBuffer = await sharp(input)
        .extract({ left, top, width, height })
        .resize(tileSize, tileSize, {
          fit: 'fill',
          kernel: sharp.kernel.nearest,
        })
        .ensureAlpha()
        .png()
        .toBuffer();
    }

    composites.push({
      input: inputBuffer,
      left: col * tileSize,
      top: row * tileSize,
    });
  }
}

fs.mkdirSync(path.dirname(output), { recursive: true });
await sharp({
  create: {
    width: cols * tileSize,
    height: rows * tileSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);

console.log(`[normalize-tile-grid-source] ${output}`);
