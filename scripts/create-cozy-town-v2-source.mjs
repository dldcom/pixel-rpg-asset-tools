import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'tilesets/cozy-town/source/cozy-town-sheet-v2.png');
const W = 256;
const H = 256;
const T = 32;
const buf = Buffer.alloc(W * H * 4, 0);

const rgba = (r, g, b, a = 255) => [r, g, b, a];
const origin = (col, row) => [col * T, row * T];
const noise = (x, y, salt = 0) => (x * 37 + y * 61 + salt * 97 + ((x * y) % 53)) % 100;

function put(x, y, color) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
  buf[i + 3] = color[3];
}

function rect(x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) put(xx, yy, color);
  }
}

function grass(ox, oy, salt = 0, bias = 0) {
  rect(ox, oy, T, T, rgba(96 + bias, 154 + bias, 78 + bias));
  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < T; x += 1) {
      const n = noise(ox + x, oy + y, salt);
      if (n < 9) put(ox + x, oy + y, rgba(72 + bias, 129 + bias, 70 + bias));
      else if (n > 93) put(ox + x, oy + y, rgba(126 + bias, 177 + bias, 83 + bias));
      else if ((x + salt) % 9 === 0 && n > 72) put(ox + x, oy + y, rgba(84 + bias, 143 + bias, 72 + bias));
    }
  }
  for (let i = 0; i < 7; i += 1) {
    const x = ((i * 11 + salt * 3) % 29) + 1;
    const y = ((i * 7 + salt * 5) % 29) + 1;
    put(ox + x, oy + y, rgba(142, 188, 92));
    put(ox + x + 1, oy + y, rgba(76, 132, 69));
  }
}

function dirt(ox, oy) {
  rect(ox, oy, T, T, rgba(164, 118, 70));
  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < T; x += 1) {
      const n = noise(ox + x, oy + y, 4);
      if (n < 12) put(ox + x, oy + y, rgba(130, 91, 60));
      else if (n > 88) put(ox + x, oy + y, rgba(193, 143, 85));
    }
  }
  for (let x = 3; x < 30; x += 7) {
    const y = 7 + ((x * 3) % 17);
    put(ox + x, oy + y, rgba(112, 77, 56));
    put(ox + x + 1, oy + y, rgba(190, 141, 86));
  }
}

function stone(ox, oy, salt = 0) {
  rect(ox, oy, T, T, rgba(130, 137, 126));
  const stones = [[1, 1, 12, 9], [14, 1, 17, 8], [1, 12, 9, 18], [12, 11, 18, 8], [13, 22, 18, 9]];
  for (const item of stones) {
    rect(
      ox + item[0],
      oy + item[1],
      item[2],
      item[3],
      rgba(127 + noise(item[0], item[1], salt) % 18, 134 + noise(item[1], item[2], salt) % 18, 124 + noise(item[2], item[3], salt) % 14)
    );
  }
  for (let x = 0; x < T; x += 1) {
    put(ox + x, oy + 10, rgba(91, 101, 97));
    put(ox + x, oy + 21, rgba(91, 101, 97));
  }
  for (let y = 0; y < T; y += 1) {
    put(ox + 13, oy + y, rgba(91, 101, 97));
    if (y > 10) put(ox + 10, oy + y, rgba(91, 101, 97));
  }
  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < T; x += 1) {
      const n = noise(ox + x, oy + y, 20 + salt);
      if (n < 5) put(ox + x, oy + y, rgba(96, 108, 101));
      else if (n > 95) put(ox + x, oy + y, rgba(160, 166, 151));
    }
  }
}

function water(ox, oy, salt = 0) {
  rect(ox, oy, T, T, rgba(61, 132, 160));
  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < T; x += 1) {
      const n = noise(ox + x, oy + y, 50 + salt);
      if (n < 12) put(ox + x, oy + y, rgba(40, 104, 143));
      else if (n > 91) put(ox + x, oy + y, rgba(96, 176, 188));
    }
  }
  for (let y = 7; y < 29; y += 8) {
    for (let x = 2; x < 30; x += 1) {
      if ((x + y + salt) % 5 < 2) {
        put(ox + x, oy + y, rgba(139, 204, 202));
        put(ox + x + 1, oy + y, rgba(84, 157, 178));
      }
    }
  }
}

