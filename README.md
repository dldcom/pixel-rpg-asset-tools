# Pixel RPG Asset Tools

AI로 만든 이미지나 직접 만든 원본 이미지를 **top-down pixel RPG 게임에서 바로 쓸 수 있는 에셋**으로 정리하는 도구 모음입니다.

이 프로젝트의 목표는 단순합니다.

```text
원본 이미지 / 스프라이트시트 / 타일셋 / 맵 이미지
→ 자동 분리
→ 게임용 PNG/JSON 생성
→ 프리뷰 생성
→ 용량 최적화
→ 게임 프로젝트로 가져가기
```

처음 클론한 사람은 이 repo를 **에셋 제작소**라고 생각하면 됩니다. 게임 본체가 아니라, 캐릭터/아이템/맵/타일셋을 만들고 정리하고 압축하는 작업실입니다.

## What This Is For

이 도구는 이런 상황을 위해 만들었습니다.

- AI로 만든 캐릭터 이미지를 걷기 스프라이트시트로 정리하고 싶을 때
- 4방향 캐릭터 스프라이트시트를 자동으로 프레임별 분리하고 싶을 때
- 아이템 이미지를 32x32 아이콘으로 정리하고 싶을 때
- 맵 이미지를 게임용 JPG/JSON으로 변환하고 싶을 때
- 8x8 타일셋 이미지 한 장을 64개 타일로 자동 분리하고 싶을 때
- 생성된 PNG 용량을 자동으로 줄이고 WebP 후보까지 만들고 싶을 때

## Main Workflow

기본 흐름은 이렇습니다.

```text
1. source-assets/ 또는 assets/raw/ 에 원본 넣기
2. import 스크립트 실행
3. assets/ 또는 tilesets/ 에 게임용 결과물 생성
4. 자동 최적화 실행
5. preview 파일 확인
6. 필요한 결과물을 게임 프로젝트에 복사
```

각 import 스크립트는 기본적으로 생성 후 자동 압축을 실행합니다.

```bash
--optimize true
```

압축을 끄고 싶으면:

```bash
--optimize false
```

## Install

```bash
npm install
```

TypeScript 체크:

```bash
npm run check
```

## Project Structure

```text
pixel-rpg-asset-tools/
  scripts/
    import-character.ts
    import-item.ts
    import-map.ts
    import-tileset.ts
    optimize-assets.ts
    lib/
      asset-optimizer.ts

  assets/
    raw/
      characters/
      items/
      maps/
    characters/
    items/
    maps/
    npcs/

  tilesets/
    cozy-town/
      source/
      manifest.example.json
      tileset.png
      tileset.json
      preview.png
      tiles/

  maps/
    *.config.json

  source-assets/
    society-4-1-2-2/
      src-assets/

  output/
    ...
```

### Folder Roles

`scripts/`
: 자동화 스크립트가 있는 곳입니다.

`assets/raw/`
: 새로 import할 원본 캐릭터, 아이템, 맵 이미지를 임시로 넣는 곳입니다.

`assets/`
: import 결과물이 생성되는 기본 위치입니다.

`tilesets/`
: 타일셋 원본, manifest, 분리된 타일, tileset metadata가 모이는 곳입니다.

`maps/`
: `import-map`에서 읽는 맵 설정 JSON을 두는 곳입니다.

`source-assets/`
: 프로젝트별 원본 에셋 보관소입니다. 다시 생성하거나 수정할 수 있도록 원본, 중간 산출물, 작업 기준 파일을 보관합니다.

`output/`
: 압축/내보내기 결과물입니다. 생성 산출물이므로 Git에는 기본적으로 올리지 않습니다.

## Scripts Overview

```bash
npm run import:character
npm run import:item
npm run import:map
npm run import:tileset
npm run optimize:assets
npm run check
```

각 스크립트가 내부적으로 어떤 순서로 실행되는지 공부하고 싶다면 [Import Script Pipeline](docs/import-pipeline.md)을 먼저 읽어보세요.

## Character Import

캐릭터 원본 이미지를 게임용 캐릭터 atlas로 변환합니다.

지원하는 입력 형태:

- 이미 완성된 atlas
- 단일 정면 이미지
- 정면/측면/후면 3분할 이미지
- 4방향 grid 스프라이트시트
- `auto` 모드로 자동 추정

