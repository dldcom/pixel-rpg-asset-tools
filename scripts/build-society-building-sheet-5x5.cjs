const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const source = 'C:/Users/dldco/.codex/generated_images/019f1827-e997-7151-9da9-c19222e419f5/ig_0858219ed3c68152016a43c73f55988191946d6c9b0d63a3ae.png';
const toolRoot = 'C:/Users/dldco/Downloads/codex/pixel-rpg-asset-tools';
const gameRoot = 'C:/Users/dldco/Downloads/codex/society-4-1-2-2-';
const sourceBuildingDir = path.join(toolRoot, 'source-assets/society-4-1-2-2/src-assets/buildings');
const sourceSplitDir = path.join(sourceBuildingDir, 'split');
const gameBuildingDir = path.join(gameRoot, 'src/assets/buildings');
const gameSplitDir = path.join(gameBuildingDir, 'split');

const cols = 5;
const rows = 5;
const outW = 256;
const outH = 220;
const gutter = 14;

const buildings = [
  'bakery', 'cafeteria', 'stationery-shop', 'convenience-store', 'theater',
  'hair-salon', 'parcel-center', 'packing-room', 'bus-stop', 'school',
  'flower-shop', 'library', 'small-market', 'bus-depot', 'hospital-clinic',
  'academy', 'toy-shop', 'beauty-salon', 'bank', 'post-office',
  'community-center', 'apartment-entrance', 'craft-workshop', 'music-store', 'snack-kiosk'
];

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function isGreenKey(r, g, b) {
  // Chroma-key and antialias fringe. This is applied only to green connected to cell borders.
  return g > 105 && g > r * 1.22 && g > b * 1.22 && (g - Math.max(r, b)) > 34;
}

function floodRemoveBorderGreen(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (data[p + 3] === 0 || !isGreenKey(data[p], data[p + 1], data[p + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const x = idx % width;
    const y = Math.floor(idx / width);
    const p = idx * 4;
    data[p + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

function removeLooseGreenFringe(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const distToEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (distToEdge < 18 && isGreenKey(data[i], data[i + 1], data[i + 2])) {
        data[i + 3] = 0;
      }
      // Despill remaining edge pixels without deleting possible green details in the object.
      if (data[i + 1] > data[i] * 1.15 && data[i + 1] > data[i + 2] * 1.15) {
        data[i + 1] = Math.max(data[i], data[i + 2], Math.round(data[i + 1] * 0.72));
      }
    }
  }
}

function removeSmallComponents(data, width, height) {
  const visited = new Uint8Array(width * height);
  const comps = [];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (visited[start] || data[start * 4 + 3] < 24) continue;
      const q = [start];
      visited[start] = 1;
      let area = 0;
      let minX = x, maxX = x, minY = y, maxY = y;
      for (let head = 0; head < q.length; head++) {
        const idx = q[head];
        const cx = idx % width;
        const cy = Math.floor(idx / width);
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = ny * width + nx;
          if (visited[ni] || data[ni * 4 + 3] < 24) continue;
          visited[ni] = 1;
          q.push(ni);
        }
      }
      comps.push({ area, minX, maxX, minY, maxY, pixels: q });
    }
  }

  if (!comps.length) return;
  const maxArea = Math.max(...comps.map((c) => c.area));
  const centerX = width / 2;
  for (const comp of comps) {
    const compCenterX = (comp.minX + comp.maxX) / 2;
    const keepByArea = comp.area >= maxArea * 0.07;
    const keepByCenter = Math.abs(compCenterX - centerX) < width * 0.38 && comp.area >= maxArea * 0.025;
    if (keepByArea || keepByCenter) continue;
    for (const idx of comp.pixels) data[idx * 4 + 3] = 0;
  }
}

async function cleanCell(inputBuffer) {
  const { data, info } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodRemoveBorderGreen(data, info.width, info.height);
  removeLooseGreenFringe(data, info.width, info.height);
  removeSmallComponents(data, info.width, info.height);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function trimAndFit(inputBuffer) {
  const cleaned = await cleanCell(inputBuffer);
  const padded = await sharp(cleaned)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .extend({ top: 10, bottom: 10, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  const resized = await sharp(padded)
    .resize(outW, outH, {
      fit: 'contain',
      kernel: sharp.kernel.nearest,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  const { data, info } = await sharp(resized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const residualGreen = g > 100 && g > r * 1.08 && g > b * 1.08 && (g - Math.max(r, b)) > 14;
    if (residualGreen) {
      data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

function cellRect(meta, col, row) {
  const x0 = Math.round((col * meta.width) / cols);
  const x1 = Math.round(((col + 1) * meta.width) / cols);
  const y0 = Math.round((row * meta.height) / rows);
  const y1 = Math.round(((row + 1) * meta.height) / rows);
  const left = Math.min(x1 - 1, x0 + gutter);
  const top = Math.min(y1 - 1, y0 + gutter);
  const right = Math.max(left + 1, x1 - gutter);
  const bottom = Math.max(top + 1, y1 - gutter);
  return { left, top, width: right - left, height: bottom - top };
}

async function main() {
  await ensureDir(sourceBuildingDir);
  await ensureDir(sourceSplitDir);
  await ensureDir(gameBuildingDir);
  await ensureDir(gameSplitDir);

  const sourceSheetPath = path.join(sourceBuildingDir, 'building-spritesheet-5x5-source.png');
  fs.copyFileSync(source, sourceSheetPath);

  const meta = await sharp(source).metadata();
  const splitBuffers = [];
  const stats = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const name = buildings[index];
      const rect = cellRect(meta, col, row);
      const rawCell = await sharp(source).extract(rect).png().toBuffer();
      const cell = await trimAndFit(rawCell);
      const outMeta = await sharp(cell).metadata();
      splitBuffers.push(cell);
      fs.writeFileSync(path.join(sourceSplitDir, `${name}.png`), cell);
      fs.writeFileSync(path.join(gameSplitDir, `${name}.png`), cell);
      stats.push({ name, ...rect, outWidth: outMeta.width, outHeight: outMeta.height });
    }
  }

  const sheetBuffer = await sharp({
    create: {
      width: outW * cols,
      height: outH * rows,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite(splitBuffers.map((input, index) => ({
    input,
    left: (index % cols) * outW,
    top: Math.floor(index / cols) * outH
  }))).png({ compressionLevel: 9, palette: false }).toBuffer();

  fs.writeFileSync(path.join(sourceBuildingDir, 'building-spritesheet-5x5.png'), sheetBuffer);
  fs.writeFileSync(path.join(sourceBuildingDir, 'building-spritesheet.png'), sheetBuffer);
  fs.writeFileSync(path.join(gameBuildingDir, 'building-spritesheet-5x5.png'), sheetBuffer);
  fs.writeFileSync(path.join(gameBuildingDir, 'building-spritesheet.png'), sheetBuffer);

  const manifest = {
    id: 'society-building-spritesheet-5x5',
    cellWidth: outW,
    cellHeight: outH,
    cols,
    rows,
    image: 'building-spritesheet-5x5.png',
    generatedFrom: path.basename(sourceSheetPath),
    cropGutter: gutter,
    buildings: buildings.map((id, index) => ({ id, col: index % cols, row: Math.floor(index / cols) }))
  };
  fs.writeFileSync(path.join(sourceBuildingDir, 'building-spritesheet-5x5.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(gameBuildingDir, 'building-spritesheet-5x5.json'), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({ sourceWidth: meta.width, sourceHeight: meta.height, gutter, buildings: buildings.length, first: stats[0], last: stats.at(-1) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



