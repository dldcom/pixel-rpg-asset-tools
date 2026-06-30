// Optimize image assets without overwriting source files.
//
// Usage:
//   npx tsx scripts/optimize-assets.ts source-assets/society-4-1-2-2/src-assets \
//     --out output/society-4-1-2-2/assets

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

type OptimizeRow = {
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

const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const getOpt = (args: string[], name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const parseBoolArg = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  throw new Error(`Invalid boolean option "${value}". Use true or false.`);
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

const walkImages = (dir: string): string[] => {
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

async function optimizeImage(
  sourcePath: string,
  outputPath: string,
  options: {
    pngQuality: number;
    jpgQuality: number;
    webpQuality: number;
    createWebp: boolean;
    webpThresholdBytes: number;
  }
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
    file: path.relative(PROJECT_ROOT, sourcePath),
    output: path.relative(PROJECT_ROOT, outputPath),
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
    row.webpOutput = path.relative(PROJECT_ROOT, webpPath);
    row.webpBytes = fs.statSync(webpPath).size;
  }

  return row;
}

async function main() {
  const args = process.argv.slice(2);
  const sourceDir = args[0];
  const outDir = getOpt(args, '--out') ?? 'output/optimized-assets';
  const pngQuality = parseBoundedInt(getOpt(args, '--png-quality'), 88, '--png-quality', 1, 100);
  const jpgQuality = parseBoundedInt(getOpt(args, '--jpg-quality'), 84, '--jpg-quality', 1, 100);
  const webpQuality = parseBoundedInt(getOpt(args, '--webp-quality'), 84, '--webp-quality', 1, 100);
  const createWebp = parseBoolArg(getOpt(args, '--webp'), true);
  const webpThresholdBytes = parseBoundedInt(
    getOpt(args, '--webp-threshold'),
    300_000,
    '--webp-threshold',
    0,
    100_000_000
  );

  if (!sourceDir) {
    console.error(
      'Usage: npx tsx scripts/optimize-assets.ts <source-dir> ' +
        '[--out output/optimized-assets] [--png-quality 88] [--jpg-quality 84] [--webp true]'
    );
    process.exit(1);
  }
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  const sourceRoot = path.resolve(sourceDir);
  const outputRoot = path.resolve(outDir);
  const images = walkImages(sourceRoot);
  const rows: OptimizeRow[] = [];

  for (const imagePath of images) {
    const relative = path.relative(sourceRoot, imagePath);
    const outputPath = path.join(outputRoot, relative);
    rows.push(await optimizeImage(imagePath, outputPath, {
      pngQuality,
      jpgQuality,
      webpQuality,
      createWebp,
      webpThresholdBytes,
    }));
  }

  const beforeTotal = rows.reduce((sum, row) => sum + row.beforeBytes, 0);
  const afterTotal = rows.reduce((sum, row) => sum + row.afterBytes, 0);
  const report = {
    source: path.relative(PROJECT_ROOT, sourceRoot),
    output: path.relative(PROJECT_ROOT, outputRoot),
    options: { pngQuality, jpgQuality, webpQuality, createWebp, webpThresholdBytes },
    files: rows.length,
    beforeBytes: beforeTotal,
    afterBytes: afterTotal,
    savedBytes: beforeTotal - afterTotal,
    savedPercent: beforeTotal === 0 ? 0 : Number((((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(2)),
    rows: rows.sort((a, b) => b.savedBytes - a.savedBytes),
  };

  fs.mkdirSync(outputRoot, { recursive: true });
  const reportPath = path.join(outputRoot, 'optimization-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`[optimize-assets] files: ${rows.length}`);
  console.log(`[optimize-assets] before: ${(beforeTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[optimize-assets] after: ${(afterTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[optimize-assets] saved: ${report.savedPercent}%`);
  console.log(`[optimize-assets] report: ${path.relative(PROJECT_ROOT, reportPath)}`);
  rows.slice(0, 12).forEach((row) => {
    console.log(`  - ${row.file}: ${row.savedPercent}%`);
    if (row.webpOutput && row.webpBytes !== undefined) {
      console.log(`    webp: ${row.webpOutput} (${(row.webpBytes / 1024).toFixed(0)} KB)`);
    }
  });
}

main().catch((e) => {
  console.error('[optimize-assets] FAILED:', e);
  process.exit(1);
});
