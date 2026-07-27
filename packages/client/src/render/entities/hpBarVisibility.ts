// Pure combat-health visibility policy shared by player and monster visuals.

export interface HpBarVisibilityInput {
  readonly previousHp: number | undefined;
  readonly hp: number;
  readonly maxHp: number;
  readonly revealed: boolean;
}

export function resolveHpBarVisibility({
  previousHp,
  hp,
  maxHp,
  revealed,
}: HpBarVisibilityInput): boolean {
  const tookDamage = previousHp !== undefined && hp < previousHp;
  if (hp <= 0 || hp >= maxHp) return false;
  return revealed || tookDamage;
}
