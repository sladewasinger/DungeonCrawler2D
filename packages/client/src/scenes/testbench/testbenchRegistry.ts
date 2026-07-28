/** Maps stable URL-facing testbench ids to Phaser scene keys. Add future benches here. */
export const TESTBENCH_SCENE_KEYS = {
  character_vfx: "testbench-character-vfx",
} as const;

export type TestbenchId = keyof typeof TESTBENCH_SCENE_KEYS;

export function testbenchSceneKey(id: string | null): string | undefined {
  if (id === null) return undefined;
  return TESTBENCH_SCENE_KEYS[id as TestbenchId];
}