function flower(x, y, color) {
  put(x, y, color);
  put(x - 1, y, color);
  put(x + 1, y, color);
  put(x, y - 1, color);
  put(x, y + 1, color);
  put(x, y, rgba(246, 214, 88));
}

function shadow(ox, oy, x, y, w, h) {
  rect(ox + x, oy + y, w, h, rgba(42, 56, 48, 100));
}

function edgeTile(col, row, kind, edge) {
  const [ox, oy] = origin(col, row);
  grass(ox, oy, 20 + col + row);
  const color = kind === 'water' ? rgba(61, 132, 160) : rgba(164, 118, 70);
  if (edge === 'top') rect(ox, oy + 8, 32, 24, color);
  if (edge === 'right') rect(ox, oy, 24, 32, color);
  if (edge === 'bottom') rect(ox, oy, 32, 24, color);
  if (edge === 'left') rect(ox + 8, oy, 24, 32, color);
  if (edge === 'tl') rect(ox + 8, oy + 8, 24, 24, color);
  if (edge === 'tr') rect(ox, oy + 8, 24, 24, color);
  if (edge === 'br') rect(ox, oy, 24, 24, color);
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 7 + col) % 32;
    const y = (i * 11 + row * 3) % 32;
    if (kind === 'water' && noise(ox + x, oy + y, 9) > 65) put(ox + x, oy + y, rgba(96, 176, 188));
    if (kind === 'dirt' && noise(ox + x, oy + y, 8) > 45) put(ox + x, oy + y, rgba(130, 91, 60));
  }
}

function fenceH(ox, oy) {
  grass(ox, oy, 8);
  shadow(ox, oy, 1, 22, 30, 4);
  rect(ox + 2, oy + 14, 28, 5, rgba(151, 93, 54));
  rect(ox + 2, oy + 10, 28, 4, rgba(185, 119, 64));
  for (const x of [5, 16, 27]) {
    rect(ox + x, oy + 7, 3, 16, rgba(112, 69, 46));
    rect(ox + x + 1, oy + 7, 1, 12, rgba(205, 139, 76));
  }
}

function fenceV(ox, oy) {
  grass(ox, oy, 9);
  shadow(ox, oy, 18, 4, 5, 25);
  rect(ox + 13, oy + 3, 5, 27, rgba(151, 93, 54));
  rect(ox + 18, oy + 3, 4, 27, rgba(95, 59, 42));
  for (const y of [7, 18, 27]) rect(ox + 10, oy + y, 14, 3, rgba(185, 119, 64));
}

function tree(ox, oy, round = false) {
  grass(ox, oy, 31);
  shadow(ox, oy, 8, 23, 18, 5);
  rect(ox + 14, oy + 18, 5, 9, rgba(108, 70, 43));
  rect(ox + 13, oy + 18, 1, 8, rgba(75, 48, 35));
  if (round) {
    rect(ox + 7, oy + 7, 18, 15, rgba(48, 117, 65));
    rect(ox + 5, oy + 11, 22, 9, rgba(71, 145, 75));
    rect(ox + 10, oy + 4, 12, 6, rgba(116, 174, 83));
  } else {
    rect(ox + 12, oy + 3, 8, 8, rgba(116, 174, 83));
    rect(ox + 8, oy + 8, 17, 10, rgba(71, 145, 75));
    rect(ox + 5, oy + 14, 23, 8, rgba(48, 117, 65));
  }
  for (let i = 0; i < 20; i += 1) {
    const x = (i * 7) % 23 + 5;
    const y = (i * 11) % 16 + 4;
    if (noise(x, y, 3) > 35) put(ox + x, oy + y, rgba(142, 190, 91));
  }
}

function bench(ox, oy) {
  grass(ox, oy, 15);
  shadow(ox, oy, 6, 23, 21, 5);
  rect(ox + 6, oy + 13, 21, 4, rgba(153, 88, 52));
  rect(ox + 5, oy + 18, 22, 4, rgba(115, 66, 45));
  rect(ox + 7, oy + 11, 2, 14, rgba(73, 57, 49));
  rect(ox + 24, oy + 11, 2, 14, rgba(73, 57, 49));
  rect(ox + 7, oy + 13, 18, 1, rgba(218, 143, 76));
}

