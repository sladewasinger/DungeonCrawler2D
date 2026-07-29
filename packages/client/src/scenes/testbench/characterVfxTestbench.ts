import Phaser from "phaser";
import { EntityRenderer, type RenderContext } from "../../render/entities/geometry/index.js";
import { TerrainRenderer } from "../../render/terrain/index.js";
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
const CAMERA_PAN_SPEED_PX_PER_SECOND = 720;
const CAMERA_BOUNDS = {
  x: -16 * SCREEN_TILE_PX,
  y: -16 * SCREEN_TILE_PX,
  width: 96 * SCREEN_TILE_PX,
  height: 64 * SCREEN_TILE_PX,
} as const;
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
  private terrain!: TerrainRenderer;
  private actors: CharacterVfxActor[] = [];
  private physicsAccumulatorMs = 0;
  private cameraKeys!: CameraKeys;
  private header!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEY);
  }

  create(): void {
    setViewOrientation(0);
    this.input.keyboard?.enableGlobalCapture();
    this.game.canvas.tabIndex = -1;
    this.game.canvas.focus({ preventScroll: true });
    this.entityRenderer = new EntityRenderer(this);
    this.terrain = new TerrainRenderer(this, this.world);
    this.cameras.main.setBackgroundColor(BACKGROUND);
    this.cameras.main.setZoom(BENCH_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBounds(CAMERA_BOUNDS.x, CAMERA_BOUNDS.y, CAMERA_BOUNDS.width, CAMERA_BOUNDS.height);
    const centerX = (CHARACTER_VFX_ROOM.left + CHARACTER_VFX_ROOM.width / 2) * SCREEN_TILE_PX;
    this.cameras.main.centerOn(centerX, 8 * SCREEN_TILE_PX);
    this.cameraKeys = this.input.keyboard?.addKeys("W,A,S,D") as unknown as CameraKeys;
    this.createHeader();
    this.actors = createCharacterVfxActors(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.disposeBench, this);
  }

  update(time: number, delta: number): void {
    this.panCamera(delta);
    this.terrain.update(this.cameras.main.worldView);
    this.physicsAccumulatorMs = updateCharacterVfxActors({
      scene: this,
      actors: this.actors,
      world: this.world,
      nowMs: time,
      deltaMs: delta,
      physicsAccumulatorMs: this.physicsAccumulatorMs,
    });
    this.entityRenderer.syncPlayers(characterVfxPlayerViews(this.actors), this.renderContext(time, delta));
  }

  private panCamera(deltaMs: number): void {
    const horizontal = Number(this.cameraKeys.D.isDown) - Number(this.cameraKeys.A.isDown);
    const vertical = Number(this.cameraKeys.S.isDown) - Number(this.cameraKeys.W.isDown);
    if (horizontal === 0 && vertical === 0) return;
    const distance = CAMERA_PAN_SPEED_PX_PER_SECOND * deltaMs / 1000;
    this.cameras.main.setScroll(
      this.cameras.main.scrollX + horizontal * distance,
      this.cameras.main.scrollY + vertical * distance,
    );
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
    this.help = this.add.text(24, 55, "W/A/S/D: pan camera   |   cursor left/right: breath facing   |   run, walk, and jump/land dust are live gameplay VFX", HELP_STYLE)
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

interface CameraKeys {
  readonly W: Phaser.Input.Keyboard.Key;
  readonly A: Phaser.Input.Keyboard.Key;
  readonly S: Phaser.Input.Keyboard.Key;
  readonly D: Phaser.Input.Keyboard.Key;
}
