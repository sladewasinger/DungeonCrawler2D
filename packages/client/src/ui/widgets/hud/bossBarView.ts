/**
 * Boss HP bar view-model: picks the boss entity (if any) out of the current AOI
 * entity list. Pure — no Phaser — so it round-trips through a plain vitest test,
 * mirroring xpBarView.ts's split from its widget.
 */
import { isBossDefId } from "../../../net/bossDefIds.js";

export interface BossEntitySource {
  readonly kind: string;
  readonly defId?: string | undefined;
  readonly name?: string | undefined;
  readonly hp?: number | undefined;
  readonly maxHp?: number | undefined;
}

export interface BossBarData {
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
}

/** Title-cases a kebab-case content id into a display name fallback ("warden-of-five"
 * -> "Warden Of Five") for the rare case a boss entity carries no explicit name. */
function titleCaseFromId(defId: string): string {
  return defId.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

/** The boss entity currently in AOI, or null when none is — the widget hides itself
 * on null. Takes the first match; the content vocabulary only ever spawns one boss
 * per arena (Epic 7.14), so ties aren't a real scenario. */
export function resolveBossBar(entities: readonly BossEntitySource[]): BossBarData | null {
  const boss = entities.find((e) => e.kind === "enemy" && isBossDefId(e.defId));
  if (!boss || boss.hp === undefined || boss.maxHp === undefined) return null;
  return { name: boss.name ?? titleCaseFromId(boss.defId ?? ""), hp: boss.hp, maxHp: boss.maxHp };
}