function sign(ox, oy) {
  grass(ox, oy, 17);
  shadow(ox, oy, 12, 25, 9, 3);
  rect(ox + 15, oy + 15, 3, 11, rgba(93, 61, 40));
  rect(ox + 8, oy + 9, 17, 8, rgba(183, 126, 68));
  rect(ox + 9, oy + 10, 15, 1, rgba(225, 161, 86));
  rect(ox + 10, oy + 13, 11, 1, rgba(92, 61, 41));
}

function lamp(ox, oy) {
  grass(ox, oy, 18);
  shadow(ox, oy, 12, 26, 9, 3);
  rect(ox + 15, oy + 10, 3, 17, rgba(51, 58, 65));
  rect(ox + 13, oy + 7, 7, 5, rgba(75, 80, 82));
  rect(ox + 14, oy + 8, 5, 3, rgba(255, 215, 108));
  rect(ox + 13, oy + 6, 7, 1, rgba(166, 155, 100));
}

function crate(ox, oy) {
  grass(ox, oy, 21);
  shadow(ox, oy, 8, 24, 17, 4);
  rect(ox + 8, oy + 12, 17, 13, rgba(144, 91, 52));
  rect(ox + 10, oy + 14, 13, 9, rgba(174, 113, 62));
  rect(ox + 8, oy + 12, 17, 2, rgba(219, 151, 81));
  rect(ox + 15, oy + 12, 2, 13, rgba(95, 62, 43));
  rect(ox + 9, oy + 22, 15, 2, rgba(85, 55, 39));
}

function barrel(ox, oy) {
  grass(ox, oy, 22);
  shadow(ox, oy, 10, 25, 14, 3);
  rect(ox + 10, oy + 11, 14, 14, rgba(124, 73, 47));
  rect(ox + 12, oy + 9, 10, 18, rgba(160, 94, 53));
  rect(ox + 11, oy + 13, 12, 2, rgba(75, 66, 61));
  rect(ox + 11, oy + 21, 12, 2, rgba(75, 66, 61));
  rect(ox + 14, oy + 10, 3, 16, rgba(192, 122, 65));
}

for (let col = 0; col < 8; col += 1) {
  const [ox, oy] = origin(col, 0);
  grass(ox, oy, col, col === 6 ? 10 : col === 7 ? -12 : 0);
}
for (const item of [[9, 11], [22, 8], [16, 23]]) flower(origin(3, 0)[0] + item[0], origin(3, 0)[1] + item[1], rgba(225, 95, 100));
for (const item of [[8, 15], [18, 9], [24, 22]]) {
  put(origin(4, 0)[0] + item[0], origin(4, 0)[1] + item[1], rgba(52, 132, 58));
  put(origin(4, 0)[0] + item[0] + 1, origin(4, 0)[1] + item[1], rgba(178, 218, 113));
}
rect(origin(5, 0)[0], origin(5, 0)[1] + 21, 32, 11, rgba(52, 94, 64, 130));

dirt(...origin(0, 1));
['top', 'right', 'bottom', 'left', 'tl', 'tr', 'br'].forEach((edge, index) => edgeTile(index + 1, 1, 'dirt', edge));

for (let col = 0; col < 8; col += 1) {
  const [ox, oy] = origin(col, 2);
  if (col >= 3) grass(ox, oy, 30 + col);
  stone(ox, oy, col);
}
rect(origin(1, 2)[0] + 7, origin(1, 2)[1] + 12, 2, 12, rgba(71, 82, 78));
rect(origin(1, 2)[0] + 9, origin(1, 2)[1] + 22, 8, 2, rgba(71, 82, 78));
rect(origin(2, 2)[0] + 18, origin(2, 2)[1] + 7, 2, 13, rgba(71, 82, 78));
rect(origin(2, 2)[0] + 13, origin(2, 2)[1] + 15, 7, 2, rgba(71, 82, 78));

