import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

export type OptimizeOptions = {
  pngQuality: number;
  jpgQuality: number;
  webpQuality: number;
  createWebp: boolean;
  webpThresholdBytes: number;
};

export type OptimizeRow = {
  file: string;
  output: string;
  format: string;
  beforeBytes: number;
  afterBytes: number;
  savedBytes: number;
  savedPercent: number;
  webpOutput?: string;
  webpBytes?: number;
};

export type OptimizeReport = {
  source: string;
  output: string;
  options: OptimizeOptions;
  files: number;
  beforeBytes: number;
  afterBytes: number;
  savedBytes: number;
  savedPercent: number;
  rows: OptimizeRow[];
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export const defaultOptimizeOptions: OptimizeOptions = {
  pngQuality: 88,
  jpgQuality: 84,
  webpQuality: 84,
  createWebp: true,
  webpThresholdBytes: 300_000,
};

export const walkImages = (dir: string): string[] => {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkImages(fullPath));
      continue;
    }
    if (entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      result.push(fullPath);
    }
  }
  return result;
};

const ensureParent = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const copyFallback = (sourcePath: string, outputPath: string): void => {
  ensureParent(outputPath);
  fs.copyFileSync(sourcePath, outputPath);
};

export async function optimizeImage(
  sourcePath: string,
  outputPath: string,
  options: OptimizeOptions = defaultOptimizeOptions,
  displayRoot = process.cwd()
): Promise<OptimizeRow> {
  const ext = path.extname(sourcePath).toLowerCase();
  const beforeBytes = fs.statSync(sourcePath).size;
  ensureParent(outputPath);

  if (ext === '.png') {
    await sharp(sourcePath)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        quality: options.pngQuality,
        effort: 10,
      })
      .toFile(outputPath);
  } else if (ext === '.jpg' || ext === '.jpeg') {
    await sharp(sourcePath)
      .jpeg({
        quality: options.jpgQuality,
        progressive: true,
        mozjpeg: true,
      })
      .toFile(outputPath);
  } else if (ext === '.webp') {
    await sharp(sourcePath)
      .webp({
        quality: options.webpQuality,
        effort: 6,
      })
      .toFile(outputPath);
  } else {
    copyFallback(sourcePath, outputPath);
  }

  let afterBytes = fs.statSync(outputPath).size;
  if (afterBytes >= beforeBytes) {
    copyFallback(sourcePath, outputPath);
    afterBytes = beforeBytes;
  }

  const row: OptimizeRow = {
    file: path.relative(displayRoot, sourcePath),
    output: path.relative(displayRoot, outputPath),
    format: ext.replace('.', ''),
    beforeBytes,
    afterBytes,
    savedBytes: beforeBytes - afterBytes,
    savedPercent: beforeBytes === 0 ? 0 : Number((((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(2)),
  };

  if (options.createWebp && ext === '.png' && beforeBytes >= options.webpThresholdBytes) {
    const webpPath = outputPath.replace(/\.png$/i, '.webp');
    await sharp(sourcePath)
      .webp({
        quality: options.webpQuality,
        effort: 6,
        nearLossless: false,
      })
      .toFile(webpPath);
    row.webpOutput = path.relative(displayRoot, webpPath);
    row.webpBytes = fs.statSync(webpPath).size;
  }

  return row;
}

export async function optimizeDirectory(
  sourceRoot: string,
  outputRoot: string,
  options: OptimizeOptions = defaultOptimizeOptions,
  displayRoot = process.cwd()
): Promise<OptimizeReport> {
  const images = walkImages(sourceRoot);
  const rows: OptimizeRow[] = [];

  for (const imagePath of images) {
    const relative = path.relative(sourceRoot, imagePath);
    const outputPath = path.join(outputRoot, relative);
    rows.push(await optimizeImage(imagePath, outputPath, options, displayRoot));
  }

  const beforeTotal = rows.reduce((sum, row) => sum + row.beforeBytes, 0);
  const afterTotal = rows.reduce((sum, row) => sum + row.afterBytes, 0);
  return {
    source: path.relative(displayRoot, sourceRoot),
    output: path.relative(displayRoot, outputRoot),
    options,
    files: rows.length,
    beforeBytes: beforeTotal,
    afterBytes: afterTotal,
    savedBytes: beforeTotal - afterTotal,
    savedPercent: beforeTotal === 0 ? 0 : Number((((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(2)),
    rows: rows.sort((a, b) => b.savedBytes - a.savedBytes),
  };
}

export async function optimizeFilesInPlace(
  filePaths: string[],
  options: OptimizeOptions = defaultOptimizeOptions,
  displayRoot = process.cwd()
): Promise<OptimizeRow[]> {
  const rows: OptimizeRow[] = [];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath) || !IMAGE_EXTS.has(path.extname(filePath).toLowerCase())) continue;
    const tmpPath = `${filePath}.optimizing-${Date.now()}.tmp${path.extname(filePath)}`;
    const row = await optimizeImage(filePath, tmpPath, options, displayRoot);
    fs.copyFileSync(tmpPath, filePath);
    fs.unlinkSync(tmpPath);
    rows.push({ ...row, output: path.relative(displayRoot, filePath) });
  }
  return rows;
}

export const logOptimizeRows = (label: string, rows: OptimizeRow[]): void => {
  const before = rows.reduce((sum, row) => sum + row.beforeBytes, 0);
  const after = rows.reduce((sum, row) => sum + row.afterBytes, 0);
  const saved = before === 0 ? 0 : Number((((before - after) / before) * 100).toFixed(2));
  console.log(`[${label}] optimized ${rows.length} files, saved ${saved}%`);
  rows.slice(0, 8).forEach((row) => {
    console.log(`  - ${row.output}: ${row.savedPercent}%`);
  });
};