예시:

```bash
npm run import:character -- cat assets/raw/characters/cat.png --mode auto --name "Cat"
```

출력:

```text
assets/characters/cat.png
assets/characters/cat.json
assets/characters/cat-preview.png
assets/characters/cat-frames/
```

주요 옵션:

```bash
--mode auto|atlas|single|split3|grid
--type characters|npcs
--name "Cat"
--bg-color "255,255,255"
--threshold 30
--cols 4
--rows 4
--row-order down,left,right,up
--target-height 50
--preview true
--frames true
--optimize true
```

## Item Import

아이템 이미지를 작은 게임 아이콘으로 정리합니다.

예시:

```bash
npm run import:item -- extinguisher assets/raw/items/extinguisher.png --name "Extinguisher"
```

출력:

```text
assets/items/extinguisher.png
assets/items/extinguisher.json
assets/items/extinguisher-preview.png
```

주요 옵션:

```bash
--size 32
--bg-color "255,255,255"
--threshold 30
--fit contain|cover
--kernel nearest|lanczos3
--preview true
--optimize true
```

픽셀아트는 보통 `--kernel nearest`가 가장 잘 맞습니다.

## Map Import

한 장짜리 맵 이미지를 게임용 맵 이미지와 Tiled 스타일 JSON으로 변환합니다.

이 스크립트는 특정 게임 코드에 의존하지 않습니다. 대신 `maps/*.config.json` 설정 파일을 읽습니다.

예시:

```bash
npm run import:map -- act1_library assets/raw/maps/act1_library.png --config maps/act1_library.config.json
```

`--config`를 생략하면 다음 파일을 찾습니다.

```text
maps/<map-id>.config.json
```

출력:

```text
assets/maps/act1_library.jpg
assets/maps/act1_library.json
assets/maps/act1_library-preview.jpg
```

맵 config 예시:

```json
{
  "actNumber": 1,
  "spawns": [
    {
      "name": "player",
      "x": 160,
      "y": 320,
      "width": 32,
      "height": 32
    }
  ],
  "walls": [
    {
      "col": 0,
      "row": 0,
      "w": 40,
      "h": 1
    }
  ],
  "overlays": []
}
```

좌표 규칙:

- 맵 출력 크기: `1280x1280`
- 타일 크기: `32x32`
- collision / overlay: `40x40` 타일 좌표
- spawn: 픽셀 좌표

주요 옵션:

```bash
--fit cover|contain|fill
--quality 85
--preview true
--optimize true
```

`cover`
: 비율을 유지하면서 정사각형을 꽉 채웁니다. 일부가 잘릴 수 있습니다.

`contain`
: 원본 전체를 보존하고 빈 공간을 padding 처리합니다.

`fill`
: 강제로 `1280x1280`에 맞춥니다. 이미지가 찌그러질 수 있습니다.

## Tileset Import

타일을 하나씩 만들지 않고, **스프라이트시트 한 장**에서 여러 타일을 자동 분리하는 스크립트입니다.

추천 기본 규격:

```text
tile size: 32x32
sheet: 8x8
total: 64 tiles
```

예시:

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

manifest는 각 타일의 이름, 위치, 타입, 충돌 정보를 기록합니다.

```json
{
  "tileSize": 32,
  "cols": 8,
  "rows": 8,
  "tiles": [
    { "id": "grass_0", "col": 0, "row": 0, "type": "ground" },
    { "id": "dirt_center", "col": 0, "row": 1, "type": "path" },
    { "id": "fence_horizontal", "col": 0, "row": 4, "type": "object", "collides": true }
  ]
}
```

manifest가 없으면 모든 cell을 자동으로 `tile_<row>_<col>` 이름으로 분리합니다.

주요 옵션:

```bash
--tile-size 32
--cols 8
--rows 8
--manifest tilesets/cozy-town/manifest.example.json
--preview true
--optimize true
```

## Tileset Generation Prompt Example

AI 이미지 생성 도구로 타일셋 시트를 만들 때는 이런 형태가 좋습니다.

