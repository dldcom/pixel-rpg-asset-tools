# Import Script Pipeline

이 문서는 `pixel-rpg-asset-tools`의 import 스크립트들이 내부적으로 어떤 순서로 실행되는지 설명합니다.

목표는 코드를 처음 보는 사람이 “명령을 실행하면 내부에서 무슨 일이 벌어지는지” 이해하는 것입니다.

## Shared Shape

대부분의 import 스크립트는 같은 흐름을 따릅니다.

```text
1. CLI 인자 읽기
2. 옵션 기본값 적용
3. 입력 파일 존재 확인
4. 출력 폴더 생성
5. Sharp로 이미지 읽기/보정/분리/리사이즈
6. PNG/JPG 결과물 저장
7. JSON metadata 저장
8. preview 이미지 저장
9. --optimize true이면 생성 이미지 압축
```

공통 최적화는 [scripts/lib/asset-optimizer.ts](../scripts/lib/asset-optimizer.ts)에 있습니다.

자동 압축은 기본값이 켜져 있습니다.

```bash
--optimize true
```

끄려면:

```bash
--optimize false
```

## import-character.ts

[scripts/import-character.ts](../scripts/import-character.ts)는 캐릭터 또는 NPC 이미지를 게임용 walking atlas로 바꿉니다.

기본 출력 atlas 규격:

```text
frame: 48x64
directions: down, up, right, left
frames per direction: 6
atlas: 288x256
```

출력 예:

```text
assets/characters/cat.png
assets/characters/cat.json
assets/characters/cat-preview.png
assets/characters/cat-frames/*.png
```

### 실행 흐름

```text
main()
→ CLI 인자 파싱
→ --mode auto이면 inferMode()
→ mode별 import 함수 실행
→ buildAtlasJson()
→ 개별 frame PNG 저장
→ preview 저장
→ optimizeFilesInPlace()
```

### Mode: atlas

이미 완성된 atlas를 입력으로 받는 모드입니다.

```text
source image
→ ensureAlpha()
→ 288x256 contain resize
→ assets/<type>/<id>.png 저장
```

이 모드는 입력 이미지가 이미 4방향 walking sheet에 가까울 때 씁니다.

### Mode: single

정면 이미지 한 장만 있는 경우입니다.

```text
source image
→ 흰 배경 제거
→ 콘텐츠 bounding box 계산
→ 48x64 프레임으로 정렬
→ 같은 프레임을 24칸 전체에 반복 배치
→ atlas 저장
```

걷기 애니메이션은 없지만, 프로토타입용 캐릭터로 빠르게 쓸 수 있습니다.

### Mode: split3

정면/측면/후면 3분할 이미지를 walking atlas로 합성하는 모드입니다.

```text
source image
→ 3등분: front, side, back
→ 모서리 색으로 배경 자동 감지
→ 배경 제거
→ 노이즈 제거
→ main connected component만 유지
→ 세 view의 scale 통일
→ front 기준으로 head/leg line 추정
→ 머리/몸/다리 픽셀을 프레임별로 조금씩 이동
→ 24프레임 walking atlas 합성
```

이 모드는 “AI가 정면/측면/후면 캐릭터를 한 이미지에 그려준 경우”에 유용합니다.

### Mode: grid

4방향 x N프레임 sprite sheet를 정규화하는 모드입니다.

```text
source image
→ rows/cols 기준으로 cell 추출
→ 각 cell 배경 제거 또는 alpha 사용
→ content bbox 계산
→ 공통 target height로 normalize
→ 발 기준선에 맞춰 정렬
→ 6프레임 walking atlas로 재배치
```

기본 row order:

```text
down,left,right,up
```

출력 atlas row order:

```text
down,up,right,left
```

### Mode: auto

입력 이미지 크기/비율로 모드를 추정합니다.

```text
288x256이면 atlas
가로가 아주 길면 split3
정사각형에 가까우면 grid
그 외 single
```

### JSON metadata

`buildAtlasJson()`은 각 프레임 좌표를 JSON으로 기록합니다.

```json
{
  "frames": {
    "down_0": { "frame": { "x": 0, "y": 0, "w": 48, "h": 64 } }
  }
}
```

게임에서는 이 JSON을 보고 atlas의 각 프레임을 해석할 수 있습니다.

## import-item.ts

[scripts/import-item.ts](../scripts/import-item.ts)는 아이템 이미지를 작은 게임 아이콘으로 만듭니다.

기본 출력:

```text
assets/items/<id>.png
assets/items/<id>.json
assets/items/<id>-preview.png
```

### 실행 흐름

```text
main()
→ CLI 인자 파싱
→ processItem()
→ PNG 저장
→ preview 저장
→ JSON 저장
→ optimizeFilesInPlace()
```

### processItem()

아이템 이미지를 정리하는 핵심 함수입니다.