water(...origin(0, 3));
['top', 'right', 'bottom', 'left', 'tl', 'tr', 'br'].forEach((edge, index) => edgeTile(index + 1, 3, 'water', edge));

fenceH(...origin(0, 4));
fenceV(...origin(1, 4));
for (let col = 2; col <= 5; col += 1) {
  const [ox, oy] = origin(col, 4);
  grass(ox, oy, 50 + col);
  fenceH(ox, oy);
  fenceV(ox, oy);
}
grass(...origin(6, 4), 56);
shadow(...origin(6, 4), 3, 23, 26, 4);
rect(origin(6, 4)[0] + 3, origin(6, 4)[1] + 12, 26, 12, rgba(112, 110, 100));
rect(origin(6, 4)[0] + 3, origin(6, 4)[1] + 12, 26, 2, rgba(158, 157, 140));
for (let x = 4; x < 29; x += 7) rect(origin(6, 4)[0] + x, origin(6, 4)[1] + 14, 2, 9, rgba(80, 83, 78));
grass(...origin(7, 4), 57);
fenceH(...origin(7, 4));
rect(origin(7, 4)[0] + 12, origin(7, 4)[1] + 9, 9, 16, rgba(109, 72, 46));
rect(origin(7, 4)[0] + 15, origin(7, 4)[1] + 10, 2, 14, rgba(206, 137, 72));

tree(...origin(0, 5), false);
tree(...origin(1, 5), true);
grass(...origin(2, 5), 62);
shadow(...origin(2, 5), 7, 22, 18, 4);
rect(origin(2, 5)[0] + 7, origin(2, 5)[1] + 13, 19, 9, rgba(54, 124, 65));
rect(origin(2, 5)[0] + 10, origin(2, 5)[1] + 10, 13, 8, rgba(78, 153, 72));
rect(origin(2, 5)[0] + 14, origin(2, 5)[1] + 12, 2, 2, rgba(147, 194, 89));
grass(...origin(3, 5), 63);
shadow(...origin(3, 5), 6, 23, 20, 4);
rect(origin(3, 5)[0] + 6, origin(3, 5)[1] + 15, 21, 8, rgba(48, 112, 75));
rect(origin(3, 5)[0] + 11, origin(3, 5)[1] + 11, 12, 8, rgba(86, 164, 86));
rect(origin(3, 5)[0] + 19, origin(3, 5)[1] + 13, 2, 2, rgba(232, 185, 103));
for (const item of [[10, 13], [18, 20], [23, 10], [7, 23]]) flower(origin(4, 5)[0] + item[0], origin(4, 5)[1] + item[1], rgba(221, 83, 94));
for (const item of [[11, 14], [19, 21], [24, 11], [7, 22]]) flower(origin(5, 5)[0] + item[0], origin(5, 5)[1] + item[1], rgba(244, 204, 83));
grass(...origin(6, 5), 66);
shadow(...origin(6, 5), 11, 22, 13, 4);
rect(origin(6, 5)[0] + 10, origin(6, 5)[1] + 14, 14, 9, rgba(100, 106, 101));
rect(origin(6, 5)[0] + 13, origin(6, 5)[1] + 12, 8, 4, rgba(145, 148, 135));
rect(origin(6, 5)[0] + 17, origin(6, 5)[1] + 15, 3, 2, rgba(75, 81, 80));
grass(...origin(7, 5), 67);
shadow(...origin(7, 5), 9, 23, 16, 5);
rect(origin(7, 5)[0] + 10, origin(7, 5)[1] + 13, 14, 11, rgba(118, 74, 45));
rect(origin(7, 5)[0] + 12, origin(7, 5)[1] + 11, 10, 4, rgba(151, 92, 54));
rect(origin(7, 5)[0] + 14, origin(7, 5)[1] + 8, 2, 5, rgba(74, 122, 54));