```text
Create a single 8x8 pixel art tileset sheet for a cozy top-down town RPG.
Each tile is exactly 32x32 pixels.
Use a consistent warm pixel art style.
No text, no labels, no characters, no UI.
Strict orthographic top-down view, not isometric.

Rows:
0 grass variants
1 dirt path center, edges, corners
2 stone plaza tiles
3 pond water center, edges, corners
4 fences and low walls
5 trees, bushes, flowers, rocks
6 town props: bench, signpost, lamp, mailbox, crate, barrel, stall, notice board
7 utility: shadows, entrance mat, stairs, bridge pieces, empty tile
```

중요한 점은 이미지가 예쁘게만 나오는 것이 아니라 **격자가 잘 맞아야 한다**는 것입니다. 그래야 `import:tileset`이 정확히 분리할 수 있습니다.

## Asset Optimization

생성된 assets는 자동으로 가벼운 in-place 압축을 거칩니다.

즉 `import:character`, `import:item`, `import:map`, `import:tileset`을 실행한 직후에는 보통 `optimize-assets.ts`를 따로 실행하지 않아도 됩니다. import 스크립트는 **방금 생성한 파일만** 압축합니다.

```text
import script
→ generated files only
→ in-place optimization
```

별도로 폴더 전체를 압축하려면:

```bash
npm run optimize:assets -- source-assets/society-4-1-2-2/src-assets --out output/society-4-1-2-2/assets
```

`optimize-assets.ts`는 특정 import 결과만 압축하는 용도가 아니라, 지정한 source 폴더 전체를 `output/`으로 다시 최적화해서 내보내는 batch 작업입니다.

주요 옵션:

```bash
--png-quality 88
--jpg-quality 84
--webp-quality 84
--webp true
--webp-threshold 300000
```

동작 방식:

- PNG는 palette/compression 최적화
- JPG는 progressive/mozjpeg 최적화
- 큰 PNG는 WebP 후보도 같이 생성
- 원본보다 커지면 원본을 유지
- `optimization-report.json`에 전후 용량 기록

## Example: Society Project Workflow

이 repo는 현재 `society-4-1-2-2` 게임 프로젝트의 에셋 제작소로도 사용됩니다.

예시 흐름:

```text
1. society 프로젝트의 원본 assets를 source-assets/society-4-1-2-2/src-assets 에 보관
2. 새 캐릭터/타일셋/맵 원본을 추가
3. import 스크립트 실행
4. preview 확인
5. optimize 자동 실행
6. output 또는 생성 결과물을 society 프로젝트의 src/assets 로 복사
```

현재 보관소 예시:

```text
source-assets/society-4-1-2-2/src-assets/
  buildings/
  characters/
  maps/
  tilesets/
```

## What To Commit

Git에 올리면 좋은 것:

- scripts
- manifests
- source-assets 원본
- README / docs
- small example configs

Git에 보통 올리지 않는 것:

- `node_modules/`
- `output/`
- 자동 생성된 `tilesets/*/tiles/`
- 자동 생성된 `tileset.png`, `preview.png`, `tileset.json`

이 repo의 `.gitignore`는 이 기준으로 설정되어 있습니다.

## Common Commands

```bash
npm install
npm run check

npm run import:character -- cat assets/raw/characters/cat.png --mode auto
npm run import:item -- key assets/raw/items/key.png --size 32
npm run import:map -- act1_library assets/raw/maps/act1_library.png --config maps/act1_library.config.json
npm run import:tileset -- cozy-town tilesets/cozy-town/source/cozy-town-sheet.png --manifest tilesets/cozy-town/manifest.example.json

npm run optimize:assets -- source-assets/society-4-1-2-2/src-assets --out output/society-4-1-2-2/assets
```

## Design Philosophy

이 프로젝트는 “AI가 만든 이미지를 그대로 게임에 넣자”가 아니라, 다음 흐름을 지향합니다.

```text
AI or human source
→ structured import
→ predictable metadata
→ preview
→ optimization
→ reusable game asset
```

특히 맵은 한 장짜리 이미지만 믿기보다, 타일셋과 데이터 기반 배치를 함께 사용하는 쪽이 장기적으로 안정적입니다.

## Notes

- Pixel art assets usually work best with nearest-neighbor scaling.
- For tilemaps, keep tile size and grid count explicit.
- For maps, prefer `cover` or `contain` over `fill` unless distortion is acceptable.
- Always inspect generated preview files before copying assets into a game project.