```text
source image
→ ensureAlpha()
→ raw RGBA buffer 읽기
→ 기존 alpha가 있는지 확인
→ 배경 제거
→ 노이즈 제거
→ content bounding box 계산
→ bbox 영역만 extract
→ size x size로 resize
→ PNG buffer 반환
```

### Background Removal

두 가지 방식이 있습니다.

1. 이미 투명 PNG인 경우

```text
alpha를 존중하고 그대로 사용
```

2. 배경이 박힌 이미지인 경우

```text
--bg-color가 있으면 해당 색과 threshold 거리 안의 픽셀 제거
--bg-color가 없으면 RGB 240 이상인 흰색 계열 제거
```

예:

```bash
--bg-color "255,255,255" --threshold 30
```

### Noise Removal

아이템 주변에 작은 점이 남는 경우를 줄이기 위해 주변 픽셀 수를 봅니다.

```text
8방향 이웃 중 alpha 픽셀이 너무 적으면 노이즈로 보고 제거
```

### Resize

기본은 32x32입니다.

```bash
--size 32
```

픽셀아트라면:

```bash
--kernel nearest
```

부드러운 일러스트라면:

```bash
--kernel lanczos3
```

## import-map.ts

[scripts/import-map.ts](../scripts/import-map.ts)는 한 장짜리 맵 이미지를 게임용 map image와 Tiled 스타일 JSON으로 만듭니다.

출력:

```text
assets/maps/<id>.jpg
assets/maps/<id>.json
assets/maps/<id>-preview.jpg
```

### 실행 흐름

```text
main()
→ CLI 인자 파싱
→ map config JSON 읽기
→ spawn/wall/overlay 검증
→ source image를 1280x1280 JPG로 변환
→ Tiled 스타일 JSON 생성
→ preview 생성
→ optimizeFilesInPlace()
```

### Config

`import-map`은 특정 게임 코드에 의존하지 않고 JSON config를 읽습니다.

```bash
--config maps/act1_library.config.json
```

config에는 세 가지 주요 정보가 있습니다.

```text
actNumber: 맵이 속한 act 번호
spawns: 플레이어/NPC/목적지 위치
walls: 못 지나가는 타일 영역
overlays: 위에 덮이는 타일 영역
```

예:

```json
{
  "actNumber": 1,
  "spawns": [
    { "name": "player", "x": 160, "y": 320 }
  ],
  "walls": [
    { "col": 0, "row": 0, "w": 40, "h": 1 }
  ],
  "overlays": []
}
```

### Coordinate Rules

```text
image size: 1280x1280
tile size: 32x32
grid: 40x40
spawn: pixel coordinate
wall/overlay: tile coordinate
```

### Image Resize

source map은 `1280x1280` JPG로 변환됩니다.

```bash
--fit cover
```

`cover`
: 비율 유지, 정사각형을 꽉 채움, 일부 crop 가능

`contain`
: 비율 유지, 전체 이미지 보존, 빈 영역 padding

`fill`
: 강제 변형, 이미지가 찌그러질 수 있음

### JSON 생성

`makeTiledJson()`이 Tiled에서 쓰는 것과 비슷한 구조를 만듭니다.

```text
collision tilelayer
overlay tilelayer
spawn objectgroup
```

`tileRectsToGrid()`는 `{ col, row, w, h }` 사각형들을 40x40 1차원 grid 배열로 바꿉니다.

## import-tileset.ts

[scripts/import-tileset.ts](../scripts/import-tileset.ts)는 큰 타일셋 스프라이트시트 한 장을 여러 타일로 분리합니다.

예:

```bash
npm run import:tileset -- cozy-town tilesets/cozy-town/source/cozy-town-sheet.png --manifest tilesets/cozy-town/manifest.example.json
```

출력:

```text
tilesets/cozy-town/tileset.png
tilesets/cozy-town/tileset.json
tilesets/cozy-town/preview.png
tilesets/cozy-town/tiles/*.png
```

### 실행 흐름

```text
main()
→ CLI 인자 파싱
→ manifest 읽기
→ tileSize/cols/rows 결정
→ tile entry 검증
→ source sheet를 규격 크기로 normalize
→ 각 tile cell extract
→ tiles/*.png 저장
→ preview.png 생성
→ tileset.json 생성
→ optimizeFilesInPlace()
```

### Manifest

manifest는 각 타일에 이름과 의미를 붙입니다.

```json
{
  "tileSize": 32,
  "cols": 8,
  "rows": 8,
  "tiles": [
    { "id": "grass_0", "col": 0, "row": 0, "type": "ground" },
    { "id": "water_center", "col": 0, "row": 3, "type": "water", "collides": true }
  ]
}
```

manifest가 없으면 자동으로 모든 cell을 만듭니다.

```text
tile_0_0
tile_0_1
tile_0_2
...
```

### Sheet Normalization

입력 이미지가 정확한 크기가 아니면 경고를 내고 nearest neighbor로 resize합니다.

예:

```text
8 cols x 8 rows x 32px = 256x256
```

입력이 1024x1024라면:

```text
1024x1024 → 256x256
```

이 단계는 “AI가 만든 시트가 정확히 256x256이 아닐 때”를 위한 안전장치입니다.

### Tile Split

각 tile은 manifest의 `col`, `row`를 기준으로 잘립니다.

```text
left = col * tileSize
top = row * tileSize
width = tileSize
height = tileSize
```

그리고 다음처럼 저장됩니다.

```text
tiles/grass_0.png
tiles/water_center.png
tiles/bench.png
```

### tileset.json

`tileset.json`은 게임에서 사용할 수 있는 metadata입니다.

```json
{
  "id": "cozy-town",
  "tileSize": 32,
  "cols": 8,
  "rows": 8,
  "image": "tileset.png",
  "tiles": [
    {
      "index": 0,
      "id": "grass_0",
      "col": 0,
      "row": 0,
      "x": 0,
      "y": 0,
      "w": 32,
      "h": 32,
      "type": "ground",
      "collides": false,
      "collision": "none",
      "file": "tiles/grass_0.png"
    }
  ]
}
```

게임에서는 `index`, `x/y/w/h`, `collides`, `type` 같은 정보를 사용할 수 있습니다.

## optimize-assets.ts

[scripts/optimize-assets.ts](../scripts/optimize-assets.ts)는 폴더 전체를 압축해서 별도 output 폴더에 저장합니다.

예:

```bash
npm run optimize:assets -- source-assets/society-4-1-2-2/src-assets --out output/society-4-1-2-2/assets
```

### 실행 흐름

```text
main()
→ CLI 인자 파싱
→ source directory 확인
→ walkImages()
→ 각 이미지 optimizeImage()
→ output 폴더에 저장
→ optimization-report.json 저장
```

### Optimization Rules

PNG:

```text
palette: true
compressionLevel: 9
adaptiveFiltering: true
quality: 기본 88
```

JPG:

```text
progressive: true
mozjpeg: true
quality: 기본 84
```

WebP:

```text
quality: 기본 84
effort: 6
```

큰 PNG는 WebP 후보도 함께 생성합니다.

```bash
--webp true
--webp-threshold 300000
```

### Safety Rule

압축 결과가 원본보다 커지면 원본을 그대로 복사합니다.

```text
if optimized file >= original file
→ keep original
```

그래서 압축 스크립트를 돌렸다고 해서 용량이 더 커지는 상황을 피합니다.

## asset-optimizer.ts

[scripts/lib/asset-optimizer.ts](../scripts/lib/asset-optimizer.ts)는 import 스크립트와 standalone optimizer가 함께 쓰는 공통 모듈입니다.

주요 함수:

```text
optimizeImage()
optimizeDirectory()
optimizeFilesInPlace()
logOptimizeRows()
```

### optimizeFilesInPlace()

import 스크립트가 생성 직후 자동 압축할 때 사용합니다.

```text
generated file
→ 임시 optimized file 생성
→ 원본보다 작으면 교체
→ 임시 파일 삭제
→ 절감률 로그 출력
```

### optimizeDirectory()

`optimize-assets.ts`가 폴더 전체를 압축할 때 사용합니다.

```text
source directory
→ image files walk
→ output directory에 같은 구조로 저장
→ report 생성
```

## End-To-End Examples

### Character

```bash
npm run import:character -- cat assets/raw/characters/cat.png --mode auto
```

내부 흐름:

```text
cat.png
→ mode 추정
→ atlas 생성
→ cat.json 생성
→ cat-preview.png 생성
→ cat-frames/*.png 생성
→ PNG 자동 압축
```

### Tileset

```bash
npm run import:tileset -- cozy-town tilesets/cozy-town/source/cozy-town-sheet.png --manifest tilesets/cozy-town/manifest.example.json
```

내부 흐름:

```text
cozy-town-sheet.png
→ 256x256 normalize
→ 64 tiles split
→ preview 생성
→ tileset.json 생성
→ tileset.png / preview / tiles/*.png 자동 압축
```

### Map

```bash
npm run import:map -- act1_library assets/raw/maps/act1_library.png --config maps/act1_library.config.json
```

내부 흐름:

```text
act1_library.png
→ config 읽기
→ spawn/wall 검증
→ 1280x1280 JPG 생성
→ Tiled style JSON 생성
→ preview JPG 생성
→ JPG 자동 압축
```

## Recommended Reading Order

처음 공부한다면 이 순서로 보는 것이 좋습니다.

```text
1. README.md
2. docs/import-pipeline.md
3. scripts/import-item.ts
4. scripts/import-tileset.ts
5. scripts/import-map.ts
6. scripts/import-character.ts
7. scripts/lib/asset-optimizer.ts
```

`import-item.ts`가 가장 작고 이해하기 쉽고, `import-character.ts`가 가장 복잡합니다.
