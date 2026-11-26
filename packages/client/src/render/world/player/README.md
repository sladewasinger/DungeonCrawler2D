# Hero Player Renderer (`packages/client/src/render/world/player`)

8-directional Hero sprite composition, held-weapon socket transforms, and overhead HUD bars:

- `playerSprite.ts`: `PlayerView` syncing 3D pose clips, bow draw overlay, web cocoons, speech bubbles, and water submerge masks.
- `playerPoseHelpers.ts` & `playerHeldLayout.ts`: Pose track selection, hand socket sampling, and held weapon/shield placement.
- `playerHpBar.ts`: Overhead health bar and crisp floating name label.
