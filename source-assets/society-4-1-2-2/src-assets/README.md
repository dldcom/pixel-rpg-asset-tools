# Asset Pipeline

The game map is built from layers:

1. `maps/base-town-map.png`
   - Top-down village base image.
   - No buildings.
   - Include roads, grass, plaza, paths, trees, water, fences, flower beds, and empty building pads.

2. `buildings/building-spritesheet.png`
   - Transparent PNG building spritesheet.
   - 5 columns x 2 rows.
   - Cell order:
     1. school
     2. cafeteria
     3. stationery shop
     4. bakery
     5. parcel center
     6. convenience store
     7. bus stop
     8. hair salon
     9. theater
     10. packing room

3. `characters/*.png`
   - Character idle sprites first.
   - Later, replace with sprite sheets and CSS background-position animation.

4. `items/*.png`
   - Mini-game objects and reward badges.

Missing images fall back to the current CSS/emoji placeholders, so the game stays playable while assets are produced.
