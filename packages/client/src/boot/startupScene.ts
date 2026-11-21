import { testbenchSceneKey } from "../scenes/testbench/testbenchRegistry.js";

export interface StartupSceneRequest {
  readonly configuredStartupScene: string | undefined;
  readonly requestedScene: string | null;
  readonly requestedTestbench: string | null;
}

export function resolveStartupScene(request: StartupSceneRequest): string {
  if (request.configuredStartupScene) return request.configuredStartupScene;
  const testbench = testbenchSceneKey(request.requestedTestbench);
  if (testbench) return testbench;
  if (request.requestedScene === "editor") return "editor";
  return "title";
}
