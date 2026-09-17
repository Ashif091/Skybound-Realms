# Fix Object Placement and Physics Persistence

## Goal
Fix issues preventing objects from being properly placed, resolving floating drops, and ensuring accurate collision removal when structures are destroyed. The root causes involve placement validation logic, precise drop coordinate logic, and synchronization of overlapping structures in the physics array.

## Proposed Changes

### 1. Drop Physics (`js/main.js` & `js/island.js`)
Currently, when a structure is destroyed, drops are spawned at the structure's exact `y` height (e.g., roof height) leaving them floating.
- **[MODIFY]** `js/main.js`: Ensure the drop's Y-coordinate calculation snaps to the terrain height (`this.island.getTerrainHeight`) + 0.5 offset so it falls naturally to the ground instead of floating mid-air.

### 2. Placement Logic (`js/main.js`)
The `getCrosshairTarget` logic combined with `getPlacementBaseY` can sometimes produce placement coordinates that fail the `isValidBuildPosition` validation due to strict XZ/Y tolerance constraints, causing placement to silently reject.
- **[MODIFY]** `js/main.js`: Refine `dropX`, `dropZ`, and `checkY` logic in `onPlaceRightClick` and `updateBuildPreview` to ensure coordinates align exactly with the validation thresholds, guaranteeing that if the preview is white, the right-click placement will definitively succeed.

### 3. Collision Cleanup on Break (`js/island.js`)
If objects overlap perfectly (due to sync duplication or rapid clicking), destroying one structure removes its mesh but leaves residual colliders from the duplicate in the physics engine (`treeColliders`), creating invisible "walls".
- **[MODIFY]** `js/island.js`: In `damageSpecificStructure`, ensure that when a structure breaks, we rigorously purge all its associated colliders from `this.treeColliders`, avoiding index shifting bugs.
- **[MODIFY]** `js/island.js`: In `syncPlacedBlocks`, tighten the deduplication logic to ignore `y` discrepancies if the block types match at the same XZ grid point, preventing duplicate ghost structures from spawning on reload.

## Verification Plan
1. Right-click to place a Wood Wall on the ground and verify it places and consumes inventory.
2. Stack a roof on top of the wall and verify stacking validation allows it.
3. Destroy the roof and confirm the resulting dropped log falls to the terrain level.
4. Verify the player can walk freely through the space previously occupied by the destroyed wall.
