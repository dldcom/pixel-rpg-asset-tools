const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CELL = 64;
const COLS = 8;

const root = path.resolve(__dirname, '..');
const workspace = path.resolve(root, '..');
const rawDir = path.join(root, 'assets/raw/items');
const outDir = path.join(root, 'assets/items/minigames');
const sourceDir = path.join(root, 'source-assets/society-4-1-2-2/src-assets/items/minigames');
const gameDir = path.join(workspace, 'society-4-1-2-2-/src/assets/items/minigames');

const items = [
  ['pizza-dough', 'Pizza dough', drawPizzaDough],
  ['pizza-cheese', 'Cheese topping', (p) => drawTopping(p, '#f7d15b', 'cheese')],
  ['pizza-mushroom', 'Mushroom topping', drawMushroom],
  ['pizza-olive', 'Olive topping', (p) => drawSmallRounds(p, '#273c2f', '#7faa4f')],
  ['pizza-corn', 'Corn topping', (p) => drawSmallRounds(p, '#f0c84b', '#ffe082')],
  ['pizza-tomato', 'Tomato topping', (p) => drawSmallRounds(p, '#c84736', '#ff806e')],
  ['pizza-ready', 'Ready pizza', drawReadyPizza],
  ['order-ticket', 'Order ticket', drawOrderTicket],

  ['icecream-cone', 'Ice cream cone', drawCone],
  ['icecream-cup', 'Ice cream cup', drawCup],
  ['scoop-vanilla', 'Vanilla scoop', (p) => drawScoop(p, '#fff0c6', '#e7c67a')],
  ['scoop-strawberry', 'Strawberry scoop', (p) => drawScoop(p, '#f68caf', '#c75278')],
  ['scoop-chocolate', 'Chocolate scoop', (p) => drawScoop(p, '#7b4b35', '#4d2f26')],
  ['cookie-topping', 'Cookie topping', drawCookie],
  ['cherry-topping', 'Cherry topping', drawCherry],
  ['sundae-ready', 'Ready sundae', drawSundae],

  ['pet-dog', 'Pet cafe dog', drawDog],
  ['pet-cat', 'Pet cafe cat', drawCat],
  ['pet-bone', 'Snack bone', drawBone],
  ['water-bowl', 'Water bowl', drawWaterBowl],
  ['pet-brush', 'Pet brush', drawBrush],
  ['toy-ball', 'Toy ball', drawBall],
  ['heart-happy', 'Happy heart', drawHeart],
  ['paw-token', 'Paw token', drawPaw],

  ['arcade-broken', 'Broken arcade', (p) => drawArcade(p, true)],
  ['arcade-fixed', 'Fixed arcade', (p) => drawArcade(p, false)],
  ['wire-red', 'Red wire', (p) => drawWire(p, '#df4b3f')],
  ['wire-blue', 'Blue wire', (p) => drawWire(p, '#4a91d8')],
  ['wire-yellow', 'Yellow wire', (p) => drawWire(p, '#f5cf4a')],
  ['button-red', 'Red button', drawButton],
  ['arcade-lever', 'Arcade lever', drawLever],
  ['circuit-panel', 'Circuit panel', drawCircuit],

  ['stage-light', 'Stage light', drawStageLight],
  ['microphone', 'Microphone', drawMicrophone],
  ['clap-icon', 'Clap icon', drawClap],
  ['rhythm-note', 'Rhythm note', drawRhythmNote],
  ['camera', 'Camera', drawCamera],
  ['shutter-button', 'Shutter button', drawShutter],
  ['photo-frame', 'Photo frame', drawPhotoFrame],
  ['smile-target', 'Smile target', drawSmile],

  ['delivery-bag', 'Delivery bag', drawDeliveryBag],
  ['bread-box', 'Bread box', drawBreadBox],
  ['goal-flag', 'Goal flag', drawGoalFlag],
  ['obstacle-cone', 'Obstacle cone', drawConeObstacle],
  ['robot-body', 'Robot body', drawRobotBody],
  ['robot-head', 'Robot head', drawRobotHead],
  ['robot-wheel', 'Robot wheel', drawRobotWheel],
  ['battery', 'Battery', drawBattery],
];

