/** Loads crisp knight sprite frames from /assets/atlas.json and renders players. */
import { TILE_PX, type PlayerSnapshot } from "@dc2d/engine";
import { Container, ImageSource, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { getItemHeldTexture } from "../../ui/icons/itemIcons.js";

export interface KnightFrames {
  readonly idle: readonly Texture[];
  readonly run: readonly Texture[];
}

interface AtlasFrameEntry {
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

interface AtlasJson {
  readonly frames: Readonly<Record<string, AtlasFrameEntry>>;
}

export async function loadKnightFrames(fallback: Texture): Promise<KnightFrames> {
  try {
    const [jsonRes, img] = await Promise.all([fetch("/assets/atlas.json"), loadImage("/assets/atlas.png")]);
    if (!jsonRes.ok) return { idle: [fallback], run: [fallback] };
    const data = (await jsonRes.json()) as AtlasJson;
    const source = new ImageSource({ resource: img, scaleMode: "nearest" });
    const slice = (prefix: string): Texture[] =>
      [0, 1, 2, 3]
        .map((i) => data.frames[`${prefix}${i}`]?.frame)
        .filter((f): f is AtlasFrameEntry["frame"] => Boolean(f))
        .map((f) => new Texture({ source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
    const idle = slice("knight_m_idle_anim_f");
    const run = slice("knight_m_run_anim_f");
    return idle.length > 0 && run.length > 0 ? { idle, run } : { idle: [fallback], run: [fallback] };
  } catch {
    return { idle: [fallback], run: [fallback] };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export class PlayerView {
  readonly root = new Container();
  private readonly body: Sprite;
  private readonly torch: Sprite;
  private readonly held: Sprite;
  private readonly label: Text;
  private renderedItemId: string | null = null;

  constructor(frames: KnightFrames, torchTex: Texture, name: string) {
    this.body = new Sprite(frames.idle[0]);
    this.body.anchor.set(0.5, 0.92);
    this.torch = new Sprite(torchTex);
    this.torch.anchor.set(0.5, 0.85);
    this.torch.position.set(7, -6);
    this.torch.scale.set(0.75);
    this.held = new Sprite();
    this.held.anchor.set(0.5, 0.65);
    this.held.position.set(-6, -4);
    this.held.scale.set(0.65);
    this.held.visible = false;
    this.label = createNameLabel(name);
    this.root.addChild(this.torch, this.held, this.body, this.label);
  }

  sync(input: {
    readonly snap: PlayerSnapshot;
    readonly frames: KnightFrames;
    readonly torchFrames: readonly Texture[];
    readonly timeSec: number;
  }): void {
    const { snap, frames, torchFrames, timeSec } = input;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX);
    this.root.zIndex = Math.round(snap.y * TILE_PX);
    if (this.label.text !== snap.name) this.label.text = snap.name;
    const list = snap.moving ? frames.run : frames.idle;
    const nextTex = list[Math.floor(timeSec * (snap.moving ? 10 : 6)) % list.length];
    if (nextTex) this.body.texture = nextTex;
    if (Math.abs(snap.facingX) > 0.1) this.body.scale.x = snap.facingX < 0 ? -1 : 1;
    this.syncTorch(snap.torchLit, torchFrames, timeSec);
    this.syncHeldItem(snap);
  }

  private syncTorch(lit: boolean, torchFrames: readonly Texture[], timeSec: number): void {
    this.torch.visible = lit;
    if (!lit || torchFrames.length === 0) return;
    const tf = torchFrames[Math.floor(timeSec * 12) % torchFrames.length];
    if (tf) this.torch.texture = tf;
    this.torch.position.x = this.body.scale.x * 7;
  }

  private syncHeldItem(snap: PlayerSnapshot): void {
    const itemId = snap.heldItem ?? null;
    if (!itemId || (itemId === "torch" && snap.torchLit)) {
      this.held.visible = false;
      return;
    }
    if (itemId !== this.renderedItemId) {
      this.renderedItemId = itemId;
      const tex = getItemHeldTexture(itemId);
      if (tex) this.held.texture = tex;
    }
    const dir = this.body.scale.x;
    this.held.position.set(-dir * 6, -4);
    this.held.scale.set(dir * 0.65, 0.65);
    this.held.visible = true;
  }
}

function createNameLabel(name: string): Text {
  const label = new Text({
    text: name, resolution: 2, roundPixels: false, textureStyle: { scaleMode: "linear" },
    style: {
      fontSize: 28, fontWeight: "700", fill: 0xf8fafc,
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      stroke: { color: 0x0f172a, width: 6, join: "round" },
    },
  });
  label.anchor.set(0.5, 1);
  label.scale.set(0.24);
  label.position.set(0, -28);
  return label;
}
