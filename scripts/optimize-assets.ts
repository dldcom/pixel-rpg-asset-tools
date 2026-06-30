// Optimize image assets without overwriting source files.
//
// Usage:
//   npx tsx scripts/optimize-assets.ts source-assets/society-4-1-2-2/src-assets \
//     --out output/society-4-1-2-2/assets

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  defaultOptimizeOptions,
  optimizeDirectory,
  type OptimizeOptions,
} from './lib/asset-optimizer';

const PROJECT_ROOT = path.resolve(__dirname, '..');

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

const parseOptions = (args: string[]): OptimizeOptions => ({
  pngQuality: parseBoundedInt(getOpt(args, '--png-quality'), defaultOptimizeOptions.pngQuality, '--png-quality', 1, 100),
  jpgQuality: parseBoundedInt(getOpt(args, '--jpg-quality'), defaultOptimizeOptions.jpgQuality, '--jpg-quality', 1, 100),
  webpQuality: parseBoundedInt(getOpt(args, '--webp-quality'), defaultOptimizeOptions.webpQuality, '--webp-quality', 1, 100),
  createWebp: parseBoolArg(getOpt(args, '--webp'), defaultOptimizeOptions.createWebp),
  webpThresholdBytes: parseBoundedInt(
    getOpt(args, '--webp-threshold'),
    defaultOptimizeOptions.webpThresholdBytes,
    '--webp-threshold',
    0,
    100_000_000
  ),
});

async function main() {
  const args = process.argv.slice(2);
  const sourceDir = args[0];
  const outDir = getOpt(args, '--out') ?? 'output/optimized-assets';
  const options = parseOptions(args);

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
  const report = await optimizeDirectory(sourceRoot, outputRoot, options, PROJECT_ROOT);

  fs.mkdirSync(outputRoot, { recursive: true });
  const reportPath = path.join(outputRoot, 'optimization-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`[optimize-assets] files: ${report.files}`);
  console.log(`[optimize-assets] before: ${(report.beforeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[optimize-assets] after: ${(report.afterBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[optimize-assets] saved: ${report.savedPercent}%`);
  console.log(`[optimize-assets] report: ${path.relative(PROJECT_ROOT, reportPath)}`);
  report.rows.slice(0, 12).forEach((row) => {
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
