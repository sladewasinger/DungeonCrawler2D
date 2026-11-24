# Combat Hitbox & Collider Geometry

Canonical engine-owned geometry shared verbatim by server simulation, client prediction, and `?debug=1` debug rendering:

- **Foot Colliders (`GroundColliderShape`)**: `playerFootCollider` (`playerFootSegment`), `entityFootCollider`, and `obstacleToColliderShape` define physical movement boundaries (8-way rotated/foreshortened capsules for player feet, horizontal capsules for tents, rounded rectangles for structures, circles for creatures and natural props).
- **Hurtboxes (`EllipseHurtbox`, specs in `creatureHitboxSpecs.ts`)**: `playerHurtbox` and `entityHurtbox` wrap visible sprite bounds with forgiving padding (carrying optional tile `elevation` and `onStairs` flags) so melee swings and arrows register across the full body.
- **Attack Hitboxes & Elevation Overlap (`AttackHitbox`, `hitboxOverlap.ts`)**: `buildEntityAttackHitbox`, `resolveEntityAttackHitbox`, `buildPlayerAttackHitbox`, `resolvePlayerAttackHitbox`, `attackHitboxHitsHurtbox`, `canReachMeleeTarget`, and `projectileHitsHurtbox` model directional forward strike cones/slams active only during attack frames while enforcing same-elevation / 1-tile stairs reachability and downhill projectile elevation projection (`ELEVATION_LIFT_TILES`).