const curatedSheetItemIds = new Set([
  'pizza-dough',
  'pizza-cheese',
  'pizza-mushroom',
  'pizza-olive',
  'pizza-corn',
  'pizza-tomato',
  'pizza-pepperoni',
  'pizza-basil',
  'pizza-onion',
  'pizza-ready',
  'icecream-cone',
  'icecream-cup',
  'scoop-vanilla',
  'scoop-strawberry',
  'scoop-chocolate',
  'cookie-topping',
  'cherry-topping',
  'pet-dog',
  'pet-cat',
  'pet-rabbit',
  'pet-puppy',
  'pet-tux-cat',
  'pet-hamster',
  'pet-bone',
  'water-bowl',
  'pet-brush',
  'toy-ball',
  'robot-body',
  'robot-head',
  'robot-wheel',
  'robot-wheel-left',
  'robot-wheel-right',
  'battery',
  'robot-antenna',
  'circuit-panel',
  'spark-plug',
]);
const generatedItems = items.filter(([id]) => !curatedSheetItemIds.has(id));

function svg(id, draw) {
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="${CELL}" viewBox="0 0 ${CELL} ${CELL}" shape-rendering="crispEdges">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="0" flood-color="#000000" flood-opacity=".22"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    ${draw()}
  </g>
</svg>`);
}

const px = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const poly = (points, fill, extra = '') => `<polygon points="${points}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, width = 4) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="square"/>`;

function outline(content) {
  return `<g stroke="#372921" stroke-width="3" stroke-linejoin="round">${content}</g>`;
}

function drawPizzaDough() {
  return outline(`${circle(32, 34, 22, '#d99b53')}${circle(27, 28, 4, '#f0c47a')}${circle(40, 39, 3, '#b87944')}`);
}
function drawTopping(_p, fill) {
  return outline(`${px(18, 18, 28, 24, fill)}${px(22, 23, 8, 5, '#fff2a6')}${px(35, 30, 7, 5, '#c79d37')}`);
}
function drawMushroom() {
  return outline(`${circle(32, 27, 15, '#d9c2a4')}${px(24, 29, 16, 18, '#f1dfbf')}${px(23, 25, 18, 7, '#9a6a55')}`);
}
function drawSmallRounds(_p, fill, hi) {
  return outline([circle(23, 24, 6, fill), circle(40, 25, 6, fill), circle(28, 41, 6, fill), circle(44, 40, 5, fill), circle(24, 24, 2, hi), circle(41, 25, 2, hi)].join(''));
}
function drawReadyPizza() {
  return outline(`${circle(32, 34, 23, '#d99b53')}${circle(32, 34, 18, '#f6cf63')}${circle(24, 27, 3, '#c84736')}${circle(39, 31, 3, '#273c2f')}${circle(31, 43, 3, '#f0f0a6')}${line(32, 34, 51, 25, '#8b5b38', 2)}${line(32, 34, 32, 12, '#8b5b38', 2)}`);
}
function drawOrderTicket() {
  return outline(`${px(17, 11, 31, 42, '#fff0c9')}${px(21, 17, 23, 5, '#da6a4f')}${px(21, 28, 17, 4, '#6f8b54')}${px(21, 38, 21, 4, '#4a76a8')}`);
}
function drawCone() {
  return outline(`${poly('23,24 41,24 32,53', '#c98745')}${line(26, 31, 37, 42, '#8e5a35', 2)}${line(38, 31, 27, 42, '#8e5a35', 2)}`);
}
function drawCup() {
  return outline(`${px(19, 25, 26, 24, '#d7eef8')}${px(16, 21, 32, 7, '#f6fbff')}${px(23, 31, 18, 4, '#8ec5dd')}`);
}
function drawScoop(_p, fill, dark) {
  return outline(`${circle(32, 27, 16, fill)}${px(18, 34, 28, 7, fill)}${circle(25, 24, 3, '#fff7df')}${px(25, 39, 14, 6, dark)}`);
}
function drawCookie() {
  return outline(`${circle(32, 32, 16, '#b87945')}${circle(26, 27, 2, '#5a3828')}${circle(36, 31, 2, '#5a3828')}${circle(31, 40, 2, '#5a3828')}`);
}
function drawCherry() {
  return outline(`${line(34, 18, 29, 31, '#47733b', 3)}${circle(28, 35, 8, '#d33445')}${circle(31, 32, 2, '#ff9a9a')}`);
}
function drawSundae() {
  return outline(`${px(20, 31, 24, 18, '#d7eef8')}${circle(32, 23, 13, '#fff0c6')}${circle(32, 15, 5, '#d33445')}${px(26, 34, 12, 4, '#8ec5dd')}`);
}
function drawDog() {
  return outline(`${circle(32, 28, 15, '#b77b43')}${circle(21, 28, 7, '#7a4a30')}${circle(43, 28, 7, '#7a4a30')}${circle(27, 28, 2, '#1f1b1a')}${circle(37, 28, 2, '#1f1b1a')}${px(28, 37, 8, 4, '#372921')}`);
}
function drawCat() {
  return outline(`${poly('18,24 24,12 29,25', '#d19a54')}${poly('46,24 40,12 35,25', '#d19a54')}${circle(32, 30, 16, '#d19a54')}${circle(27, 29, 2, '#1f1b1a')}${circle(37, 29, 2, '#1f1b1a')}${px(30, 37, 4, 3, '#7b4b35')}`);
}
function drawBone() {
  return outline(`${circle(21, 28, 7, '#f5e7cb')}${circle(21, 39, 7, '#f5e7cb')}${circle(43, 28, 7, '#f5e7cb')}${circle(43, 39, 7, '#f5e7cb')}${px(21, 29, 22, 9, '#f5e7cb')}`);
}
function drawWaterBowl() {
  return outline(`${px(17, 32, 30, 14, '#7697b8')}${px(21, 28, 22, 8, '#9de1ff')}${px(25, 30, 10, 2, '#e8fbff')}`);
}
function drawBrush() {
  return outline(`${px(21, 18, 22, 14, '#d68a55')}${px(27, 32, 10, 20, '#8a5a3c')}${px(24, 21, 3, 7, '#f2d0a3')}${px(31, 21, 3, 7, '#f2d0a3')}${px(38, 21, 3, 7, '#f2d0a3')}`);
}
function drawBall() {
  return outline(`${circle(32, 32, 18, '#ec645c')}${pathArc('#f5d65b')}`);
}
function pathArc(fill) {
  return `<path d="M18 32 C28 24 36 24 46 32 C37 39 27 39 18 32Z" fill="${fill}"/>`;
}
function drawHeart() {
  return outline(`${circle(25, 25, 9, '#e84d62')}${circle(39, 25, 9, '#e84d62')}${poly('17,28 47,28 32,48', '#e84d62')}${circle(25, 23, 3, '#ff9faf')}`);
}
function drawPaw() {
  return outline(`${circle(32, 39, 10, '#8b5b38')}${circle(20, 27, 5, '#8b5b38')}${circle(29, 23, 5, '#8b5b38')}${circle(39, 23, 5, '#8b5b38')}${circle(48, 28, 5, '#8b5b38')}`);
}
function drawArcade(_p, broken) {
  return outline(`${px(18, 11, 28, 43, '#40506c')}${px(22, 16, 20, 16, broken ? '#372921' : '#75d18b')}${px(22, 38, 8, 5, '#df4b3f')}${px(34, 38, 8, 5, '#f5cf4a')}${broken ? line(24, 18, 40, 30, '#df4b3f', 2) : px(27, 20, 10, 5, '#e8fff0')}`);
}
function drawWire(_p, color) {
  return outline(`<path d="M13 38 C22 18 42 50 51 27" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><circle cx="13" cy="38" r="5" fill="#d7d7d7"/><circle cx="51" cy="27" r="5" fill="#d7d7d7"/>`);
}
function drawButton() {
  return outline(`${circle(32, 33, 17, '#672f37')}${circle(32, 28, 14, '#df4b3f')}${px(25, 22, 12, 3, '#ff9a8d')}`);
}
function drawLever() {
  return outline(`${px(22, 42, 22, 9, '#6c6f78')}${line(32, 42, 41, 20, '#3d4658', 5)}${circle(43, 17, 7, '#df4b3f')}`);
}
function drawCircuit() {
  return outline(`${px(16, 16, 32, 32, '#426b58')}${line(22, 25, 42, 25, '#9bd27c', 2)}${line(26, 35, 39, 42, '#9bd27c', 2)}${circle(24, 25, 3, '#f5cf4a')}${circle(42, 25, 3, '#f5cf4a')}${circle(26, 35, 3, '#f5cf4a')}`);
}
function drawStageLight() {
  return outline(`${px(21, 17, 22, 18, '#313746')}${poly('22,35 42,35 49,51 15,51', '#f5cf4a')}${circle(32, 26, 7, '#fff1a6')}`);
}
function drawMicrophone() {
  return outline(`${circle(30, 21, 10, '#6c6f78')}${px(26, 29, 8, 19, '#3d4658')}${px(20, 48, 24, 5, '#3d4658')}${line(23, 20, 37, 20, '#d7d7d7', 2)}`);
}
function drawClap() {
  return outline(`${px(18, 25, 12, 25, '#f0b57a')}${px(34, 20, 12, 27, '#f6c28b')}${line(15, 19, 10, 13, '#f5cf4a', 3)}${line(49, 16, 55, 10, '#f5cf4a', 3)}`);
}
function drawRhythmNote() {
  return outline(`${circle(26, 42, 7, '#c66c9c')}${circle(42, 37, 7, '#c66c9c')}${px(31, 17, 4, 25, '#c66c9c')}${px(47, 12, 4, 25, '#c66c9c')}${px(31, 13, 20, 5, '#c66c9c')}`);
}
function drawCamera() {
  return outline(`${px(15, 24, 34, 23, '#2f3448')}${px(22, 18, 13, 8, '#4f5c73')}${circle(32, 35, 9, '#83b6d8')}${circle(32, 35, 4, '#1d2330')}`);
}
function drawShutter() {
  return outline(`${circle(32, 32, 18, '#d7d7d7')}${circle(32, 32, 12, '#f6f6f6')}${circle(32, 32, 5, '#df4b3f')}`);
}
function drawPhotoFrame() {
  return outline(`${px(16, 15, 32, 34, '#fff0c9')}${px(20, 19, 24, 20, '#91bf70')}${circle(27, 27, 5, '#ffd94f')}${poly('20,39 31,29 44,39', '#4a8f5a')}`);
}
function drawSmile() {
  return outline(`${circle(32, 32, 18, '#f6c28b')}${circle(26, 29, 2, '#372921')}${circle(38, 29, 2, '#372921')}${px(25, 38, 14, 3, '#7b4b35')}`);
}
function drawDeliveryBag() {
  return outline(`${px(18, 24, 28, 25, '#c35c3d')}${px(24, 17, 16, 10, '#8b3f2e')}${px(24, 31, 16, 6, '#ffd56d')}`);
}
function drawBreadBox() {
  return outline(`${px(15, 24, 34, 24, '#b87945')}${px(19, 18, 26, 9, '#e0ad67')}${circle(25, 28, 5, '#f1c17a')}${circle(38, 28, 5, '#f1c17a')}`);
}
function drawGoalFlag() {
  return outline(`${line(23, 13, 23, 52, '#6b4a35', 4)}${poly('25,14 49,22 25,30', '#df4b3f')}${px(18, 51, 14, 5, '#6b4a35')}`);
}
function drawConeObstacle() {
  return outline(`${poly('32,14 46,50 18,50', '#e87d36')}${px(24, 34, 16, 5, '#fff0c9')}${px(20, 49, 24, 5, '#6b4a35')}`);
}
function drawRobotBody() {
  return outline(`${px(19, 21, 26, 27, '#9aa9b4')}${px(24, 27, 6, 6, '#75d18b')}${px(35, 27, 6, 6, '#df4b3f')}${px(25, 39, 14, 4, '#5b6b75')}`);
}
function drawRobotHead() {
  return outline(`${px(18, 20, 28, 24, '#b7c7d0')}${circle(26, 31, 3, '#40506c')}${circle(38, 31, 3, '#40506c')}${line(32, 14, 32, 20, '#5b6b75', 3)}${circle(32, 12, 3, '#f5cf4a')}`);
}
function drawRobotWheel() {
  return outline(`${circle(32, 32, 17, '#3d4658')}${circle(32, 32, 9, '#9aa9b4')}${line(20, 32, 44, 32, '#1d2330', 3)}${line(32, 20, 32, 44, '#1d2330', 3)}`);
}
function drawBattery() {
  return outline(`${px(19, 21, 26, 28, '#5f9f6f')}${px(27, 16, 10, 6, '#5f9f6f')}${px(24, 28, 16, 5, '#d7f7a7')}${px(31, 24, 2, 14, '#d7f7a7')}`);
}

async function main() {
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(gameDir, { recursive: true });

  const rows = Math.ceil(generatedItems.length / COLS);
  const cells = await Promise.all(generatedItems.map(([id, , draw]) => sharp(svg(id, draw)).png().toBuffer()));
  const composites = cells.map((input, index) => ({
    input,
    left: (index % COLS) * CELL,
    top: Math.floor(index / COLS) * CELL,
  }));

  const sheet = await sharp({
    create: {
      width: COLS * CELL,
      height: rows * CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  const sheetPath = path.join(rawDir, 'society-minigame-items-sheet.png');
  fs.writeFileSync(sheetPath, sheet);

  const manifest = {
    id: 'society-minigame-items',
    cellSize: CELL,
    columns: COLS,
    rows,
    image: 'society-minigame-items-sheet.png',
    items: generatedItems.map(([id, name], index) => ({
      id,
      name,
      file: `${id}.png`,
      frame: {
        x: (index % COLS) * CELL,
        y: Math.floor(index / COLS) * CELL,
        w: CELL,
        h: CELL,
      },
    })),
  };
  fs.writeFileSync(path.join(rawDir, 'society-minigame-items-sheet.json'), JSON.stringify(manifest, null, 2));

  const generated = [sheetPath];
  for (const [id, name] of generatedItems) {
    const index = generatedItems.findIndex((item) => item[0] === id);
    const png = await sharp(sheet)
      .extract({ left: (index % COLS) * CELL, top: Math.floor(index / COLS) * CELL, width: CELL, height: CELL })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    const itemJson = {
      id,
      name,
      itemId: id,
      imageExt: 'png',
      imagePath: `/assets/items/minigames/${id}.png`,
      sourceSheet: 'society-minigame-items-sheet.png',
    };
    for (const dir of [outDir, sourceDir, gameDir]) {
      fs.writeFileSync(path.join(dir, `${id}.png`), png);
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(itemJson, null, 2));
    }
    generated.push(path.join(outDir, `${id}.png`));
  }

  const preview = await sharp(sheet)
    .resize(COLS * CELL * 2, rows * CELL * 2, { kernel: sharp.kernel.nearest })
    .flatten({ background: { r: 31, g: 37, b: 33 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  fs.writeFileSync(path.join(outDir, 'society-minigame-items-preview.png'), preview);
  fs.writeFileSync(path.join(sourceDir, 'society-minigame-items-sheet.png'), sheet);
  fs.writeFileSync(path.join(sourceDir, 'society-minigame-items-sheet.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(gameDir, 'society-minigame-items-sheet.png'), sheet);
  fs.writeFileSync(path.join(gameDir, 'society-minigame-items-sheet.json'), JSON.stringify(manifest, null, 2));

  console.log(`[create-society-minigame-items] sheet: ${path.relative(root, sheetPath)} (${COLS * CELL}x${rows * CELL})`);
  console.log(`[create-society-minigame-items] items: ${generatedItems.length}`);
  console.log(`[create-society-minigame-items] out: ${path.relative(root, outDir)}`);
  console.log(`[create-society-minigame-items] game: ${path.relative(workspace, gameDir)}`);
}

main().catch((error) => {
  console.error('[create-society-minigame-items] FAILED:', error);
  process.exit(1);
});
