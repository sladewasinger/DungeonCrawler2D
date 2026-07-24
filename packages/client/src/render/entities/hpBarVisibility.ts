// Pure combat-health visibility policy shared by player and monster visuals.

export function resolveHpBarVisibility(
  previousHp: number | undefined,
  hp: number,
  maxHp: number,
  revealed: boolean,
): boolean {
  const tookDamage = previousHp !== undefined && hp < previousHp;
  if (hp <= 0 || hp >= maxHp) return false;
  return revealed || tookDamage;
}
