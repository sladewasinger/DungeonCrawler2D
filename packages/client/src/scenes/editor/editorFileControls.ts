import type { EditorHeightmapSurface } from "./editorHeightmapSurface.js";
import type { EditorTerrainWorld } from "./EditorTerrainWorld.js";

export interface EditorFileControls {
  readonly exportButton: HTMLButtonElement;
  readonly importButton: HTMLButtonElement;
  setWorld(world: EditorTerrainWorld): void;
  dispose(): void;
}

export function createEditorFileControls(heightmap: EditorHeightmapSurface): EditorFileControls {
  const exportButton = button("Export map", "editor-export");
  const importButton = button("Import map", "editor-import");
  const input = createImportInput();
  document.body.append(input);
  let world: EditorTerrainWorld | undefined;
  const exportMap = (): void => {
    if (!world) return;
    const blob = new Blob([world.exportMap()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finite-floor-${world.floor}-map.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const onImport = (): void => input.click();
  const onFile = (): void => {
    const file = input.files?.[0];
    if (!file || !world) return;
    void file.text().then((serialized) => importMap(serialized, world!, heightmap));
  };
  bindFileControls({ exportButton, importButton, input, exportMap, onImport, onFile });
  return {
    exportButton,
    importButton,
    setWorld: (next) => { world = next; },
    dispose: () => {
      importButton.removeEventListener("click", onImport);
      exportButton.removeEventListener("click", exportMap);
      input.removeEventListener("change", onFile);
      input.remove();
    },
  };
}

interface FileControlBindings {
  readonly exportButton: HTMLButtonElement;
  readonly importButton: HTMLButtonElement;
  readonly input: HTMLInputElement;
  readonly exportMap: () => void;
  readonly onImport: () => void;
  readonly onFile: () => void;
}

function bindFileControls(bindings: FileControlBindings): void {
  bindings.importButton.addEventListener("click", bindings.onImport);
  bindings.input.addEventListener("change", bindings.onFile);
  bindings.exportButton.addEventListener("click", bindings.exportMap);
}

function createImportInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.hidden = true;
  return input;
}

function importMap(serialized: string, world: EditorTerrainWorld, heightmap: EditorHeightmapSurface): void {
  try {
    world.importMap(serialized);
    heightmap.render();
    setStatus("Imported authored map overlay.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Editor map import failed.");
  }
}

function setStatus(message: string): void {
  const status = document.getElementById("editor-status");
  if (status) status.textContent = message;
}

function button(label: string, id: string): HTMLButtonElement {
  const control = document.createElement("button");
  control.type = "button";
  control.id = id;
  control.textContent = label;
  return control;
}
