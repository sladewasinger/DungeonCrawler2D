import Phaser from "phaser";
import { EntityRenderer, type RenderContext } from "../../render/entities/geometry/index.js";
import { Terrain4Renderer } from "../../render/terrain4/index.js";
import { setViewOrientation } from "../../render/view/transform/viewState.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import {
  characterVfxPlayerViews,
  createCharacterVfxActors,
  disposeCharacterVfxActors,
  type CharacterVfxActor,
} from "./characterVfxBenchActors.js";
import { updateCharacterVfxActors } from "./characterVfxBenchSimulation.js";
import { CHARACTER_VFX_ROOM, CharacterVfxBenchWorld } from "./characterVfxBenchWorld.js";

const SCENE_KEY = "testbench-character-vfx";
const BENCH_ZOOM = 0.9;
const HEADER_SCALE = 1 / BENCH_ZOOM;
const BACKGROUND = "#14141c";
const HEADER_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: "#f7d774",
  fontFamily: "monogram, monospace",
  fontSize: "48px",
  stroke: "#11141c",
  strokeThickness: 5,
};
const HELP_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  color: "#f1f3f5",
  fontFamily: "monogram, monospace",
  fontSize: "36px",
  stroke: "#11141c",
  strokeThickness: 4,
};

export class CharacterVfxTestbench extends Phaser.Scene {
  private readonly world = new CharacterVfxBenchWorld();
  private entityRenderer!: EntityRenderer;
  private terrain!: Terrain4Renderer;
  private actors: CharacterVfxActor[] = [];
  private header!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEY);
  }

  create(): void {
    setViewOrientation(0);
    this.entityRenderer = new EntityRenderer(this);
    this.terrain = new Terrain4Renderer(this, this.world);
    this.cameras.main.setBackgroundColor(BACKGROUND);
    this.cameras.main.setZoom(BENCH_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBounds(0, 0, (CHARACTER_VFX_ROOM.width + 2) * SCREEN_TILE_PX, 16 * SCREEN_TILE_PX);
    const centerX = (CHARACTER_VFX_ROOM.left + CHARACTER_VFX_ROOM.width / 2) * SCREEN_TILE_PX;
    this.cameras.main.centerOn(centerX, 8 * SCREEN_TILE_PX);
    this.createHeader();
    this.actors = createCharacterVfxActors(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.disposeBench, this);
  }

  update(time: number, delta: number): void {
    this.terrain.update(this.cameras.main.worldView);
    updateCharacterVfxActors({ scene: this, actors: this.actors, nowMs: time, deltaMs: delta });
    this.entityRenderer.syncPlayers(characterVfxPlayerViews(this.actors), this.renderContext(time, delta));
  }

  private renderContext(nowMs: number, deltaMs: number): RenderContext {
    return {
      world: this.world,
      nowMs,
      dtSeconds: deltaMs / 1000,
      selfX: 18,
      selfY: 8,
      partyIds: new Set(this.actors.map((actor) => `character-vfx:${actor.id}`)),
    };
  }

  private createHeader(): void {
    this.header = this.add.text(24, 20, "CHARACTER VFX TESTBENCH", HEADER_STYLE)
      .setScrollFactor(0)
      .setScale(HEADER_SCALE)
      .setDepth(500_000);
    this.help = this.add.text(24, 55, "Cursor left/right: breath facing   |   run, walk, and jump/land dust are live gameplay VFX", HELP_STYLE)
      .setScrollFactor(0)
      .setScale(HEADER_SCALE)
      .setDepth(500_000);
  }

  private disposeBench(): void {
    disposeCharacterVfxActors(this.actors);
    this.actors = [];
    this.entityRenderer.dispose();
    this.terrain.dispose();
    this.header.destroy();
    this.help.destroy();
  }
}