bench(...origin(0, 6));
sign(...origin(1, 6));
lamp(...origin(2, 6));
grass(...origin(3, 6), 73);
shadow(...origin(3, 6), 10, 24, 13, 4);
rect(origin(3, 6)[0] + 10, origin(3, 6)[1] + 12, 12, 12, rgba(61, 111, 150));
rect(origin(3, 6)[0] + 9, origin(3, 6)[1] + 10, 14, 4, rgba(202, 74, 74));
rect(origin(3, 6)[0] + 12, origin(3, 6)[1] + 14, 7, 1, rgba(231, 228, 190));
crate(...origin(4, 6));
barrel(...origin(5, 6));
grass(...origin(6, 6), 76);
shadow(...origin(6, 6), 4, 24, 25, 5);
rect(origin(6, 6)[0] + 5, origin(6, 6)[1] + 10, 23, 5, rgba(210, 92, 68));
rect(origin(6, 6)[0] + 4, origin(6, 6)[1] + 14, 25, 4, rgba(241, 185, 91));
rect(origin(6, 6)[0] + 7, origin(6, 6)[1] + 18, 20, 8, rgba(130, 84, 52));
rect(origin(6, 6)[0] + 10, origin(6, 6)[1] + 18, 2, 8, rgba(73, 58, 45));
rect(origin(6, 6)[0] + 23, origin(6, 6)[1] + 18, 2, 8, rgba(73, 58, 45));
grass(...origin(7, 6), 77);
shadow(...origin(7, 6), 9, 25, 14, 3);
rect(origin(7, 6)[0] + 11, origin(7, 6)[1] + 10, 13, 15, rgba(101, 72, 47));
rect(origin(7, 6)[0] + 9, origin(7, 6)[1] + 8, 17, 4, rgba(171, 107, 55));
rect(origin(7, 6)[0] + 13, origin(7, 6)[1] + 14, 8, 1, rgba(224, 177, 96));
rect(origin(7, 6)[0] + 13, origin(7, 6)[1] + 17, 7, 1, rgba(224, 177, 96));

grass(...origin(0, 7), 80);
shadow(...origin(0, 7), 7, 13, 18, 9);
grass(...origin(1, 7), 81);
shadow(...origin(1, 7), 3, 15, 26, 7);
grass(...origin(2, 7), 82);
rect(origin(2, 7)[0] + 10, origin(2, 7)[1] + 14, 12, 9, rgba(78, 116, 174));
rect(origin(2, 7)[0] + 12, origin(2, 7)[1] + 11, 8, 5, rgba(123, 166, 218));
rect(origin(2, 7)[0] + 15, origin(2, 7)[1] + 8, 2, 8, rgba(246, 215, 88));
grass(...origin(3, 7), 83);
rect(origin(3, 7)[0] + 7, origin(3, 7)[1] + 13, 18, 10, rgba(145, 89, 54));
rect(origin(3, 7)[0] + 8, origin(3, 7)[1] + 14, 16, 2, rgba(207, 142, 74));
rect(origin(3, 7)[0] + 10, origin(3, 7)[1] + 19, 12, 1, rgba(94, 59, 42));
grass(...origin(4, 7), 84);
for (let y = 9; y < 27; y += 5) {
  rect(origin(4, 7)[0] + 7, origin(4, 7)[1] + y, 18, 3, rgba(145, 145, 130));
  rect(origin(4, 7)[0] + 8, origin(4, 7)[1] + y, 16, 1, rgba(190, 188, 164));
}
water(...origin(5, 7), 85);
rect(origin(5, 7)[0], origin(5, 7)[1] + 12, 32, 9, rgba(139, 91, 54));
for (let x = 1; x < 32; x += 6) rect(origin(5, 7)[0] + x, origin(5, 7)[1] + 11, 2, 11, rgba(93, 62, 44));
water(...origin(6, 7), 86);
rect(origin(6, 7)[0] + 12, origin(6, 7)[1], 9, 32, rgba(139, 91, 54));
for (let y = 1; y < 32; y += 6) rect(origin(6, 7)[0] + 11, origin(6, 7)[1] + y, 11, 2, rgba(93, 62, 44));
grass(...origin(7, 7), 87);

fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
  .png({ compressionLevel: 9, palette: true })
  .toFile(out);

console.log(`[create-cozy-town-v2-source] ${path.relative(root, out)}`);
