// 아이템 자산 자동 임포트 스크립트.
// 입력: 흰 배경 + 단일 아이템 PNG
// 처리: 흰 배경 제거 + 컨텐츠 자동 정렬 + 32×32 (또는 지정 크기) 로 리사이즈
// 출력: assets/items/<id>.png + <id>.json
//
// 사용법:
//   npx tsx scripts/import-item.ts <id> <source-image> [--name "표시용 이름"] [--size 32]
// 예:
//   npx tsx scripts/import-item.ts extinguisher assets/raw/items/extinguisher.png --name "분말 소화기"
//   npx tsx scripts/import-item.ts exit_sign assets/raw/items/exit_sign.png --name "비상구 표지"

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

type RGB = { r: number; g: number; b: number };
type ResizeFit = 'contain' | 'cover';
type ResizeKernel = 'nearest' | 'lanczos3';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SIZE = 32;
const WHITE_THRESHOLD = 240; // R, G, B 모두 240 이상이면 흰 배경으로 간주

const getOpt = (args: string[], name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const parseRgbArg = (s: string | undefined): RGB | undefined => {
  if (!s) return undefined;
  const parts = s.split(',').map((x) => parseInt(x.trim(), 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid --bg-color "${s}". Use "R,G,B" (0-255).`);
  }
  return { r: parts[0], g: parts[1], b: parts[2] };
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

const parseFit = (value: string | undefined): ResizeFit => {
  const fit = value ?? 'contain';
  if (fit !== 'contain' && fit !== 'cover') {
    throw new Error(`Invalid --fit "${value}". Use contain or cover.`);
  }
  return fit;
};

const parseKernel = (value: string | undefined): ResizeKernel => {
  const kernel = value ?? 'nearest';
  if (kernel !== 'nearest' && kernel !== 'lanczos3') {
    throw new Error(`Invalid --kernel "${value}". Use nearest or lanczos3.`);
  }
  return kernel;
};

const toSharpKernel = (kernel: ResizeKernel) =>
  kernel === 'nearest' ? sharp.kernel.nearest : sharp.kernel.lanczos3;

const colorDist = (a: RGB, b: RGB): number =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

const hasMeaningfulAlpha = (buf: Buffer): boolean => {
  let transparent = 0;
  for (let i = 3; i < buf.length; i += 4) {
    if (buf[i] < 250) transparent++;
  }
  return transparent > buf.length / 4 * 0.01;
};

const processItem = async (
  sourcePath: string,
  options: {
    outSize: number;
    bgColor?: RGB;
    threshold: number;
    fit: ResizeFit;
    kernel: ResizeKernel;
  }
): Promise<Buffer> => {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const out = Buffer.from(data);
  const useExistingAlpha = hasMeaningfulAlpha(out);

  // 흰 배경 → 투명
  if (!useExistingAlpha || options.bgColor) {
    for (let i = 0; i < out.length; i += 4) {
      const px = { r: out[i], g: out[i + 1], b: out[i + 2] };
      const isBg = options.bgColor
        ? colorDist(px, options.bgColor) <= options.threshold
        : out[i] > WHITE_THRESHOLD && out[i + 1] > WHITE_THRESHOLD && out[i + 2] > WHITE_THRESHOLD;
      if (isBg) {
        out[i + 3] = 0;
      }
    }
  }

  // 바운딩박스 + 노이즈 픽셀(이웃 적은 것) 제거
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (out[i + 3] <= 50) continue;

      // 이웃 픽셀 카운트 (8방향)
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = (ny * w + nx) * 4;
          if (out[ni + 3] > 50) neighbors++;
        }
      }
      if (neighbors <= 1) {
        out[i + 3] = 0;
        continue;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('이미지에서 컨텐츠를 찾지 못했습니다 (배경만 있거나 너무 흐립니다).');
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: bw, height: bh })
    .resize(options.outSize, options.outSize, {
      fit: options.fit,
      kernel: toSharpKernel(options.kernel),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
};

const buildItemJson = (id: string, name: string) => ({
  id,
  name,
  itemId: id,
  imageExt: 'png',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  imagePath: `/assets/items/${id}.png`,
});

const writePreview = async (pngPath: string, id: string, outDir: string): Promise<void> => {
  const previewPath = path.join(outDir, `${id}-preview.png`);
  await sharp(pngPath)
    .resize(256, 256, {
      fit: 'contain',
      kernel: sharp.kernel.nearest,
      background: { r: 31, g: 37, b: 33, alpha: 1 },
    })
    .png()
    .toFile(previewPath);
  console.log(`[import-item] preview: ${path.relative(PROJECT_ROOT, previewPath)}`);
};

async function main() {
  const args = process.argv.slice(2);
  const id = args[0];
  const sourcePath = args[1];

  const name = getOpt(args, '--name') ?? id;
  const size = parseBoundedInt(getOpt(args, '--size'), DEFAULT_SIZE, '--size', 8, 256);
  const threshold = parseBoundedInt(getOpt(args, '--threshold'), 30, '--threshold', 0, 255);
  const bgColor = parseRgbArg(getOpt(args, '--bg-color'));
  const fit = parseFit(getOpt(args, '--fit'));
  const kernel = parseKernel(getOpt(args, '--kernel'));
  const preview = parseBoolArg(getOpt(args, '--preview'), true);

  if (!id || !sourcePath) {
    console.error('Usage: npx tsx scripts/import-item.ts <id> <source-image> [--name "표시명"] [--size 32]');
    process.exit(1);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source not found: ${sourcePath}`);
    process.exit(1);
  }

  const outDir = path.join(PROJECT_ROOT, 'assets', 'items');
  fs.mkdirSync(outDir, { recursive: true });

  const buf = await processItem(sourcePath, {
    outSize: size,
    bgColor,
    threshold,
    fit,
    kernel,
  });
  const pngPath = path.join(outDir, `${id}.png`);
  fs.writeFileSync(pngPath, buf);
  console.log(`[import-item] ${id}.png 생성 (${size}×${size})`);

  console.log(`[import-item] options: size=${size}, fit=${fit}, kernel=${kernel}`);
  if (preview) await writePreview(pngPath, id, outDir);

  const json = buildItemJson(id, name);
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(json, null, 2));
  console.log(`[import-item] ${id}.json 생성 완료`);
}

main().catch((e) => {
  console.error('[import-item] FAILED:', e);
  process.exit(1);
});
