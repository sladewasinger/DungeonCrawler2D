# Dynamic Cloth Web & Silk Cocoon (`sim/webs/`)

Server-authoritative simulation for spider webs and silk cocoons:
- `webGeometry.ts`: Solid prop anchoring (`pickWebAnchor`), distance-to-strand, and slash sector queries.
- `webNetwork.ts`: `WorldWebNetwork` managing spring-cloth radial cobwebs that stretch when walked through, auto-stitch nearby clusters into unified web patterns, accumulate player `webStick` (`>= 0.85` stuck), snap cleanly under sharp weapons (`isSharpWeapon`), and catch/spread fire from torches, burning actors, or campfires.
- `webCocoon.ts`: Spider ranged `webSpit` trigger, stuck-victim cocoon wrapping (`cocoonProgress 0 → 1`) + ~60s locked venom bite (`2` dmg / `1.2s`), post-cocoon spider de-aggro (`ST_RETURN` back into ambush/patrol hiding), self/ally sharp-cut rescues, and fire-spread burn escapes.
