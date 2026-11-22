/** Loads crisp knight sprite frames from /assets/atlas.json and renders players. */
import { TILE_PX, type PlayerSnapshot } from "@dc2d/engine";
import { Container, ImageSource, Rectangle, Sprite, Text, Texture } from "pixi.js";

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
  private readonly label: Text;

  constructor(frames: KnightFrames, torchTex: Texture, name: string) {
    this.body = new Sprite(frames.idle[0]);
    this.body.anchor.set(0.5, 0.92);
    this.torch = new Sprite(torchTex);
    this.torch.anchor.set(0.5, 0.85);
    this.torch.position.set(7, -6);
    this.torch.scale.set(0.75);
    this.label = new Text({
      text: name,
      resolution: 2,
      roundPixels: false,
      textureStyle: { scaleMode: "linear" },
      style: {
        fontSize: 28,
        fontWeight: "700",
        fill: 0xf8fafc,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        stroke: { color: 0x0f172a, width: 6, join: "round" },
      },
    });
    this.label.anchor.set(0.5, 1);
    this.label.scale.set(0.24);
    this.label.position.set(0, -28);
    this.root.addChild(this.torch, this.body, this.label);
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
    const list = snap.moving ? frames.run : frames.idle;
    const nextTex = list[Math.floor(timeSec * (snap.moving ? 10 : 6)) % list.length];
    if (nextTex) this.body.texture = nextTex;
    if (Math.abs(snap.facingX) > 0.1) this.body.scale.x = snap.facingX < 0 ? -1 : 1;
    this.syncTorch(snap.torchLit, torchFrames, timeSec);
  }

  private syncTorch(lit: boolean, torchFrames: readonly Texture[], timeSec: number): void {
    this.torch.visible = lit;
    if (!lit || torchFrames.length === 0) return;
    const tf = torchFrames[Math.floor(timeSec * 12) % torchFrames.length];
    if (tf) this.torch.texture = tf;
    this.torch.position.x = this.body.scale.x * 7;
  }
}
