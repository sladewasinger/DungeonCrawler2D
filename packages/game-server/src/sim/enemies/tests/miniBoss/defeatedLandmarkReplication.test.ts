import { CHUNK_SIZE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { buildSnapshots } from "../../../snapshots/snapshots.js";
import {
  addArenaPlayer,
  createMiniBossArenaSim,
  defeatTestArenaBoss,
  requiredArenaGate,
  spawnTestArena,
} from "../miniBossArena/miniBossArenaTestSupport.js";

describe("defeated mini-boss compass landmarks", () => {
  it("replicates defeat after arena gates leave the player's AOI", () => {
    const sim = createMiniBossArenaSim();
    const arena = spawnTestArena(sim);
    const gate = requiredArenaGate(arena.gates[0]);
    const fighter = addArenaPlayer(sim, "fighter", gate.outside);
    defeatTestArenaBoss(sim, arena.key);
    fighter.entity.body.x = (arena.chunk.cx + 3) * CHUNK_SIZE + 0.5;
    fighter.entity.body.y = arena.chunk.cy * CHUNK_SIZE + 0.5;

    const snapshot = buildSnapshots(sim).get(fighter.entity.id);

    expect(snapshot?.miniBossArenaGates).toEqual([]);
    expect(snapshot?.defeatedMiniBossArenaWindow).toEqual({
      center: { cx: arena.chunk.cx + 3, cy: arena.chunk.cy },
      arenas: [{ cx: arena.chunk.cx, cy: arena.chunk.cy }],
    });
  });
});
