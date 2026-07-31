import {
  LEVEL,
  World,
  buildContentRegistry,
  hashString,
} from "@dc2d/engine";
import {
  areaReactionsData,
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { PlayerStore } from "../../../../store.js";
import { createSimState, type SimState } from "../../../state/state.js";
import {
  ensureCombatSandboxTrainingDummies,
  TRAINING_DUMMY_DEF_ID,
} from "../../training/trainingDummy.js";

export function makeTrainingSandbox(
  level: typeof LEVEL.Sandbox | typeof LEVEL.CombatSandbox = LEVEL.CombatSandbox,
): SimState {
  return createSimState({
    world: new World(hashString("training-dummy-test"), 1, level),
    content: buildContentRegistry({
      statuses: [...statusesData], rules: [...rulesData], areas: [...areasData],
      areaReactions: [...areaReactionsData], items: [...itemsData],
      enemies: [...enemiesData], recipes: [...recipesData],
    }),
    store: new PlayerStore(null),
    rngSeed: 1,
    opts: {},
  });
}

export function trainingDummies(sim: SimState) {
  return [...sim.enemies.values()].filter(
    (enemy) => enemy.entity.tags.has("training-dummy"),
  );
}

export function passiveTrainingDummy(sim: SimState) {
  ensureCombatSandboxTrainingDummies(sim);
  const dummy = trainingDummies(sim).find(
    (candidate) => candidate.def.id === TRAINING_DUMMY_DEF_ID,
  );
  if (!dummy) throw new Error("training dummy fixture did not spawn");
  return dummy;
}
